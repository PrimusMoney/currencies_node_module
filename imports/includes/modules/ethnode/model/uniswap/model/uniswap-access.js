'use strict';

var UniswapAccess = class {
	constructor(session, module) {
		this.session = session;
		this.module = module;
		this.global = this.module.global;
	}

	async getPriceForOutput(scheme, token1, token2, token2amount, uniswap_conf) {
		var global = this.global;
		var session = this.session;
		
		try {
			var price = {};

			if (!uniswap_conf)
				return price;

			var ethnodeserverconfig = scheme.getEthNodeServerConfig();
			
			let web3providerurl = scheme.getWeb3ProviderUrl();


			this.module.addWeb3Provider(scheme);

		
			// conf
			var UniswapV2FactoryAddress = uniswap_conf.factory;
			var UniswapV2Router02Address = uniswap_conf.router;
			

			// contract methods
			var networkid = ethnodeserverconfig.networkid;

			var uniswapfactoryinterface = this.getV2FactoryContratInterface(session, UniswapV2FactoryAddress, web3providerurl);

			const pair_address = await uniswapfactoryinterface.getPairAddress(token1.address, token2.address);

			var uniswappairinterface = this.getV2PairContratInterface(session, pair_address, web3providerurl)
			const reserves = await uniswappairinterface.getReserves();

			var uniswaprouter02interface = this.getV2Router02ContratInterface(session, UniswapV2Router02Address, web3providerurl);

			var quote2 = await uniswaprouter02interface.quote(1, reserves.reserve0, reserves.reserve1);

			var path = [];
			path.push(token1.address);
			path.push(token2.address);

			const WETH = await uniswaprouter02interface.WETH();


			price.amounts_in = await uniswaprouter02interface.getAmountsIn(token2amount, path);
			price.unit_amount_in = await uniswaprouter02interface.getAmountsIn(1, path);

			price.amounts_out = await uniswaprouter02interface.getAmountsOut(token2amount, path);
			price.unit_amount_out = await uniswaprouter02interface.getAmountsOut(1, path);

			return price;
		}
		catch(e) {
			console.log('exception ' + e);
			console.log(e.stack);
		}
	}

	_importERC20Token(session, tokenaddress) {
		var global = this.global;
		
		var erc20tokenmodule = global.getModuleObject('erc20');
		
		var data = {};
		
		data['description'] = tokenaddress;
		data['address'] = tokenaddress;
		
		var erc20tokencontrollers = erc20tokenmodule.getControllersObject();
		
		// create (local) contract for these values
		var erc20tokencontract = erc20tokencontrollers.createERC20TokenObject(session, data);
		
		return erc20tokencontract;
	}

	async buyEthOnOutput(scheme, token1, token1amountmax, weth, ethamount, uniswap_conf, ethtx) {
		var global = this.global;
		var session = this.session;
		
		try {
			let web3providerurl = scheme.getWeb3ProviderUrl();

			// conf
			var UniswapV2FactoryAddress = uniswap_conf.factory;
			var UniswapV2Router02Address = uniswap_conf.router;

			var uniswaprouter02interface = this.getV2Router02ContratInterface(session, UniswapV2Router02Address, web3providerurl);

			// check first that contract has enough allowance on sender account
			var erc20token1contract = this._importERC20Token(session, token1.address);

			var routercontractaccount = session.createBlankAccountObject();
			routercontractaccount.setAddress(UniswapV2Router02Address);

			var allowance = await erc20token1contract.allowance(ethtx.getFromAccount(), routercontractaccount);

			if (parseInt(allowance) < token1amountmax) {
				let alloweraccount = ethtx.getFromAccount();
				let gas = ethtx.getGas(); // we re-use the fees for the original transaction
				let gasPrice = ethtx.getGasPrice();

				const approve = await erc20token1contract.approve(routercontractaccount, token1amountmax, alloweraccount, gas, gasPrice);

				if (!approve)
					return Promise.reject('could not approve contract on token');
			}

			var path = [];
			path.push(token1.address);
			path.push(weth.address);

			var deadline = Date.now() + 5 * 60; // 5 minutes
			
			var result = await uniswaprouter02interface.swapTokensForExactETH(ethamount, token1amountmax, path, deadline, ethtx);

			return result;
		}
		catch(e) {
			console.log('exception ' + e);
			console.log(e.stack);
		}
	}


	async buyTokensOnOutput(scheme, token1, token1amountmax, token2, token2amount, uniswap_conf, ethtx) {
		var global = this.global;
		var session = this.session;
		
		try {
			let web3providerurl = scheme.getWeb3ProviderUrl();

			// conf
			var UniswapV2FactoryAddress = uniswap_conf.factory;
			var UniswapV2Router02Address = uniswap_conf.router;

			var uniswaprouter02interface = this.getV2Router02ContratInterface(session, UniswapV2Router02Address, web3providerurl);

			// check first that contract has enough allowance on sender account
			var erc20token1contract = this._importERC20Token(session, token1.address);

			var routercontractaccount = session.createBlankAccountObject();
			routercontractaccount.setAddress(UniswapV2Router02Address);

			var allowance = await erc20token1contract.allowance(ethtx.getFromAccount(), routercontractaccount);

			if (parseInt(allowance) < token1amountmax) {
				let alloweraccount = ethtx.getFromAccount();
				let gas = ethtx.getGas(); // we re-use the fees for the original transaction
				let gasPrice = ethtx.getGasPrice();

				const approve = await erc20token1contract.approve(routercontractaccount, token1amountmax, alloweraccount, gas, gasPrice);

				if (!approve)
					return Promise.reject('could not approve contract on token');
			}

			var path = [];
			path.push(token1.address);
			path.push(token2.address);

			var deadline = Date.now() + 5 * 60; // 5 minutes
			
			var result = await uniswaprouter02interface.swapTokensForExactTokens(token2amount, token1amountmax, path, deadline, ethtx);

			return result;
		}
		catch(e) {
			console.log('exception ' + e);
			console.log(e.stack);
		}
	}


	// v2
	getV2FactoryContratInterface(session, contractaddress, web3providerurl) {
		var global = this.global;

		var FactoryContractInterfaceClass = this.module.V2_FactoryContractInterface;

		return new FactoryContractInterfaceClass(session, contractaddress, web3providerurl);
	}

	getV2PairContratInterface(session, contractaddress, web3providerurl) {
		var global = this.global;

		var PairContractInterfaceClass = this.module.V2_PairContractInterface;

		return new PairContractInterfaceClass(session, contractaddress, web3providerurl);
	}

	getV2Router02ContratInterface(session, contractaddress, web3providerurl) {
		var global = this.global;

		var Router02InterfaceClass = this.module.V2_Router02ContractInterface;

		return new Router02InterfaceClass(session, contractaddress, web3providerurl);
	}


}

if ( typeof window !== 'undefined' && typeof window.GlobalClass !== 'undefined' && window.GlobalClass ) {
	var _GlobalClass = window.GlobalClass;
}
else if (typeof window !== 'undefined') {
	var _GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
}
else if (typeof global !== 'undefined') {
	// we are in node js
	var _GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
}

_GlobalClass.registerModuleClass('uniswap', 'UniswapAccess', UniswapAccess);

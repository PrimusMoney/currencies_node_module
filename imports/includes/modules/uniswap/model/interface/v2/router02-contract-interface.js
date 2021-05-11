'use strict';

var Router02ContractInterface = class {
	
	constructor(session, contractaddress, web3providerurl) {
		this.session = session;
		this.address = contractaddress;
		
		this.web3providerurl = web3providerurl;
		
		// operating variables
		this.contractinstance = null;
	}
	
	getContractInstance() {
		if (this.contractinstance)
			return this.contractinstance;
		
		var session = this.session;
		var global = session.getGlobalObject();
		var ethnodemodule = global.getModuleObject('ethnode');
		
		this.contractinstance = ethnodemodule.getContractInstance(session, this.address, './contracts/uniswap_v2/IUniswapV2Router02.json', this.web3providerurl);
		
		return this.contractinstance;
	}

	async WETH() {
		var contractinstance = this.getContractInstance();

		var args = [];
	
		const WETH = await contractinstance.method_call('WETH', args);
		
		return WETH;
	}

	async getAmountsIn(amountOut, path) {
		var contractinstance = this.getContractInstance();

		var args = [];
	
		args.push(amountOut);
		args.push(path);

		const amountIn = await contractinstance.method_call('getAmountsIn', args);
		
		return amountIn;
	}

	async getAmountsOut(amountIn, path) {
		var contractinstance = this.getContractInstance();

		var args = [];
	
		args.push(amountIn);
		args.push(path);

		const amountOut = await contractinstance.method_call('getAmountsOut', args);
		
		return amountOut;
	}

	async quote(amountA, reserveA, reserveB) {
		var contractinstance = this.getContractInstance();

		var args = [];
	
		args.push(amountA);
		args.push(reserveA);
		args.push(reserveB);

		const amountB = await contractinstance.method_call('quote', args);
		
		return amountB;
	}
	
	// transactions

	// between token and ETH
	async swapTokensForExactETH(amountOut, amountInMax, path, deadline, ethtx) {
		var contractinstance = this.getContractInstance();

		// create contract transaction
		var payingaccount = ethtx.getPayingAccount();
		payingaccount = (payingaccount ? payingaccount : ethtx.getFromAccount());
		var to = ethtx.getToAddress();

		var gas = ethtx.getGas();
		var gasPrice = ethtx.getGasPrice();
		var transactionuuid = ethtx.getTransactionUUID();
		var value = ethtx.getValue();

		var contracttransaction = contractinstance.getContractTransactionObject(payingaccount, gas, gasPrice);
			
		contracttransaction.setContractTransactionUUID(transactionuuid);
		contracttransaction.setValue(value);

		// set call argument
		var args = [];
		
		args.push(amountOut);
		args.push(amountInMax);
		args.push(path);
		args.push(to);
		args.push(deadline);
		
		contracttransaction.setArguments(args);
		
		contracttransaction.setMethodName('swapTokensForExactETH');
		
		return contractinstance.method_send(contracttransaction);		
	}
	
	async swapExactTokensForETH(amountIn, amountOutMin, path, deadline, ethtx) {
		var contractinstance = this.getContractInstance();

		// create contract transaction
		var payingaccount = ethtx.getPayingAccount();
		payingaccount = (payingaccount ? payingaccount : ethtx.getFromAccount());
		var to = ethtx.getToAddress();

		var gas = ethtx.getGas();
		var gasPrice = ethtx.getGasPrice();
		var transactionuuid = ethtx.getTransactionUUID();
		var value = ethtx.getValue();

		var contracttransaction = contractinstance.getContractTransactionObject(payingaccount, gas, gasPrice);
			
		contracttransaction.setContractTransactionUUID(transactionuuid);
		contracttransaction.setValue(value);

		// set call argument
		var args = [];
		
		args.push(amountIn);
		args.push(amountOutMin);
		args.push(path);
		args.push(to);
		args.push(deadline);
		
		contracttransaction.setArguments(args);
		
		contracttransaction.setMethodName('swapExactTokensForETH');
		
		return contractinstance.method_send(contracttransaction);		
	}

	// between tokens
	async swapTokensForExactTokens(amountOut, amountInMax, path, deadline, ethtx) {
		var contractinstance = this.getContractInstance();

		// create contract transaction
		var payingaccount = ethtx.getPayingAccount();
		payingaccount = (payingaccount ? payingaccount : ethtx.getFromAccount());
		var to = ethtx.getToAddress();

		var gas = ethtx.getGas();
		var gasPrice = ethtx.getGasPrice();
		var transactionuuid = ethtx.getTransactionUUID();
		var value = ethtx.getValue();

		var contracttransaction = contractinstance.getContractTransactionObject(payingaccount, gas, gasPrice);
			
		contracttransaction.setContractTransactionUUID(transactionuuid);
		contracttransaction.setValue(value);

		// set call argument
		var args = [];
		
		args.push(amountOut);
		args.push(amountInMax);
		args.push(path);
		args.push(to);
		args.push(deadline);
		
		contracttransaction.setArguments(args);
		
		contracttransaction.setMethodName('swapTokensForExactTokens');
		
		return contractinstance.method_send(contracttransaction);		
	}

	async swapExactTokensForTokens(amountIn, amountOutMin, path, deadline, ethtx) {
		var contractinstance = this.getContractInstance();

		// create contract transaction
		var payingaccount = ethtx.getPayingAccount();
		payingaccount = (payingaccount ? payingaccount : ethtx.getFromAccount());
		var to = ethtx.getToAddress();

		var gas = ethtx.getGas();
		var gasPrice = ethtx.getGasPrice();
		var transactionuuid = ethtx.getTransactionUUID();
		var value = ethtx.getValue();

		var contracttransaction = contractinstance.getContractTransactionObject(payingaccount, gas, gasPrice);
			
		contracttransaction.setContractTransactionUUID(transactionuuid);
		contracttransaction.setValue(value);

		// set call argument
		var args = [];
		
		args.push(amountIn);
		args.push(amountOutMin);
		args.push(path);
		args.push(to);
		args.push(deadline);
		
		contracttransaction.setArguments(args);
		
		contracttransaction.setMethodName('swapExactTokensForTokens');
		
		return contractinstance.method_send(contracttransaction);		
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

_GlobalClass.registerModuleClass('uniswap', 'V2_Router02ContractInterface', Router02ContractInterface);

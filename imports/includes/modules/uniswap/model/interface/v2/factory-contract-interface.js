'use strict';

var FactoryContractInterface = class {
	
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
		
		this.contractinstance = ethnodemodule.getContractInstance(session, this.address, './contracts/uniswap_v2/IUniswapV2Factory.json', this.web3providerurl);
		
		return this.contractinstance;
	}
	
	async getPairAddress(token1_address, token2_address) {
		var contractinstance = this.getContractInstance();

		var args = [];
	
		args.push(token1_address);
		args.push(token2_address);
		
		const pair_address = await contractinstance.method_call('getPair', args);
		
		return pair_address;
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

_GlobalClass.registerModuleClass('uniswap', 'V2_FactoryContractInterface', FactoryContractInterface);

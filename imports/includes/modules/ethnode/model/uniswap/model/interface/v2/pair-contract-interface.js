'use strict';

var PairContractInterface = class {
	
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
		
		this.contractinstance = ethnodemodule.getContractInstance(session, this.address, './contracts/uniswap_v2/IUniswapV2Pair.json', this.web3providerurl);
		
		return this.contractinstance;
	}
	
	async getReserves() {
		var contractinstance = this.getContractInstance();

		var args = [];
	
		const reserves = await contractinstance.method_call('getReserves', args);
		
		return reserves;
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

_GlobalClass.registerModuleClass('uniswap', 'V2_PairContractInterface', PairContractInterface);

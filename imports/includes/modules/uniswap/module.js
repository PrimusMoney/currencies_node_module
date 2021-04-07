'use strict';

var Module = class {
	
	constructor() {
		this.name = 'uniswap';
		
		this.global = null; // put by global on registration
		this.isready = false;
		this.isloading = false;
		
		this.web3providers = [];
	}
	
	init() {
		console.log('module init called for ' + this.name);
		
		var global = this.global;
		
		this.isready = true;
	}
	
	loadModule(parentscriptloader, callback) {
		console.log('loadModule called for module ' + this.name);

		if (this.isloading)
			return;
			
		this.isloading = true;

		var self = this;
		var global = this.global;

		// wallet module script loader
		var modulescriptloader;
		
		// look if uniswaploader already created (e.g. for loading in node.js)
		modulescriptloader = global.findScriptLoader('uniswaploader');

		// if not, create on as child as parent script loader passed in argument
		if (!modulescriptloader)
		modulescriptloader = global.getScriptLoader('uniswaploader', parentscriptloader);
		
		
		var xtraroot = './includes';
		
		var interfaceroot = xtraroot + '/interface';

		//modulescriptloader.push_script( interfaceroot + '/wallet-server-access.js');
		
		var moduleroot = xtraroot + '/modules/uniswap';

		modulescriptloader.push_script( moduleroot + '/model/uniswap-access.js');

		modulescriptloader.push_script( moduleroot + '/model/interface/exchange-contract-interface.js');
		
		modulescriptloader.load_scripts(function() { self.init(); if (callback) callback(null, self); });
		
		return modulescriptloader;
	}
	
	_getGlobalObject() {
		var _global = (this.global ? this.global : null);
		
		if (!_global) {
			let _GlobalClass;

			if (typeof window !== 'undefined') {
				_GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
			}
			else if (typeof global !== 'undefined') {
				// we are in node js
				_GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
			}
			
			_global = _GlobalClass.getGlobalObject();
		}
			
		return _global;
	}
	

	isReady() {
		return this.isready;
	}

	hasLoadStarted() {
		return this.isloading;
	}
	
	// optional  module functions
	registerHooks() {
		console.log('module registerHooks called for ' + this.name);
		
		var global = this.global;
		
	}
	
	postRegisterModule() {
		console.log('postRegisterModule called for ' + this.name);
		if (!this.isloading) {
			var global = this.global;
			var self = this;
			var rootscriptloader = global.getRootScriptLoader();
			
			this.loadModule(rootscriptloader, function() {
				if (self.registerHooks)
				self.registerHooks();
			});
		}
	}
	
	
	//
	// hooks
	//

	
	// functions
	findWeb3Provider(networkid) {
		var web3providers_arr = Object.values(this.web3providers);

		for (var i = 0; i < web3providers_arr.length; i++) {
			var web3provider = web3providers_arr[i];

			if (web3provider.networkid == networkid)
				return web3provider;
		}
	}
	

	addWeb3Provider(scheme) {
		var schemeuuid = scheme.getSchemeUUID();
		
		this.web3providers[schemeuuid] = scheme.getEthNodeServerConfig();
	}


	async getPriceForOutput(session, scheme, token1, token2, token2amount, uniswap_conf) {
		var global = this.global;

		var UniswapAccessClass = global.getModuleClass('uniswap', 'UniswapAccess');
		var uniswapaccessinstance = new UniswapAccessClass(session, this);

		return uniswapaccessinstance.getPriceForOutput(scheme, token1, token2, token2amount, uniswap_conf);
	}

	async buyEthOnOutput(session, scheme, token1, token1amountmax, weth, ethamount, uniswap_conf, ethtx) {
		var global = this.global;

		var UniswapAccessClass = global.getModuleClass('uniswap', 'UniswapAccess');
		var uniswapaccessinstance = new UniswapAccessClass(session, this);

		return uniswapaccessinstance.buyEthOnOutput(scheme, token1, token1amountmax, weth, ethamount, uniswap_conf, ethtx);
	}

	async buyTokensOnOutput(session, scheme, token1, token1amountmax, token2, token2amount, uniswap_conf, ethtx) {
		var global = this.global;

		var UniswapAccessClass = global.getModuleClass('uniswap', 'UniswapAccess');
		var uniswapaccessinstance = new UniswapAccessClass(session, this);

		return uniswapaccessinstance.buyTokensOnOutput(scheme, token1, token1amountmax, token2, token2amount, uniswap_conf, ethtx);
	}

}

if (typeof window !== 'undefined') {
	let _GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
	
	_GlobalClass.getGlobalObject().registerModuleObject(new Module());

	// dependencies
	_GlobalClass.getGlobalObject().registerModuleDepency('uniswap', 'common');		
}
else if (typeof global !== 'undefined') {
	// we are in node js
	let _GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
	
	_GlobalClass.getGlobalObject().registerModuleObject(new Module());

	// dependencies
	_GlobalClass.getGlobalObject().registerModuleDepency('uniswap', 'common');		
}

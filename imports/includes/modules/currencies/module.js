'use strict';

var Module = class {
	
	constructor() {
		this.name = 'currencies';
		
		this.global = null; // put by global on registration
		this.isready = false;
		this.isloading = false;
		
		this.currencies = [];
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
		
		// look if currenciesloader already created (e.g. for loading in node.js)
		modulescriptloader = global.findScriptLoader('currenciesloader');

		// if not, create on as child as parent script loader passed in argument
		if (!modulescriptloader)
		modulescriptloader = global.getScriptLoader('currenciesloader', parentscriptloader);
		
		
		var xtraroot = './includes';
		
		var interfaceroot = xtraroot + '/interface';

		//modulescriptloader.push_script( interfaceroot + '/wallet-server-access.js');
		
		var moduleroot = xtraroot + '/modules/currencies';

		//modulescriptloader.push_script( moduleroot + '/model/currencies-access.js');

		//modulescriptloader.push_script( moduleroot + '/model/interface/exchange-contract-interface.js');
		
		modulescriptloader.load_scripts(function() { self.init(); if (callback) callback(null, self); });
		
		return modulescriptloader;
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


	
	//
	// Currencies functions
	//
	getCurrencies() {
		return this.currencies;
	}

	getCurrency(currencyuuid) {
		var array = this.currencies;

		for (var i = 0; i < (array ? array.length : 0); i++) {
			if (array[i].uuid === currencyuuid)
				return array[i];
		}

	}

	addCurrency(currency) {
		this.currencies.push(currency);
	}

	getCurrencyProvider(session, currencyuuid) {
		var currency = this.getCurrency(currencyuuid);

		if (currency && currency.provider) {
			var Provider = require('./model/providers/' + currency.provider).default;
			var provider = new Provider(session, currency);

			return provider;
		}
	}


}

if (typeof window !== 'undefined') {
	let _GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
	
	_GlobalClass.getGlobalObject().registerModuleObject(new Module());

	// dependencies
	_GlobalClass.getGlobalObject().registerModuleDepency('currencies', 'common');		
}
else if (typeof global !== 'undefined') {
	// we are in node js
	let _GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
	
	_GlobalClass.getGlobalObject().registerModuleObject(new Module());

	// dependencies
	_GlobalClass.getGlobalObject().registerModuleDepency('currencies', 'common');		
}

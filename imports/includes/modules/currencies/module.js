'use strict';

var Module = class {
	
	constructor() {
		this.name = 'currencies';
		
		this.global = null; // put by global on registration
		this.isready = false;
		this.isloading = false;
		
		this.currencies = [];
		this.currencies_timestamp = Date.now();
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

		modulescriptloader.push_script( moduleroot + '/model/currency-amount.js');
		modulescriptloader.push_script( moduleroot + '/model/decimal-amount.js');
		modulescriptloader.push_script( moduleroot + '/model/providers/provider.js');

		
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
		
	
		// signal module is ready
		var rootscriptloader = global.getRootScriptLoader();
		rootscriptloader.signalEvent('on_currencies_module_ready');
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

	getCurrenciesTimeStamp() {
		return this.currencies_timestamp;
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
		this.currencies_timestamp = Date.now(); // change time stamp
	}

	getCurrencyProvider(session, currencyuuid) {
		var global = this.global;
		var currency = this.getCurrency(currencyuuid);

		if (currency && currency.provider) {
			//var Provider = require('./model/providers/' + currency.provider).default;
			var Provider = global.getModuleClass('currencies', currency.provider); // to be usable in node.js
			
			var provider = new Provider(session, currency);

			return provider;
		}
	}

	async readLocalCurrencies(session) {
		var global = this.global;

		var commonmodule = global.getModuleObject('common');
		var walletmodule = this;
		
		var _keys = ['shared', 'currencies', 'currencies']; // look in 'shared' branch

		var clientAccess = session.getClientStorageAccessInstance();
		
		var currencies = await new Promise((resolve, reject) => { 
			clientAccess.readClientSideJson(_keys, (err, res) => {
				if (err) {
					resolve([]);
				}
				else {
					var _currencies = res;
					
					resolve(_currencies);
				}
			});
		})
		.catch(err => {
			currencies = [];
		});

		return currencies
	}

	_checkCurrencyInMemory(currency) {
		var currencyuuid = currency.uuid;

		var curr = this.getCurrency(currencyuuid);

		if (!curr)
		this.addCurrency(currency);
	}

	async saveLocalCurrencies(session, currencies) {
		var global = this.global;

		for (var i = 0; i < currencies.length; i++) {
			this._checkCurrencyInMemory(currencies[i]);
		}

		var _keys = ['shared', 'currencies', 'currencies']; // look in 'shared' branch
		
		// create json
		var clientAccess = session.getClientStorageAccessInstance();
		
		return new Promise((resolve, reject) => { 
			clientAccess.saveClientSideJson(_keys, currencies, (err, res) => {
				if (err) reject(err); else resolve(res);
			});
		});
	}

	async saveLocalCurrency(session, currency) {
		var currencies = await this.readLocalCurrencies(session);

		if (currencies) {
			// check if it is in the list
			var bInList = false;
			
			for (var i = 0; i < currencies.length; i++) {
				if (currency.uuid == currencies[i].uuid) {
					bInList = true;
					currencies[i] = currency;
					break;
				}
			}
			
			// add it if it is not
			if (!bInList)
			currencies.push(currency);
		
			return this.saveLocalCurrencies(session, currencies);
		}
		else {
			return Promise.reject('could not retrieve the list of schemes');
		}
	}

	async getCurrencyScheme(session, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!currency)
			return Promise.reject('currency is undefined');
		
		var global = this.global;
		var walletmodule = global.getModuleObject('wallet');

		// we look if the currency has a trade scheme specified
		var currencyschemeuuid = (currency.scheme_uuid ? currency.scheme_uuid : null );
		var scheme;

		if (currencyschemeuuid) {
			// a built-in scheme has been specified in currency definition
			scheme = await walletmodule.getSchemeFromUUID(session, currencyschemeuuid)
			.catch(err => {});
		}
		else {
			// scheme has probably already been created with web3providerurl
			var web3url = currency.web3providerurl;
			scheme = await walletmodule.getSchemeFromWeb3Url(session, web3url)
			.catch(err => {});

			if (!scheme) {
				// if not, we create a local scheme now and save it
				var defaultlocalscheme = await walletmodule.getDefaultScheme(session, 0);
				scheme = await defaultlocalscheme.cloneOnWeb3ProviderUrl(web3url)
				.catch(err => {});
			}
		}
	
		return scheme;
	}

	async getCurrencyWeb3ProviderUrl(session, currency) {
		if (currency.web3providerurl)
			return currency.web3providerurl;
		else {
			var scheme = await this.getCurrencyScheme(session, currency);

			if (scheme)
				return scheme.getWeb3ProviderUrl();
			else
				console.log('currency is badly configured ' + currency.uuid);
		}
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

_GlobalClass.getGlobalObject().registerModuleObject(new Module());

// dependencies
_GlobalClass.getGlobalObject().registerModuleDepency('currencies', 'common');		


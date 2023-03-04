'use strict';

var Module = class {
	
	constructor() {
		this.name = 'ethnode-currencies';
		this.current_version = "standard";
		
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
		
		// look if ethnodecurrenciesloader already created (e.g. for loading in node.js)
		modulescriptloader = global.findScriptLoader('ethnodecurrenciesloader');

		// if not, create on as child as parent script loader passed in argument
		if (!modulescriptloader)
		modulescriptloader = global.getScriptLoader('ethnodecurrenciesloader', parentscriptloader);
		
		
		var xtraroot = './includes';
		
		var interfaceroot = xtraroot + '/interface';

		//modulescriptloader.push_script( interfaceroot + '/wallet-server-access.js');
		
		var moduleroot = xtraroot + '/modules/ethnode';

		// uniswap module
		modulescriptloader.push_script( moduleroot + '/uniswap/module.js');

		
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

		//hooks
		global.registerHook('setSessionNetworkConfig_asynchook', this.name, this.setSessionNetworkConfig_asynchook);
		
		// signal module is ready
		var rootscriptloader = global.getRootScriptLoader();
		rootscriptloader.signalEvent('on_ethnode_currencies_module_ready');
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

	async setSessionNetworkConfig_asynchook(result, params) {
		console.log('setSessionNetworkConfig_asynchook called for ' + this.name);
		
		var global = this.global;
		
		var session = params[0];
		var networkconfig = params[1];

		// we fix the problems of ethnode module version 0.30.10
		// and set things for ethnode module until it handles setSessionNetworkConfig_asynchook
		var ethnodemodule = global.getModuleObject('ethnode');

		var ethnodeserver = (networkconfig.ethnodeserver ? networkconfig.ethnodeserver : {});

		if (ethnodeserver.activate === true) {
			session.overload_ethereum_node_access = true;

			// fix Xtra_EthereumNodeAccess using rest_server_url, which it should not
			// and which not set if storage deactivated
			if (session.getXtraConfigValue('rest_server_url') === ':rest_server_url') {
				session.xtraconfig['rest_server_url'] = ethnodeserver.rest_server_url;
				session.xtraconfig['rest_server_api_path'] = ethnodeserver.rest_server_api_path;

				// reset web3providermap
				session.web3providermap = {};
			}

			// set web3 provider for the local session 
			if (ethnodeserver.web3_provider_url)
			ethnodemodule.setWeb3ProviderUrl(ethnodeserver.web3_provider_url, session,  (err,res) => {
				if (err) {
					console.log('error setting web3 provider url for session ' + session.getSessionUUID() + ': ' + err);
				}
			});
				
			// !!! we do not overload rest_server_url for the moment

			// reset ethereumnodeaccess
			// in case ethereum_node_access_instance has already been instantiated to EthereumNodeAccess
			// and not Xtra_EthereumNodeAccess
			var ethereumnodeaccessmodule = global.getModuleObject('ethereum-node-access');
			
			ethereumnodeaccessmodule.clearEthereumNodeAccessInstance(session);

			// set entry in web3providermap
			// in case enty has already been filled and to avoid wrong ethnode.rest_server
			// when storageserver and ethnodeserver are different
			if (session.web3providermap) {
				let ethnodemodule = global.getModuleObject('ethnode');
				let provider = session.web3providermap[ethnodeserver.web3_provider_url];

				if (!provider) {
					let ethereumnodeaccessinstance = ethnodemodule.getEthereumNodeAccessInstance(session, ethnodeserver.web3_provider_url);

					provider = ethnodemodule.createWeb3ProviderObject(session, ethnodeserver.web3_provider_url, ethereumnodeaccessinstance);
				}

				// change Xtra_EthereumNodeAccess RestConnection
				let ethereumnodeaccessinstance = provider.getEthereumNodeAccessInstance();
				let restconnection = session.createRestConnection(ethnodeserver.rest_server_url, ethnodeserver.rest_server_api_path);

				const Xtra_EthereumNodeAccess = global.getGlobalStoredObject('Xtra_EthereumNodeAccess');

				if (ethereumnodeaccessinstance instanceof Xtra_EthereumNodeAccess !== true) {
					// someone took the spot for web3_provider_url with another type of EthereumNodeAccess
					// (happens when returning from oauth2 login)
					ethereumnodeaccessinstance = new Xtra_EthereumNodeAccess(session);
					ethereumnodeaccessinstance.web3providerurl = ethnodeserver.web3_provider_url; // otherwise an exception is thrown in Web3Provider.getEthereumNodeAccessInstance

					provider.ethereumnodeaccessinstance = ethereumnodeaccessinstance;
				}

				ethereumnodeaccessinstance.setRestConnection(restconnection);
			}

		}
		else if (ethnodeserver.activate === false) {
			session.overload_ethereum_node_access = false;

			// set web3 provider for the local session
			if (ethnodeserver.web3_provider_url)
			ethnodemodule.setWeb3ProviderUrl(ethnodeserver.web3_provider_url, session,  (err,res) => {
				if (err) {
					console.log('error setting web3 provider url for session ' + session.getSessionUUID() + ': ' + err);
				}
			});
		}
		
		result.push({module: this.name, handled: true});
		
		return;
	}	

	//
	// API
	//

	_getClientAPI() {
		if (this.clientapicontrollers)
			return this.clientapicontrollers;
		
		var global = this.global;
		
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
		
		this.clientapicontrollers = mvcclientwalletmodule._getClientAPI();
		
		return  this.clientapicontrollers;
	}


	async getCurrencyEthNodeServer(session, currency) {
		if (!currency)
			return Promise.reject('currency is undefined');

		// look in currency if ethnodeserver is defined
		let ethnodeserver = (currency.ethnodeserver ? currency.ethnodeserver : null);

		if (!ethnodeserver) {
			if (currency.web3providerurl) {
				ethnodeserver = {activate: false, web3_provider_url: currency.web3providerurl};
			}
			else {
				// look in the scheme
				let scheme = await this._getCurrencyScheme(session, currency);

				let networkconfig = scheme.getNetworkConfig();
				
				ethnodeserver = (networkconfig.ethnodeserver ? networkconfig.ethnodeserver : {});
			}
		}
		else {
			if (ethnodeserver.activate === true) {
				// we check a remote scheme has been specified
				if (!currency.scheme_uuid)
					throw 'CONFIGURATION ERROR: currency with uuid ' + currency + ' does not have a scheme uuid!!!';
				else {
					let scheme = await this._getCurrencyScheme(session, currency);

					if (!scheme.isRemote())
						throw 'CONFIGURATION ERROR: currency with uuid ' + currency + ' specifies a scheme uuid that is not remote!!!';
				}
			}
		}

		if (!ethnodeserver.uuid)
			ethnodeserver.uuid = currency.uuid; // give uuid of currency to help putting ethnodeserver in maps

		return ethnodeserver;
	}

	async getCurrencyWeb3ProviderUrl(session, currency) {
		var ethnodeserver = await this.getCurrencyEthNodeServer(session, currency)

		if (ethnodeserver)
			return ethnodeserver.web3_provider_url;
		else
			console.log('currency is badly configured ' + currency.uuid);
	}

	async _setMonitoredEthereumNodeAccess(session, ethnodeserver) {
		var global = this.global;
		
		if (ethnodeserver.web3_provider_url) {
			var ethnodemodule = global.getModuleObject('ethnode');
			let web3provider = ethnodemodule.getWeb3ProviderObject(session, ethnodeserver.web3_provider_url);
			let ethereumnodeaccessinstance;

			if (web3provider) {
				ethereumnodeaccessinstance = web3provider.getEthereumNodeAccessInstance();
			}
			else {
				// provider not created yet				
				let ethnodemodule = global.getModuleObject('ethnode');

				if (ethnodeserver.activate) {
					const Xtra_EthereumNodeAccess = global.getGlobalStoredObject('Xtra_EthereumNodeAccess');

					ethereumnodeaccessinstance = new Xtra_EthereumNodeAccess(session);
					ethereumnodeaccessinstance.web3providerurl = ethnodeserver.web3_provider_url; // otherwise an exception is thrown in Web3Provider.getEthereumNodeAccessInstance

					let restconnection = session.createRestConnection(ethnodeserver.rest_server_url, ethnodeserver.rest_server_api_path);
					ethereumnodeaccessinstance.setRestConnection(restconnection);
				}
				else {
					ethereumnodeaccessinstance = ethnodemodule.getEthereumNodeAccessInstance(session, ethnodeserver.web3_provider_url);
				}

				web3provider = ethnodemodule.createWeb3ProviderObject(session, ethnodeserver.web3_provider_url, ethereumnodeaccessinstance);
				ethnodemodule.putWeb3ProviderObject(session, web3provider);
			}

			// set the legacy implicit values stored in session
			session.ethereum_node_access_instance = ethereumnodeaccessinstance;
			session.web3providerurl = ethnodeserver.web3_provider_url;
		}
	}

	_canWalletHandleScheme(wallet, scheme) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		return currenciesmodule._canWalletHandleScheme(wallet, scheme);
	}

	async _createDummyWalletSession(walletsession) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		var fetchsession = await currenciesmodule._createDummyProxySession(walletsession);

		// specific to ethnode
		var ethnodemodule = global.getModuleObject('ethnode');
		var erc20module = global.getModuleObject('erc20');
		fetchsession.contracts = ethnodemodule.getContractsObject(fetchsession);
		// register TokenERC20 in the contracts object
		fetchsession.contracts.registerContractClass('TokenERC20', erc20module.ERC20Token);

		fetchsession.web3providermap = walletsession.web3providermap;

		return fetchsession;		
	}

	async _getCurrencyScheme(session, currency) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		return currenciesmodule.getCurrencyScheme(session, currency);
	}

	_getCurrencySessionMap(session) {
		var currencysessionmap = session.getSessionVariable('currencysessionmap');
		
		if (!currencysessionmap) {
			currencysessionmap = Object.create(null);
			session.setSessionVariable('currencysessionmap', currencysessionmap);
		}

		return currencysessionmap;
	}

	async _getChildSessionOnCurrency(parentsession, currency) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		if (!parentsession)
			return Promise.reject('could not create child of null session');

		var currencysessionmap = this._getCurrencySessionMap(parentsession);
		
		// we could look if a pre-existing session with corresponding web3providerurl could be re-used
		var currencyuuid = currency.uuid;

		if (currencysessionmap[currencyuuid])
			return currencysessionmap[currencyuuid];

		// else we create one and set it
		var childsession = await _apicontrollers.createChildSessionObject(parentsession);
		childsession.MYCURRENCY = this.current_version;

		if (!parentsession.MYCURRENCY_ROOT)
			parentsession.MYCURRENCY_ROOT = (this.current_version ? this.current_version : 'xxx');

		var scheme = await this._getCurrencyScheme(parentsession, currency);
		
		if (scheme.isRemote())
			childsession.overload_ethereum_node_access = true;
		else
			childsession.overload_ethereum_node_access = false;

		// set ethnode context
		let ethnodeserver = await this.getCurrencyEthNodeServer(parentsession, currency);
		await this._setMonitoredEthereumNodeAccess(childsession, ethnodeserver);

		// call setSessionNetworkConfig that will invoke setSessionNetworkConfig_hook
		var networkconfig = scheme.getNetworkConfig();

		await _apicontrollers.setSessionNetworkConfig(childsession, networkconfig);

		currencysessionmap[currencyuuid] = childsession;

		return childsession;
	}

	async _getMonitoredCurrencySession(session, wallet, currency) {
		var fetchsession;

		var global = this.global;

		var scheme = await this._getCurrencyScheme(session, currency);

		if (!scheme)
			return Promise.reject('scheme is not defined');

		if (scheme.isRemote()) {
			if (wallet) {
				var walletschemeuuid = wallet.getSchemeUUID();
				var schemeuuid = scheme.getSchemeUUID();
	
				if (this._canWalletHandleScheme(wallet, scheme)) {
					// use wallet session
					let walletsession = wallet._getSession();
					var currencysessionmap = this._getCurrencySessionMap(walletsession);

					fetchsession = currencysessionmap[currency.uuid];

					if (!fetchsession) {
						// FIX v0.30.10: since version 0.30.10 does not pass web3providerurl to lower levels functions
						// and relies on session.ethereum_node_access_instance in getEthereumNodeAccessInstance(session)
						fetchsession = await this._createDummyWalletSession(walletsession);
						fetchsession.DUMMY_SESSION_CURRENCY = currency;
						fetchsession.DUMMY_SESSION_WALLET = wallet;
						currencysessionmap[currency.uuid] = fetchsession;

						let ethnodeserver = await this.getCurrencyEthNodeServer(session, currency);
						await this._setMonitoredEthereumNodeAccess(fetchsession, ethnodeserver);
					}
				}
				else {
					return Promise.reject('ERR_MISSING_CREDENTIALS');
				}
			}
			else {
				return Promise.reject('ERR_MISSING_CREDENTIALS');
			}
		}
		else {
			if (wallet) {
				var walletsession = wallet._getSession();
				fetchsession = await this._getChildSessionOnCurrency(walletsession, currency);
			}
			else {
				fetchsession = await this._getChildSessionOnCurrency(session, currency);
			}
		}

		return fetchsession;
	}

	_canCardHandleScheme(card, scheme) {
		if (!card || !scheme)
			return false;

		if (scheme.isRemote()) {
			var cardschemeuuid = card.getSchemeUUID();

			// TODO: we could look if authserver are the same
			if (cardschemeuuid && (cardschemeuuid === scheme.getSchemeUUID()))
				return true;
			else
				return false;
		}
		else {
			return true;
		}
	}

	async _createDummyCardSession(cardsession) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		var dummysession = await currenciesmodule._createDummyProxySession(cardsession);

		// specific to ethnode
		var ethnodemodule = global.getModuleObject('ethnode');
		var erc20module = global.getModuleObject('erc20');
		dummysession.contracts = ethnodemodule.getContractsObject(dummysession);
		// register TokenERC20 in the contracts object
		dummysession.contracts.registerContractClass('TokenERC20', erc20module.ERC20Token);

		dummysession.web3providermap = cardsession.web3providermap;

		return dummysession;		
	}

	_getCardCurrencySessionMap(session, card, currency) {
		var currencysessionmap
		
		if (card) {
			// we specify different currency maps by carduuid
			// in case different cards share the same session (e.g. wallet's session)
			// and so to avoid collisions
			let cardsessionmap = session.getSessionVariable('cardsessionmap');

			if (!cardsessionmap) {
				cardsessionmap = Object.create(null);
				session.setSessionVariable('cardsessionmap', cardsessionmap);
			}

			let carduuid = card.getCardUUID();
			let cardcurrencysessionmap = cardsessionmap[carduuid];

			if (!cardcurrencysessionmap) {
				cardcurrencysessionmap = Object.create(null);
				cardsessionmap[carduuid] = cardcurrencysessionmap;
			}

			currencysessionmap = cardcurrencysessionmap;

		}
		else {
			currencysessionmap = this._getCurrencySessionMap(session, currency);
		}

		return currencysessionmap;
	}

	async _getChildSessionOnCardCurrency(parentsession, card, currency) {
		if (!card) {
			return this._getChildSessionOnCurrency(parentsession, currency);
		}


		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		if (!parentsession)
			return Promise.reject('could not create child of null session');

		var currencysessionmap = this._getCardCurrencySessionMap(parentsession, card, currency);
		
		// we could look if a pre-existing session with corresponding web3providerurl could be re-used
		var currencyuuid = currency.uuid;

		if (currencysessionmap[currencyuuid])
			return currencysessionmap[currencyuuid];

		// else we create one and set it
		var childsession = await _apicontrollers.createChildSessionObject(parentsession);
		childsession.MYCURRENCY = this.current_version;

		if (!parentsession.MYCURRENCY_ROOT)
			parentsession.MYCURRENCY_ROOT = (this.current_version ? this.current_version : 'xxx');

		var scheme = await this._getCurrencyScheme(parentsession, currency);
		
		if (scheme.isRemote())
			childsession.overload_ethereum_node_access = true;
		else
			childsession.overload_ethereum_node_access = false;

		// set ethnode context
		let ethnodeserver = await this.getCurrencyEthNodeServer(parentsession, currency);
		await this._setMonitoredEthereumNodeAccess(childsession, ethnodeserver);

		// call setSessionNetworkConfig that will invoke setSessionNetworkConfig_hook
		var networkconfig = scheme.getNetworkConfig();

		await _apicontrollers.setSessionNetworkConfig(childsession, networkconfig);

		currencysessionmap[currencyuuid] = childsession;

		return childsession;
	}

	async _getMonitoredCardSessionForCurrency(session, wallet, card, currency) {
		var fetchsession;

		var global = this.global;

		var scheme = await this._getCurrencyScheme(session, currency);

		if (!scheme)
			return Promise.reject('scheme is not defined');

		if (scheme.isRemote()) {
			if (card) {
	
				if (this._canCardHandleScheme(card, scheme)) {
					// use wallet session
					let cardsession = card._getSession();
					var currencysessionmap = this._getCardCurrencySessionMap(cardsession, card, currency);

					fetchsession = currencysessionmap[currency.uuid];

					if (!fetchsession) {
						// FIX v0.30.10: since version 0.30.10 does not pass web3providerurl to lower levels functions
						// and relies on session.ethereum_node_access_instance in getEthereumNodeAccessInstance(session)
						fetchsession = await this._createDummyCardSession(cardsession);
						fetchsession.DUMMY_SESSION_CURRENCY = currency;
						fetchsession.DUMMY_SESSION_CARD = card;
						currencysessionmap[currency.uuid] = fetchsession;

						let ethnodeserver = await this.getCurrencyEthNodeServer(session, currency);
						await this._setMonitoredEthereumNodeAccess(fetchsession, ethnodeserver);
					}
				}
				else {
					return Promise.reject('ERR_MISSING_CREDENTIALS');
				}
			}
			else {
				return Promise.reject('ERR_MISSING_CREDENTIALS');
			}
		}
		else {
			if (card) {
				var cardsession = card._getSession();
				fetchsession = await this._getChildSessionOnCardCurrency(cardsession, card, currency);
			}
			else {
				fetchsession = await this._getChildSessionOnCurrency(session, currency);
			}
		}

		return fetchsession;
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
_GlobalClass.getGlobalObject().registerModuleDepency('ethnode-currencies', 'common');		


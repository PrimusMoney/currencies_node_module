'use strict';

var currencies;

class Currencies {
	constructor() {
		this.load = null;
		
		this.initializing = false;
		this.initialized = false;
		
		this.initializationpromise = null;
		
		var Ethereum_core = require('@p2pmoney-org/ethereum_core');
		var Ethereum_erc20 = require('@p2pmoney-org/ethereum_erc20');
		var Ethereum_xtra_web = require('@p2pmoney-org/ethereum_xtra_web');
		//var Ethereum_core = require('../../@p2pmoney-org/ethereum_core');
		//var Ethereum_erc20 = require('../../@p2pmoney-org/ethereum_erc20');
		//var Ethereum_xtra_web = require('../../@p2pmoney-org/ethereum_xtra_web');
		
		var PrimusMoney_ethereum_xtra_web = require('@primusmoney/ethereum_xtra_web');
		var PrimusMoney_client_wallet= require('@primusmoney/client_wallet');
		//var PrimusMoney_ethereum_xtra_web = require('../../@primusmoney/ethereum_xtra_web');
		//var PrimusMoney_client_wallet= require('../../@primusmoney/client_wallet');
		
		this.ethereum_core = Ethereum_core.getObject();
		this.ethereum_erc20 = Ethereum_erc20.getObject();
		this.ethereum_xtra_web = Ethereum_xtra_web.getObject();

		this.primus_ethereum_xtra_web = PrimusMoney_ethereum_xtra_web.getObject();
		this.primus_client_wallet = PrimusMoney_client_wallet.getObject();
	}
	
	getVersion() {
		var packagejson = require('./package.json');
		return packagejson.version;
	}
	
	async init(callback) {
		console.log('@primusmoney/currencies init called');
		
		if (this.initialized) {
			console.log('module @primusmoney/currencies is already initialized.');
			return true;
		}
		
		if (this.initializing ) {
			console.log('module @primusmoney/currencies is already initializing. Wait till it\'s ready.');
			return this.initializationpromise;
		}

		// @p2pmoney dependencies
		var ethereum_core = this.ethereum_core;
		var ethereum_erc20 = this.ethereum_erc20;
		var ethereum_xtra_web = this.ethereum_xtra_web;
		
		if (ethereum_core.initialized === false) {
			await ethereum_core.init();
		}

		if (ethereum_erc20.initialized === false) {
			await ethereum_erc20.init();
		}

		if (ethereum_xtra_web.initialized === false) {
			await ethereum_xtra_web.init();
		}

		// @primusmoney dependencies
		var primus_ethereum_xtra_web = this.primus_ethereum_xtra_web;

		if (primus_ethereum_xtra_web.initialized === false) {
			await primus_ethereum_xtra_web.init();
		}

		var primus_client_wallet = this.primus_client_wallet;

		if (primus_client_wallet.initialized === false) {
			await primus_client_wallet.init();
		}


		// create loader
		if (typeof window !== 'undefined') {
			if (typeof document !== 'undefined' && document ) {
				// we are in a browser
				console.log('loading for browser');
				
				var BrowserLoad = require( './js/browser-load.js');

				this.load = new BrowserLoad(this);
			}
			else {
				// we are in react-native
				console.log('loading for react-native');
				
				var ReactNativeLoad = require( './js/react-native-load.js');

				this.load = new ReactNativeLoad(this);
			}	
		}
		else if (typeof global !== 'undefined') {
			console.log('loading for nodejs');
			
			// we are in nodejs
			var NodeLoad = require( './js/node-load.js');
			
			this.load = new NodeLoad(this);
		}

		var self = this;
		var promise;
		
		if (this.initializing === false) {
			
			this.initializationpromise = new Promise(function (resolve, reject) {
				self.load.init(function() {
				console.log('@primusmoney/currencies init finished');
				self.initialized = true;
				
				if (callback)
					callback(null, true);
				
				resolve(true);
				});
			});
			
			this.initializing = true;
		}
		
		return this.initializationpromise;
	}
	
	getGlobalObject() {
		if (typeof window !== 'undefined') {
			// we are in a browser or react-native
			return window.simplestore.Global.getGlobalObject();
		}
		else if (typeof global !== 'undefined') {
			// we are in nodejs
			return global.simplestore.Global.getGlobalObject();
		}
		
	}
	
	getControllersObject() {
		return require('./js/control/controllers.js').getObject();
	}

	getClientAPI() {
		var global = this.getGlobalObject();

		var clientsmodule = global.getModuleObject('clientmodules');

		var clientapicontrollers = clientsmodule.getControllersObject();

		return clientapicontrollers;
	}
	
	// static methods
	static getObject() {
		if (currencies)
			return currencies;
		
			currencies = new Currencies();
		
		return currencies;
	}
}

module.exports = Currencies;
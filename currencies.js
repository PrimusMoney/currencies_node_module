'use strict';

var currencies;

class Currencies {
	constructor() {
		this.load = null;
		
		this.initializing = false;
		this.initialized = false;
		
		this.initializationpromise = null;
		
		//var PrimusMoney_client_wallet= require('@primusmoney/client_wallet');
		var PrimusMoney_client_wallet= require('../../@primusmoney/client_wallet');
		
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

		// @primusmoney dependencies
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

	getMvcAPI() {
		var clientglobal = this.getGlobalObject();
		
		var mvcmodule = clientglobal.getModuleObject('mvc-currencies');

		return mvcmodule;
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
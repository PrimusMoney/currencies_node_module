'use strict';

console.log('node-load.js');

class CheckModulesLoad {
	constructor(rootscriptloader, signalstring) {
		this.rootscriptloader = rootscriptloader;
		this.array = [];

		this.signalsent = false;
		this.signalstring = signalstring;
	}

	wait(modulename) {
		this.array.push({name: modulename, loaded: false});
	}

	check(modulename) {
		var arr = this.array;

		if (modulename) {
			for (var i = 0; i < arr.length; i++) {
				var entry = arr[i];
	
				if (entry.name == modulename) {
					entry.loaded = true;
					break;
				}
			}
		}

		for (var i = 0; i < arr.length; i++) {
			var entry = arr[i];

			if (entry.loaded !== true)
				return;
		}

		if (this.signalsent)
		return;
		
		// mark loads have finished
		var rootscriptloader = this.rootscriptloader;
		
		rootscriptloader.signalEvent(this.signalstring);
		this.signalsent = true;
	}
}


class NodeLoad {
	constructor(node_module) {
		this.name = 'nodeload';
		
		this.node_module = node_module;
	}
	
	init(callback) {
		console.log('NodeLoad.init called');
		
		try {
			var self = this;
			var _globalscope = global; // nodejs global
			var _noderequire = require; // to avoid problems when react-native processes files
			
			// get primus_client_wallet
			var primus_client_wallet = this.node_module.primus_client_wallet;
			
			if (primus_client_wallet.initialized === false) {
				console.log('WARNING: @primusmone/client_wallet should be initialized before initializing @primusmoney/currencies');
			}
			
			// get node module objects
			var Bootstrap = _globalscope.simplestore.Bootstrap;
			var ScriptLoader = _globalscope.simplestore.ScriptLoader;
	
			var bootstrapobject = Bootstrap.getBootstrapObject();
			var rootscriptloader = ScriptLoader.getRootScriptLoader();
			
			var GlobalClass = _globalscope.simplestore.Global;
	
			// loading dapps
			let modulescriptloader = ScriptLoader.findScriptLoader('moduleloader');
			
			let currenciesmodulescriptloader = modulescriptloader.getChildLoader('@primusmoney/currencies');
			
			// setting script root dir to this node module
			// instead of ethereum_core/imports
			var path = _noderequire('path');
			var script_root_dir = path.join(__dirname, '../imports');
			currenciesmodulescriptloader.setScriptRootDir(script_root_dir);
			
			//modulescriptloader.setScriptRootDir(script_root_dir); // because xtra_web uses modulescriptloader instead of currenciesmodulescriptloader

			// multiple module load signalling
			var checkmodulesload = new CheckModulesLoad(rootscriptloader, '@primusmoney/on_primus_currencies_module_ready');

			

	
			// currencies modules (with an s!)
			ScriptLoader.reclaimScriptLoaderName('currenciesmodulesloader'); // in case another node module used this name
			currenciesmodulescriptloader.getChildLoader('currenciesmodulesloader'); // create loader with correct root dir

			currenciesmodulescriptloader.push_script('./includes/modules/module.js', function () {
				console.log('currencies modules loaded');
			});

			// currencies modules ready (sent by currenciesmodules module at the end of registerHooks)
			checkmodulesload.wait('currenciesmodules');
			rootscriptloader.registerEventListener('on_currencies_modules_ready', function(eventname) {
				checkmodulesload.check('currenciesmodules');
			});




			// currencies module (without an s!)
			ScriptLoader.reclaimScriptLoaderName('currenciesloader'); // in case another node module used this name
			currenciesmodulescriptloader.getChildLoader('currenciesloader'); // create loader with correct root dir

			currenciesmodulescriptloader.push_script('./includes/modules/currencies/module.js', function () {
				console.log('currencies module loaded');
			});

			// currencies module ready (sent by clientmodules module at the end of registerHooks)
			checkmodulesload.wait('currencies');
			rootscriptloader.registerEventListener('on_currencies_module_ready', function(eventname) {
				checkmodulesload.check('currencies');
			});


			
			// uniswap
			ScriptLoader.reclaimScriptLoaderName('uniswaploader'); // in case another node module used this name
			currenciesmodulescriptloader.getChildLoader('uniswaploader'); // create loader with correct root dir

			currenciesmodulescriptloader.push_script('./includes/modules/uniswap/module.js', function () {
				console.log('uniswap module loaded');
			});

			// uniswap module ready (sent by uniswap module at the end of registerHooks)
			checkmodulesload.wait('uniswap');
			rootscriptloader.registerEventListener('on_uniswap_module_ready', function(eventname) {
				checkmodulesload.check('uniswap');
			});


			// mvc-currencies module
			ScriptLoader.reclaimScriptLoaderName('mvccurrenciesmoduleloader'); // in case another node module used this name
			currenciesmodulescriptloader.getChildLoader('mvccurrenciesmoduleloader'); // create loader with correct root dir

			currenciesmodulescriptloader.push_script('./includes/mvc-api/module.js', function () {
				console.log('mvc currencies module loaded');
			});

			// mvc-currencies module ready (sent by mvc-currencies module at the end of registerHooks)
			checkmodulesload.wait('mvccurrenciesmodule');
			rootscriptloader.registerEventListener('on_mvc_currencies_module_ready', function(eventname) {
				checkmodulesload.check('mvccurrenciesmodule');
			});
						
			

			
				
			// start loading currenciesmodulescriptloader
			currenciesmodulescriptloader.load_scripts(function () {
				var _nodeobject = GlobalClass.getGlobalObject();
				
				// loading xtra pushed in currenciesmodulescriptloader
				currenciesmodulescriptloader.load_scripts(function() {
					checkmodulesload.check();
				});
			});

			
			// end of modules load
			rootscriptloader.registerEventListener('@primusmoney/on_primus_currencies_module_ready', function(eventname) {
				if (callback)
					callback(null, self);
			});
	
		}
		catch(e) {
			console.log('exception in NodeLoad.init: ' + e);
			console.log(e.stack);
		}


	}
		
}


module.exports = NodeLoad;





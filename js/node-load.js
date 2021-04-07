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
			
			// get ethereum_core
			var ethereum_core = this.node_module.ethereum_core;
			
			if (ethereum_core.initialized === false) {
				console.log('WARNING: ethereum_core should be initialized before initializing ethereum_xtra_web');
			}
			
			// get node module objects
			var Bootstrap = _globalscope.simplestore.Bootstrap;
			var ScriptLoader = _globalscope.simplestore.ScriptLoader;
	
			var bootstrapobject = Bootstrap.getBootstrapObject();
			var rootscriptloader = ScriptLoader.getRootScriptLoader();
			
			var GlobalClass = _globalscope.simplestore.Global;
	
			// loading dapps
			let modulescriptloader = ScriptLoader.findScriptLoader('moduleloader');
			
			let xtra_webmodulescriptloader = modulescriptloader.getChildLoader('@primusmoney/currencies');
			
			// setting script root dir to this node module
			// instead of ethereum_core/imports
			var path = _noderequire('path');
			var script_root_dir = path.join(__dirname, '../imports');
			xtra_webmodulescriptloader.setScriptRootDir(script_root_dir);
			
			//modulescriptloader.setScriptRootDir(script_root_dir); // because xtra_web uses modulescriptloader instead of xtra_webmodulescriptloader

			// multiple module load signalling
			var checkmodulesload = new CheckModulesLoad(rootscriptloader, '@primusmoney/on_primus_currencies_module_ready');
			
	
			// xtraconfig
			ScriptLoader.reclaimScriptLoaderName('xtraconfig'); // already used by ethereum_core
			ScriptLoader.reclaimScriptLoaderName('xtramoduleloader'); // already used by ethereum_core
			ScriptLoader.reclaimScriptLoaderName('xtraconfigmoduleloader'); // already used by ethereum_core
			var xtrawebscriptloader = xtra_webmodulescriptloader.getChildLoader('@primusmoney/currencies');
			
			// clients module
			ScriptLoader.reclaimScriptLoaderName('clientmodulesloader'); // in case another node module used this name
			xtrawebscriptloader.getChildLoader('clientmodulesloader'); // create loader with correct root dir

			xtrawebscriptloader.push_script('./includes/modules/module.js', function () {
				console.log('clients module loaded');
			});

			// clientmodules module ready (sent by clientmodules module at the end of registerHooks)
			checkmodulesload.wait('clientsmodule');
			rootscriptloader.registerEventListener('on_clientmodules_module_ready', function(eventname) {
				checkmodulesload.check('clientsmodule');
			});

				
			// synchronized storage module
			ScriptLoader.reclaimScriptLoaderName('synchronizedmoduleloader'); // in case another node module used this name
			xtrawebscriptloader.getChildLoader('synchronizedmoduleloader'); // create loader with correct root dir

			xtrawebscriptloader.push_script('./includes/modules/synchronized-storage/module.js', function () {
				console.log('synchronized storage module loaded');
			});

			// synchronized-storage module ready (sent by synchronized-storage module at the end of registerHooks)
			checkmodulesload.wait('synchronized-storage');
			rootscriptloader.registerEventListener('on_synchronized-storage_module_ready', function(eventname) {
				checkmodulesload.check('synchronized-storage');
			});
				
			// wallet module
			ScriptLoader.reclaimScriptLoaderName('walletloader'); // in case another node module used this name
			xtrawebscriptloader.getChildLoader('walletloader'); // create loader with correct root dir

			xtrawebscriptloader.push_script('./includes/modules/wallet/module.js', function () {
				console.log('wallet module loaded');
			});

			// wallet module ready (sent by wallet module at the end of registerHooks)
			checkmodulesload.wait('wallet');
			rootscriptloader.registerEventListener('on_wallet_module_ready', function(eventname) {
				checkmodulesload.check('wallet');
			});
				
				
			// start loading xtra_webmoduleloader
			xtra_webmodulescriptloader.load_scripts(function () {
				var _nodeobject = GlobalClass.getGlobalObject();
				
				// loading xtra pushed in xtrawebscriptloader
				xtrawebscriptloader.load_scripts(function() {
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





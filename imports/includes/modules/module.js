'use strict';

var Module = class {
	constructor() {
		this.name = 'currenciesmodules';
		this.current_version = "0.30.15.2023.02.22";
		
		this.global = null; // put by global on registration
		this.isready = false;
		this.isloading = false;
		
		this.controllers = null;

	}
	
	init() {
		console.log('module init called for ' + this.name);
		
		this.isready = true;
	}
	
	// compulsory  module functions
	loadModule(parentscriptloader, callback) {
		console.log('loadModule called for module ' + this.name);
		
		if (this.isloading)
			return;
			
		this.isloading = true;

		var self = this;
		var global = this.global;

		// clients module script loader
		var modulescriptloader;
		
		// look if currenciesloader already created (e.g. for loading in node.js)
		modulescriptloader = global.findScriptLoader('currenciesmodulesloader');

		// if not, create on as child as parent script loader passed in argument
		if (!modulescriptloader)
		modulescriptloader = parentscriptloader.getChildLoader('currenciesmodulesloader');

		var xtraroot = './includes';
		var moduleroot = xtraroot + '/modules';

		modulescriptloader.push_script( moduleroot + '/control/controllers.js');

		modulescriptloader.load_scripts(function() { self.init(); if (callback) callback(null, self);});

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
		
		global.registerHook('getVersionInfo_hook', this.name, this.getVersionInfo_hook);
		global.modifyHookPriority('getVersionInfo_hook', this.name, -7);
		
		
		// signal module is ready
		var rootscriptloader = global.getRootScriptLoader();
		rootscriptloader.signalEvent('on_currencies_modules_ready');
	}
	
	postRegisterModule() {
		console.log('postRegisterModule called for ' + this.name);
		if (!this.isloading) {
			var global = this.global;
			var self = this;
			var rootscriptloader = global.getRootScriptLoader();
			
			this.loadModule(rootscriptloader, () => {
				if (this.registerHooks)
				this.registerHooks();
			});
		}
	}
	
	
	//
	// hooks
	//
	getVersionInfo_hook(result, params) {
		console.log('getVersionInfo_hook called for ' + this.name);
		
		var global = this.global;
		var _globalscope = global.getExecutionGlobalScope();
		var Constants = _globalscope.simplestore.Constants;
		var module_versioninfo = this.current_version;
		
		var versioninfos = params[0];
		
		var versioninfo = {};
		
		versioninfo.label = global.t('currencies');
		versioninfo.value = (module_versioninfo ? module_versioninfo : global.t('unknown'));
		
		versioninfos.push(versioninfo);

		
		result.push({module: this.name, handled: true});
		
		return true;
	}

	// api functions
	
	//
	// control
	//
	
	getControllersObject() {
		if (this.controllers)
			return this.controllers;
		
		this.controllers = new this.Controllers(this);
		
		return this.controllers;
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
_GlobalClass.getGlobalObject().registerModuleDepency('currenciesmodules', 'common');
_GlobalClass.getGlobalObject().registerModuleDepency('currenciesmodules', 'clientmodules');

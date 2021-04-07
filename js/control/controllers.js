'use strict';

var modulecontrollers;

var ModuleControllers = class {
	
	constructor() {
		this.module = null;
		
		this.client_wallet = require('@primusmoney/client_wallet').getObject();
		//this.client_wallet = require('../../../client_wallet').getObject();
		this.ethereum_core = this.client_wallet.ethereum_core;
		
		this.global = this.client_wallet.getGlobalObject();

		this.session = null;
	}
	
	

	
	// static
	static getObject() {
		if (modulecontrollers)
			return modulecontrollers;
		
		modulecontrollers = new ModuleControllers();
		
		return modulecontrollers;
	}
}

module.exports = ModuleControllers; 
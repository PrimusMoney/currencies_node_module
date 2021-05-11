'use strict';

var modulecontrollers;

var ModuleControllers = class {
	
	constructor(module) {
		this.module = module;
		
		this.global = module.global;
	}

	//
	// Currencies modules gateway
	//

	/***********************/
	/*  currencies module  */
	/***********************/

	async createCurrencyAmount(session, currency, position) {
		var global = this.global;
		var CurrencyAmountClass = global.getModuleClass('currencies', 'CurrencyAmount');
		return CurrencyAmountClass.create(session, currency, position);
	}

	async createDecimalAmount(session, amount, decimals) {
		var global = this.global;
		var DecimalAmountClass = global.getModuleClass('currencies', 'DecimalAmount');
		return DecimalAmountClass.create(session, amount, decimals);
	}

	async getCurrencyScheme(session, currency) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');

		return currenciesmodule.getCurrencyScheme(session, currency)
	}

	/***********************/
	/*    uniswap module   */
	/***********************/
	
	async getPriceForOutput(session, scheme, token1, token2, token2amount, uniswap_conf) {
		var global = this.global;
		var swapmodule = global.getModuleObject('uniswap');
		return swapmodule.getPriceForOutput(session, scheme, token1, token2, token2amount, uniswap_conf);
	}
	
	/***********************/
	/*     static          */
	/***********************/

	// static
	static getObject() {
		if (modulecontrollers)
			return modulecontrollers;
		
		modulecontrollers = new ModuleControllers();
		
		return modulecontrollers;
	}
}

if ( typeof window !== 'undefined' && typeof window.GlobalClass !== 'undefined' && window.GlobalClass ) {
	window.GlobalClass.registerModuleClass('currenciesmodules', 'Controllers', ModuleControllers);
}
else if (typeof window !== 'undefined') {
	let _GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
	
	_GlobalClass.registerModuleClass('currenciesmodules', 'Controllers', ModuleControllers);
}
else if (typeof global !== 'undefined') {
	// we are in node js
	let _GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
	
	_GlobalClass.registerModuleClass('currenciesmodules', 'Controllers', ModuleControllers);
}
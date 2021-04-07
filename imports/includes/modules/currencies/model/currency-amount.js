'use strict';

var CurrencyAmount = class {
	constructor(session, currency, amount) {
		this.session = session;
		this.currency = currency;

		var global = session.getGlobalObject();
		var DecimalAmountClass = global.getModuleClass('currencies', 'DecimalAmount');

		this.decimalamount = new DecimalAmountClass(session, amount, currency.decimals);
	}

	async getDecimalAmount() {
		return this.decimalamount;
	}

	async toString() {
		return this.decimalamount.toString();
	}

	async toInteger() {
		return this.decimalamount.toInteger();
	}

	async multiply(multiplier) {
		await this.decimalamount.multiply(multiplier);

		 return this;
	}

	async toDecoratedString(options) {
		var session = this.session;
		var global = session.getGlobalObject();
		var mvcmyquotemodule = global.getModuleObject('mvc-myquote');

		var amount = await this.decimalamount.toInteger();
		var symbol = this.currency.symbol;
		var decimals = this.currency.decimals;
		
		var amountstring = await mvcmyquotemodule._formatMonetaryAmount(session, amount, symbol, decimals, options);

		return amountstring;
	}




	static async create(session, currency, amount) {
		// analyse amount type transform it to integer
		return new CurrencyAmount(session, currency, amount);
	}
}

if (typeof window !== 'undefined') {
	let _GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
	
	_GlobalClass.registerModuleClass('currencies', 'CurrencyAmount', CurrencyAmount);
}
else if (typeof global !== 'undefined') {
	// we are in node js
	let _GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
	
	_GlobalClass.registerModuleClass('currencies', 'CurrencyAmount', CurrencyAmount);
}
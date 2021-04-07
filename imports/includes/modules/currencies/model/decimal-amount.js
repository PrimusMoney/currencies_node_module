'use strict';

var DecimalAmount = class {
	constructor(session, amount, decimals) {
		this.session = session;
		this.amount = amount;
		this.decimals = decimals;
		
 		var global = session.getGlobalObject();
		var _globalscope = global.getExecutionGlobalScope();
		var _simplestore = _globalscope.simplestore;

		this.BigNumber = _simplestore.BigNumber;
		this.bignumber = new this.BigNumber(amount);
		
	}

	async equals(decimalamount) {
		var amount_int = await this.toInteger();
		var decimalamount_int = await decimalamount.toInteger();

		if (amount_int === decimalamount_int)
			return true;
		else
			return false;
	}

	async toString() {
		var amountstring = (this.amount ? this.amount.toString() : '-1');

		return amountstring;
	}

	async toInteger() {
		var amountstring = await this.toString();
		return parseInt(amountstring);
	}

	async toFixedString() {
		var session = this.session;
		var global = session.getGlobalObject();
		var mvcmyquotemodule = global.getModuleObject('mvc-myquote');
		var amountstring = await mvcmyquotemodule._formatAmount(session, (this.amount !== undefined ? this.amount : 0), this.decimals);

		return amountstring;
	}

	async multiply(multiplier) {
		this.amount = multiplier * this.amount;

		this.bignumber.multipliedBy(multiplier);

		var _mnt = this.bignumber.integerValue();

		return this;
	}

	static async create(session, amount, decimals) {
		// analyse amount type transform it to integer
		return new DecimalAmount(session, amount, decimals);
	}
}

if (typeof window !== 'undefined') {
	let _GlobalClass = ( window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
	
	_GlobalClass.registerModuleClass('currencies', 'DecimalAmount', DecimalAmount);
}
else if (typeof global !== 'undefined') {
	// we are in node js
	let _GlobalClass = ( global && global.simplestore && global.simplestore.Global ? global.simplestore.Global : null);
	
	_GlobalClass.registerModuleClass('currencies', 'DecimalAmount', DecimalAmount);
}
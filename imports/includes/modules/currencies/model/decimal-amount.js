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
		var amountstring = (this.amount ? this.amount.toString() : '0');

		return amountstring;
	}

	async toInteger() {
		var amountstring = await this.toString();
		return parseInt(amountstring);
	}

	async toFixedString() {
		var session = this.session;

		var amountstring = await this._formatAmount(session, (this.amount !== undefined ? this.amount : 0), this.decimals);

		return amountstring;
	}

	async multiply(multiplier) {
		this.amount = multiplier * this.amount;

		this.bignumber.multipliedBy(multiplier);

		var _mnt = this.bignumber.integerValue();

		return this;
	}

	async add(decimalamount) {
		if ((decimalamount instanceof DecimalAmount) !== true)
			return Promise.reject('wrong decimal amount type');

		this.amount += decimalamount.amount;

		this.bignumber.plus(decimalamount.amount);

		var _mnt = this.bignumber.integerValue();

		return this;
	}

	static async create(session, amount, decimals) {
		// analyse amount type transform it to integer
		return new DecimalAmount(session, amount, decimals);
	}

	async _formatAmount(session, amount, decimals, options) {
		if (amount === undefined)
			return;
		
		var _inputamountstring = amount.toString();
		var amountstring;
		
		if (_inputamountstring.length > decimals) {
			// integer part
			var integerpart = _inputamountstring.substring(0, _inputamountstring.length - decimals);

			amountstring = integerpart + '.' + _inputamountstring.substring(_inputamountstring.length - decimals);
		}
		else {
			var leading = '';
			for (var i = 0; i < (decimals -_inputamountstring.length) ; i++) leading += '0';
			amountstring = '0.' + leading + _inputamountstring;
		}

		if (options) {
			if (typeof options.showdecimals !== 'undefined') {
				if (options.showdecimals === false) {
					// we remove . and after
					amountstring = amountstring.substring(0, amountstring.indexOf('.'));
				}
				else {
					var decimalsshown = (options.decimalsshown ? options.decimalsshown : decimals);
					amountstring = amountstring.substring(0, amountstring.indexOf('.') + 1 + decimalsshown);
				}

			}
		}

		return amountstring;
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

_GlobalClass.registerModuleClass('currencies', 'DecimalAmount', DecimalAmount);

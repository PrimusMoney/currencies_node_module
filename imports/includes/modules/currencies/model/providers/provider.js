
class Provider {
	constructor(session, currency) {
		this.session = session;
		this.currency = currency;
	}

	getOps() {
		return this.currency.ops;
	}

	getPaymentUrl(txhash) {
		if (!this.currency.explorerurl)
			return;
			
		var paymenturl = this.currency.explorerurl;

		//paymenturl += this.currency.tx_path;
		paymenturl += '/web3/tx/';
		paymenturl += txhash;

		return paymenturl;
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

_GlobalClass.registerModuleClass('currencies', 'provider.js', Provider);



//export default Provider;

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


export default Provider;
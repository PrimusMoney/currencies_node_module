'use strict';


var Module = class {
	
	constructor() {
		this.name = 'mvc-currencies';
		this.current_version = "1.01.1.2020.12.05";
		
		this.global = null; // put by global on registration
		this.app = null;
		
		this.controllers = null;

		this.isready = false;
		this.isloading = false;

		this.clientapicontrollers = null; // API gateway
		this.currenciesapicontrollers = null; // API gateway
	}
	
	init() {
		console.log('module init called for ' + this.name);

		var global = this.global;
		
		this.isready = true;
	}
	
	// compulsory  module functions
	loadModule(parentscriptloader, callback) {
		console.log('loadModule called for module ' + this.name);
		
		if (this.isloading)
			return;
			
		this.isloading = true;

		var self = this;

		var modulescriptloader = parentscriptloader.getChildLoader('mvccurrenciesloader');

		modulescriptloader.load_scripts(function() { self.init(); if (callback) callback(null, self); });

		return modulescriptloader;	
	}
	
	isReady() {
		return this.isready;
	}

	hasLoadStarted() {
		return this.isloading;
	}

	// optional module functions
	registerHooks() {
		console.log('module registerHooks called for ' + this.name);
		
		var global = this.global;
		
		// initialization
	}
	
	postRegisterModule() {
		console.log('postRegisterModule called for ' + this.name);
		if (!this.isloading) {
			var global = this.global;
			var self = this;
			var rootscriptloader = global.getRootScriptLoader();
			
			this.loadModule(rootscriptloader, function() {
				if (self.registerHooks)
				self.registerHooks();
			});
		}
	}
	
	_getClientAPI() {
		if (this.clientapicontrollers)
			return this.clientapicontrollers;
		
		var global = this.global;
		
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		
		this.clientapicontrollers = mvcmodule._getClientAPI();
		
		return  this.clientapicontrollers;
	}

	_getCurrenciesAPI() {
		if (this.currenciesapicontrollers)
			return this.currenciesapicontrollers;
		
		var global = this.global;
		
		var currenciesmodules = global.getModuleObject('currenciesmodules');
		
		this.currenciesapicontrollers = currenciesmodules.getControllersObject();
		
		return  this.currenciesapicontrollers;
	}

	//
	// hooks
	//
	

	//
	// API
	//


	//
	// Ethnode
	//

	_canWalletHandleScheme(wallet, scheme) {
		if (!wallet || !scheme)
			return false;

		if (scheme.isRemote()) {
			var walletschemeuuid = wallet.getSchemeUUID();

			// TODO: we could look if authserver are the same
			if (walletschemeuuid && (walletschemeuuid === scheme.getSchemeUUID()))
				return true;
			else
				return false;
		}
		else {
			return true;
		}

	}

	async _createMonitoredEthereumTransaction(wallet, card, session, fromaccount) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
		
		var transaction = _apicontrollers.createEthereumTransaction(session, fromaccount);

		return transaction;
	}

	//
	// Scheme functions
	//

	async _getChildSessionOnScheme(parentsession, scheme) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		if (!parentsession)
			return Promise.reject('could not find create child of null session');

		var schemesessionmap = parentsession.getSessionVariable('schemesessionmap');
		
		if (!schemesessionmap) {
			schemesessionmap = Object.create(null);
			parentsession.setSessionVariable('schemesessionmap', schemesessionmap);
		}
		
		// we could look if a pre-existing session with corresponding web3providerurl could be re-used
		var schemeuuid = scheme.getSchemeUUID();

		if (schemesessionmap[schemeuuid])
			return schemesessionmap[schemeuuid];

		// else we create one and set it
		var childsession = await _apicontrollers.createChildSessionObject(parentsession);
		childsession.MYQUOTE = this.current_version;

		if (!parentsession.MYQUOTE_ROOT)
			parentsession.MYQUOTE_ROOT = this.current_version;

		var networkconfig = scheme.getNetworkConfig();

		await _apicontrollers.setSessionNetworkConfig(childsession, networkconfig);

		schemesessionmap[schemeuuid] = childsession;

		return childsession;
	}


	async _getMonitoredSchemeSession(session, wallet, scheme) {
		var fetchsession;

		if (!scheme)
			return Promise.reject('scheme is not defined');

		if (scheme.isRemote()) {
			if (wallet) {
				var walletschemeuuid = wallet.getSchemeUUID();
				var schemeuuid = scheme.getSchemeUUID();
	
				if (this._canWalletHandleScheme(wallet, scheme)) {
					// use wallet session
					fetchsession = wallet._getSession();
				}
				else {
					return Promise.reject('ERR_MISSING_CREDENTIALS');
				}
			}
			else {
				return Promise.reject('ERR_MISSING_CREDENTIALS');
			}
		}
		else {
			if (wallet) {
				var walletsession = wallet._getSession();
				fetchsession = await this._getChildSessionOnScheme(walletsession, scheme);
			}
			else {
				fetchsession = await this._getChildSessionOnScheme(session, scheme);
			}
		}

		return fetchsession;
	}



	//
	// Card functions
	//

	async _makeWalletCard(session, wallet, scheme, privatekey) {
		// we make client or remote wallets, depending on the scheme
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		if (!wallet)
			return Promise.reject('wallet is not defined');

		if (!scheme)
			return Promise.reject('scheme is not defined');


		var sessionaccount;

		if (privatekey) {
			// create a session account from private key
			if (_apicontrollers.isValidPrivateKey(session, privatekey)) {
				sessionaccount = await _apicontrollers.getSessionAccountFromPrivateKey(session, wallet, privatekey);
			}
	
			if (!sessionaccount)
				return Promise.reject('not a valid private key');
	
		}
		else {
			// we generate a key
			var _privatekey = _apicontrollers.generatePrivateKey();
			
			sessionaccount = await _apicontrollers.getSessionAccountFromPrivateKey(session, wallet, _privatekey);
	
			if (!sessionaccount)
				return Promise.reject('could not generate a private key');
		}

		var walletsession = wallet._getSession();
		var walletuser = walletsession.getSessionUserObject();

		if (!walletuser)
			return Promise.reject('wallet needs to be unlocked');

		
		var address = sessionaccount.getAddress();
		var authname = walletuser.getUserName();
		var password = null;

		const card_new =  await _apicontrollers.makeWalletCard(session, wallet, scheme, authname, password, address)
		.catch(err => {
			console.log('error in _makeWalletCard: ' + err);
		});

		if (card_new) {
			await card_new.init();

			if (card_new.isLocked()) {
				await card_new.unlock();
			}

			return card_new;
		}
		else
			throw new Error('could not create card');
	}


	async _createWalletCard(session, wallet, scheme, privatekey) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		if (scheme.isRemote() === false)  {
			return _apicontrollers.createWalletCard(session, wallet, scheme, privatekey);
		}
		else {
			var wallettype = wallet.getWalletType();

			switch(wallettype) {
				case 0:
					return Promise.reject('ERR_MISSING_CREDENTIALS');
				case 1:
					var walletschemeuuid = wallet.getSchemeUUID();

					if (this._canWalletHandleScheme(wallet, scheme))
						return this._makeWalletCard(session, wallet, scheme, privatekey);
					else
						return Promise.reject('ERR_MISSING_CREDENTIALS');
				default:
					return Promise.reject('wrong wallet type: ' + wallettype);
			}
	
		}

	}

	async _getCardFromAddressOnScheme(wallet, address, scheme, callback) {
		// TODO: replace for version >= 0.20.7
		var schemeuuid = scheme.getSchemeUUID();

		return wallet.getCardsWithAddress(address).
		then((cardarray) => {
			for (var i = 0; i < (cardarray ? cardarray.length : 0); i++) {
				var cardschemeuuid = cardarray[i].getSchemeUUID();
				
				if (cardschemeuuid == schemeuuid) {
					return cardarray[i];
				}
			}
			
			throw new Error('ERR_CARD_NOT_FOUND');
		});
	}

	//
	// Currency functions
	//

	_getAverageTransactionFee(scheme) {
		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');

		return mvcmodule._getAverageTransactionFee(scheme);
	}



	async _createCurrencyAmount(session, currency, position) {
		var global = this.global;
		var _apicurrencies = this._getCurrenciesAPI();
		return _apicurrencies.createCurrencyAmount(session, currency, position);
	}

	async _createDecimalAmount(session, amount, decimals) {
		var global = this.global;
		var _apicurrencies = this._getCurrenciesAPI();
		return _apicurrencies.createDecimalAmount(session, amount, decimals);
	}

	async transferCurrencyAmount(sessionuuid, walletuuid, cardfromuuid, cardtouuid, currencyuuid, currencyamount, feelevel = 0) {
		var global = this.global;

		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		if (!cardfromuuid)
			return Promise.reject('from card uuid is undefined');
		
		if (!cardtouuid)
			return Promise.reject('to card uuid is undefined');

		var CurrencyAmountClass = global.getModuleClass('currencies', 'CurrencyAmount');
		if ((currencyamount instanceof CurrencyAmountClass) !== true)
			return Promise.reject('wrong currency amount type');

		var amount = await currencyamount.toString();

		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);
		
		var fromcard = await wallet.getCardFromUUID(cardfromuuid);
		
		if (!fromcard)
			return Promise.reject('could not find card ' + cardfromuuid);

		var tocard = await wallet.getCardFromUUID(cardtouuid);
	
		if (!tocard)
			return Promise.reject('could not find card ' + cardtouuid);
	
	
		var fromaccount = fromcard._getSessionAccountObject();

		if (!fromaccount)
			return Promise.reject('card has no private key ' + cardfromuuid);
		
		var cardsession = await this._getMonitoredCardSession(session, wallet, fromcard);
		var from_card_scheme = fromcard.getScheme();

		// transfer parameters
		var toaddress = tocard.getAddress();
		var tokenaddress = currency.address;
		var tokenamount = amount;
	
		// using token account to make transfer
/* 		
		var tokenaccount = await this._getTokenAccountFromAddress(cardsession, fromcard, tokenaddress).catch(err => {});

		// create contact from toaddress
		var name = toaddress;
		var contactinfo = {};
		var tocontact = await _apicontrollers.createContact(cardsession, name, toaddress, contactinfo).catch(err => {});

		await tokenaccount.transferTo(contact, tokenamount)
		.catch(err => {
			console.log('error in transferCurrencyAmount: ' + err);
		});
 */

		// using direct call to ERC20 to speed up call
		var providerurl = await this._getCurrencyWeb3ProviderUrl(cardsession, currency);
		var senderprivatekey = fromaccount.getPrivateKey();
		var recipientaddress = toaddress;
		var fee  = await _apicontrollers.createSchemeFee(from_card_scheme, feelevel);

		var txhash = await _apicontrollers.sendERC20Tokens(cardsession, providerurl, tokenaddress, senderprivatekey, recipientaddress, tokenamount, fee)
		.catch(err => {
			console.log('error in transferCurrencyAmount: ' + err);
		});

		if (!txhash)
			return Promise.reject('could not send currency tokens');

		return txhash;
	}

	async _getCurrencyProvider(session, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!currency)
			return Promise.reject('currency is undefined');
		
		var global = this.global;

		var clientmodule = global.getModuleObject('currencies');

		return clientmodule.getCurrencyProvider(session, currency.uuid);
	}

	async _getCurrencyOps(session, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!currency)
			return Promise.reject('currency is undefined');
		

		// we look if the currency has a provider specified
		var currency_provider = await this._getCurrencyProvider(session, currency);

		if (currency_provider)
			return currency_provider.getOps();
		else
			return {canpay: false};

	}

	async _getCurrencyScheme(session, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!currency)
			return Promise.reject('currency is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		// we look if the currency has a trade scheme specified
		var currencyschemeuuid = (currency.scheme_uuid ? currency.scheme_uuid : null );
		var scheme;

		if (currencyschemeuuid) {
			// a built-in scheme has been specified in currency definition
			scheme = await _apicontrollers.getSchemeFromUUID(session, currencyschemeuuid)
			.catch(err => {});
		}
		else {
			// scheme has probably already been created with web3providerurl
			var web3url = currency.web3providerurl;
			scheme = await _apicontrollers.getSchemeFromWeb3Url(session, web3url)
			.catch(err => {});

			if (!scheme) {
				// if not, we create a local scheme now and save it
				var defaultlocalscheme = await _apicontrollers.getDefaultScheme(session, 0);
				scheme = await defaultlocalscheme.cloneOnWeb3ProviderUrl(web3url)
				.catch(err => {});
			}
		}
	
		return scheme;
	}

	async _getCurrencyWeb3ProviderUrl(session, currency) {
		if (currency.web3providerurl)
			return currency.web3providerurl;
		else {
			var scheme = await this._getCurrencyScheme(session, currency);

			if (scheme)
				return scheme.getWeb3ProviderUrl();
			else
				console.log('currency is badly configured ' + currency.uuid);
		}
	}
	
	async _findCurrencyFromWeb3ProviderUrl(sessionuuid, web3providerurl) {
		// we retun the first one, it is unsafe and 
		// direct use of currencyuuidis recommended
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
		var session = await _apicontrollers.getSessionObject(sessionuuid);

		var currencies = await this.getCurrencies(sessionuuid);

		for (var i = 0; i < currencies.length; i++) {
			var currency = currencies[i];

			if (currency.web3providerurl) {
				if (currency.web3providerurl == web3providerurl)
				return currency
			}
			else if (currency.scheme_uuid) {
				var scheme = await _apicontrollers.getSchemeFromUUID(session, currency.scheme_uuid)

				if ((scheme) && (scheme.getWeb3ProviderUrl() == web3providerurl))
					return currency;
			}
			else {
				console.log('currency is badly configured ' + currency.uuid);
			}
		}
	}

	async _getPretradeScheme(session, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!currency)
			return Promise.reject('currency is undefined');
		

		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		// we look if the currency has a pretrade scheme specified
		var sessionuuid = session.getSessionUUID();
		var pretradeschemeuuid = (currency.pretrade_scheme_uuid ? currency.pretrade_scheme_uuid : null );

		var scheme = await _apicontrollers.getSchemeFromUUID(session, pretradeschemeuuid)
		.catch(err => {});

		if (scheme)
		return scheme;

		// we return local scheme named firenze as a default, if we can find it
		var clientmodule = global.getModuleObject('webclient');

		if (clientmodule.getBuiltinLocalSchemes) {
			var builtin_local_schemes = clientmodule.getBuiltinLocalSchemes();
	
			var prestradescheme = builtin_local_schemes.firenze;
		
			if (prestradescheme)
			scheme = await _apicontrollers.getSchemeFromUUID(session, prestradescheme.uuid);
		}


		return scheme;
	}

	async _filterCurrencies(session, currencies, walletuuid) {
		var _currencies = [];

		for (var i = 0; i < (currencies ? currencies.length : 0); i++) {
			_currencies.push(currencies[i]);
		}

		if (walletuuid) {
			var _apicontrollers = this._getClientAPI();

			var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid).catch(err => {});

			if (wallet) {
				var walletschemeuuid = wallet.getSchemeUUID();
				var array = [];

				for (var i = 0; i < (currencies ? currencies.length : 0); i++) {
					var currency = currencies[i];

					// if currency has a scheme, check if it is remote and it matches the wallet
					var currencyscheme = await this._getCurrencyScheme(session, currency);
					
					if (currencyscheme && (currencyscheme.isRemote())) {
						var currencyschemeuuid = currencyscheme.getSchemeUUID();
						if (this._canWalletHandleScheme(wallet, currencyscheme)) {
							array.push(currencies[i]);
						}
					}
					else {
						array.push(currencies[i]);
					}
				}
		
				
				_currencies = array;
			}

		}

		return _currencies;
	}


	async getCurrencies(sessionuuid, walletuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		// look if already stored in the session variables
		var currencies = session.getSessionVariable('currencies');

		if (currencies) {
			// send back a copy
			var _currencies = await this._filterCurrencies(session, currencies, walletuuid);

			return _currencies;
		}
	
		// otherwise retrieve the list of currencies
		var global = this.global;

		var clientmodule = global.getModuleObject('currencies');

		var currencies = clientmodule.getCurrencies();

		var array = Object.values(currencies);

		// fill complementary info
		for (var i = 0; i < (array ? array.length : 0); i++) {
			// ops
			array[i].ops = await this._getCurrencyOps(session, array[i])
			.catch(err => {
				console.log(err);
			});

			// pretrade_explorer_url
			var currency_pretrade_scheme = await this._getPretradeScheme(session, array[i]).catch(e=>{});
			var currency_pretrade_ethnode_conf = (currency_pretrade_scheme ? currency_pretrade_scheme.getEthNodeServerConfig() : null);

			array[i].pretrade_web3_provider_url = (currency_pretrade_ethnode_conf ? currency_pretrade_ethnode_conf.web3_provider_url : null)
			array[i].pretrade_explorer_url = (currency_pretrade_ethnode_conf ? currency_pretrade_ethnode_conf.explorerurl : null)
		}

		// store in session
		session.setSessionVariable('currencies', array);

		// send back a copy
		var _currencies = await this._filterCurrencies(session, array, walletuuid);

		return _currencies;
	}

	async getCurrencyFromUUID(sessionuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var currencies = await this.getCurrencies(sessionuuid); // all currencies

		for (var i = 0; i < currencies.length; i++) {
			if (currencies[i].uuid === currencyuuid) {
				return currencies[i];
			}
		}
	}

	async _getCurrencyCardList(session, wallet, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!wallet)
			return Promise.reject('wallet is undefined');

		if (!currency)
			return Promise.reject('currency is undefined');

		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');

		var cards = await wallet.getCardList(true);

		var array = [];

		var scheme = await this._getCurrencyScheme(session, currency);

		if (!scheme)
			return Promise.reject('could not find scheme for currency');

		var schemeuuid = scheme.getSchemeUUID();
		var currencyuuid = currency.uuid;

		for (var i = 0; i < (cards ? cards.length : 0); i++) {
			var _crdschemeuuid = cards[i].getSchemeUUID();

			if (_crdschemeuuid == schemeuuid) {
				// check it is not associated to
				// another currency on same schemeuuid
				// looking at XtraData
				let xtradata = cards[i].getXtraData('myquote');

				xtradata = (xtradata ? xtradata : {});
				let _crdcurrencyuuid = xtradata.currencyuuid;

				if (_crdcurrencyuuid && (_crdcurrencyuuid == currencyuuid))
				array.push(cards[i]);
			}
		}
			
		return array;
	}

	async _getCurrencyCard(session, wallet, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!wallet)
			return Promise.reject('wallet is undefined');

		if (!currency)
			return Promise.reject('currency is undefined');

		var cards = await this._getCurrencyCardList(session, wallet, currency);
		var card;

		if (cards && cards.length) {
			// look if a card is marked as main card
			for (var i = 0; i < cards.length; i++) {
				var crd = cards[i];

				var xtra = crd.getXtraData('myquote');

				if (xtra && (xtra.maincard === true)) {
					card = crd;
					break;
				}
			}

		}

		return card;
	}

	async getCurrencyCard(sessionuuid, walletuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);

		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);


		var card = await this._getCurrencyCard(session, wallet, currency);

		if (!card)
			return Promise.reject('could not find currency card for wallet ' + walletuuid);


		var mvcmodule = global.getModuleObject('mvc-client-wallet');

		var cardinfo = {uuid: card.getCardUUID()};

		mvcmodule._fillCardInfo(cardinfo, card);

		return cardinfo;
	}

	async setCurrencyCard(sessionuuid, walletuuid, currencyuuid, carduuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);

		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var card = await wallet.getCardFromUUID(carduuid);
	
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		// sift through cards for currency to set the maincard flag accordingly
		var currencycards = await this._getCurrencyCardList(session, wallet, currency);

		for (var i = 0; i < (currencycards ? currencycards.length : 0); i++) {
			let currencycard = currencycards[i];
			let xtradata = currencycard.getXtraData('myquote');

			if (xtradata && (xtradata.maincard === true)) {
				// remove flag
				xtradata.maincard = false;

				currencycard.putXtraData('myquote', xtradata);

				if (currencycard.isLocked()) {
					await currencycard.unlock();
				}
		
				await currencycard.save();
			}

			if (currencycard.getCardUUID() === carduuid) {
				xtradata = (xtradata ? xtradata : {});
				xtradata.maincard = true;

				currencycard.putXtraData('myquote', xtradata);

				if (currencycard.isLocked()) {
					await currencycard.unlock();
				}

				await currencycard.save();
			}

		}
	
	}


	async createCurrencyCard(sessionuuid, walletuuid, currencyuuid, privatekey) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var scheme = await this._getCurrencyScheme(session, currency);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		// TODO: replace by _apicontrollers.createWalletCard for version >= 0.20.7
		const card = await this._createWalletCard(session, wallet, scheme, privatekey); 
		//const card = await _apicontrollers.createWalletCard(session, wallet, scheme, privatekey);

		if (!card)
			return Promise.reject('could not create card');

		if (card.isLocked()) {
			await card.unlock();
		}

		// set it's associated to currencyuuid in XtraData
		let xtradata = card.getXtraData('myquote');

		xtradata = (xtradata ? xtradata : {});
		xtradata.currencyuuid = currencyuuid;

		card.putXtraData('myquote', xtradata);

		// save
		const bSave = await card.save();

		if (!bSave)
			return Promise.reject('could not save card');

		// set as maincard if it is the first card created
		var currencycards = await this._getCurrencyCardList(session, wallet, currency);

		if (!currencycards || (currencycards.length == 1)) {
			await this.setCurrencyCard(sessionuuid, walletuuid, currencyuuid, card.uuid);
		}

		// return cardinfo
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var cardinfo = {};

		mvcmodule._fillCardInfo(cardinfo, card);
		
		return cardinfo;
	}

	async getCurrencyCardWithAddress(sessionuuid, walletuuid, currencyuuid, address) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var scheme = await this._getCurrencyScheme(session, currency);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		// look if we have a card with this address
		// TODO: uncomment for version >= 0.20.7
		//var card = await wallet.getCardFromAddressOnScheme(address, scheme)
		var card = await this._getCardFromAddressOnScheme(wallet, address, scheme)
		.catch(err => {
			console.log('error in getCurrencyCardWithAddress ' + err);
		});

		if (card) {
			// return cardinfo
			var mvcmodule = global.getModuleObject('mvc-client-wallet');
			var cardinfo = {};

			mvcmodule._fillCardInfo(cardinfo, card);
			
			return cardinfo;	
		}
		else {
			// we create a read-only card
			return this.createReadOnlyCurrencyCard(sessionuuid, walletuuid, currencyuuid, address);
		}
	}


	async createReadOnlyCurrencyCard(sessionuuid, walletuuid, currencyuuid, address) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var scheme = await this._getCurrencyScheme(session, currency);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		let authname;
		let password;

		const card = await wallet.createCard(scheme, authname, password, address);

		if (!card)
			return Promise.reject('could not create card');

		var cardsession = card._getSession();

		if (!cardsession) {
			await card.init();
		}

		if (card.isLocked()) {
			await card.unlock();
		}

		// set it's associated to currencyuuid in XtraData
		let xtradata = card.getXtraData('myquote');

		xtradata = (xtradata ? xtradata : {});
		xtradata.currencyuuid = currencyuuid;

		card.putXtraData('myquote', xtradata);

		// save
		const bSave = await card.save();

		if (!bSave)
			return Promise.reject('could not save card');

		// return cardinfo
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var cardinfo = {};

		mvcmodule._fillCardInfo(cardinfo, card);
		
		return cardinfo;	
	}

	async generateCurrencyCard(sessionuuid, walletuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		// we generate a key
		var _privatekey = _apicontrollers.generatePrivateKey(session);

		return this.createCurrencyCard(sessionuuid, walletuuid, currencyuuid, _privatekey);
	}

	async _getTokenAccountFromAddress(session, card, tokenaddress) {
		var tokenaccount = await card.getTokenAccountFromAddress(tokenaddress).catch(err => {});

		if (!tokenaccount) {
			var token = card.getTokenObject(tokenaddress);

			if (card.isLocked()) {
				await card.unlock();
			}

			tokenaccount = await card.createTokenAccount(token);
			await tokenaccount.init();

			await tokenaccount._synchronizeWithERC20TokenContract(session); // saves tokenaccount
			
			// var description = 'my quote token account';
			//tokenaccount.setLabel(description);
			//await tokenaccount.save();
		}

		return tokenaccount;
	}

	async getCurrencyPosition(sessionuuid, walletuuid, currencyuuid, carduuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);

		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);

		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var tokenaddress = currency.address;

		// using token account to get position
/* 		var card = await this._getCurrencyCard(session, wallet, currency).catch(err => {});

		var tokenaccount = await this._getTokenAccountFromAddress(session, card, tokenaddress).catch(err => {});

		const position = (tokenaccount ? await tokenaccount.getPosition().catch(err => {}) : 0);
 */

		// using direct call to ERC20 to speed up result
		var cardinfo ;
		
		if (!carduuid) {
			// main card
			cardinfo = await this.getCurrencyCard(sessionuuid, walletuuid, currencyuuid);
		}
		else {
			var mvcmodule = global.getModuleObject('mvc-client-wallet');
			cardinfo = await mvcmodule. getCardInfo(sessionuuid, walletuuid, carduuid);
		}
		
		
		var cardaddress = cardinfo.address;
		
		// get a childsession on currency scheme
		var valuescheme = await this._getCurrencyScheme(session, currency);
		var childsession = await this._getMonitoredSchemeSession(session, wallet, valuescheme);

		const position = await _apicontrollers.getAddressERC20Position(childsession, null, tokenaddress, cardaddress)
		.catch((err) => {
			position = 0;
		});

		return this._createCurrencyAmount(childsession, currency, position);
	}

	async getCurrencyCardCredits(sessionuuid, walletuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);

		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);

		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);


		var card = await this._getCurrencyCard(session, wallet, currency);
		var carduuid = card.getCardUUID();
		var schemeuuid = card.getSchemeUUID();

		// TODO: use mvcmodule.getCreditBalance for version >= 0.20.8
		//var credits = await mvcmodule.getCreditBalance(sessionuuid, walletuuid, carduuid);
		var credits = await this.getCreditBalance(sessionuuid, walletuuid, carduuid);

		credits.threshold = await mvcmodule.getSchemeTransactionUnitsThreshold(sessionuuid, schemeuuid);

		return credits;
	}

	async _getMonitoredCardSession(session, wallet, card) {
		var cardsession = card._getSession();

/* 		var scheme = card.getScheme();

		if (scheme.isRemote()) {
			if (wallet) {
				var walletschemeuuid = wallet.getSchemeUUID();
				var schemeuuid = scheme.getSchemeUUID();
	
				if (this._canWalletHandleScheme(wallet, scheme)) {
					// use wallet session
					cardsession = wallet._getSession();
				}
			}
		}
 */
		return cardsession;
	}

	async payAmount(sessionuuid, walletuuid, carduuid, toaddress, currencyuuid, amount) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);
			
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		
		var card = await wallet.getCardFromUUID(carduuid);
	
		if (!card)
			return Promise.reject('could not find a card for currency ' + currencyuuid);
	
		// we top up card to be sure to be able sending a transaction
		var ops = await this._getCurrencyOps(session, currency);

		if (ops.cantopup === true) {
			const topupinfo = await mvcmodule.topUpCard(sessionuuid, walletuuid, carduuid)		
			.catch(err => {
				console.log('error in payAndReport: ' + err);
			});
	
			if ((!topupinfo) || (!topupinfo.top) ) {
				console.log('no top up for card ' + carduuid);
			}
		}


		// transfer parameters
		var tokenaddress = currency.address;
		var tokenamount = amount;

		
	
		// using token account to make transfer
/* 		
		var tokenaccount = await this._getTokenAccountFromAddress(session, card, tokenaddress).catch(err => {});

		// create contact from toaddress
		var name = toaddress;
		var contactinfo = {};
		var tocontact = await _apicontrollers.createContact(session, name, toaddress, contactinfo).catch(err => {});

		await tokenaccount.transferTo(contact, tokenamount);
 */

		// using direct call to ERC20 to speed up call
		var cardsession = await this._getMonitoredCardSession(session, wallet, card);
		var fromaccount = card._getSessionAccountObject();

		var scheme = await this._getCurrencyScheme(session, currency);

		var providerurl = await this._getCurrencyWeb3ProviderUrl(session, currency);
		var fee  = await _apicontrollers.createSchemeFee(scheme);
		var value = 0;

		const credits = await this.getCreditBalance(sessionuuid, walletuuid, carduuid)
		.catch(err => {
			console.log('error in payAmount: ' + err);
		});

		console.log('sending tokens with gasLimit ' + fee.gaslimit + ' and gas price ' + fee.gasPrice);
		console.log('(fee.gaslimit * fee.gasPrice + value) is ' + (fee.gaslimit * fee.gasPrice + value));
		console.log('transaction credit before transfer is ' + (credits ? credits.transactioncredits : 'unknown'));

		if (credits && (credits.transactioncredits < (fee.gaslimit * fee.gasPrice + value))) {
			console.log('WARNING: transaction credit is lower than (fee.gaslimit * fee.gasPrice + value). You should raise transaction_units_min for corresponding scheme');
		}

/* 		
		var senderprivatekey = fromaccount.getPrivateKey();
		var recipientaddress = toaddress;

		var txhash = await _apicontrollers.sendERC20Tokens(cardsession, providerurl, tokenaddress, senderprivatekey, recipientaddress, tokenamount, fee);

 */		
		// using transferERC20Tokens instead of sendERC20Tokens
		//var ethtx = _apicontrollers.createEthereumTransaction(cardsession, fromaccount);
		var ethtx = await this._createMonitoredEthereumTransaction(wallet, card, cardsession, fromaccount);
			
		ethtx.setToAddress(toaddress);
		ethtx.setGas(fee.gaslimit);
		ethtx.setGasPrice(fee.gasPrice);

		ethtx.setValue(value);

		var txhash = await _apicontrollers.transferERC20Tokens(cardsession, providerurl, tokenaddress, tokenamount, ethtx);

		return txhash;
	}

	async payAndReport(sessionuuid, walletuuid, toaddress, currencyuuid, amount) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var cardinfo = await this.getCurrencyCard(sessionuuid, walletuuid, currencyuuid);

		if (!cardinfo)
			return Promise.reject('could not find a card for currency ' + currencyuuid);

		var txhash = await this.payAmount(sessionuuid, walletuuid, cardinfo.uuid, toaddress, currencyuuid, amount);

		// we ask provider to make a payment url
		var currency_provider = await this._getCurrencyProvider(session, currency);

		if (!currency_provider)
			return Promise.reject('currency has no provider');

		var paymenturl = currency_provider.getPaymentUrl(txhash);

		return paymenturl;
	}



	_getSchemeNetworkConfig(scheme) {
		var network = scheme.getNetworkConfig();

		return network;
	}



	async getCurrencyCardList(sessionuuid, walletuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		var cards = await this._getCurrencyCardList(session, wallet, currency);

		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var array = [];
				
		for (var i = 0; i < (cards ? cards.length : 0); i++) {
			var carduuid = cards[i].getCardUUID();
			var cardinfo = {uuid: carduuid};
			
			mvcmodule._fillCardInfo(cardinfo, cards[i]);
			
			array.push(cardinfo);
		}
		
		return array;
	}

	async getCurencySchemeInfo(sessionuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var global = this.global;

		var _apicontrollers = this._getClientAPI();
		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var scheme = await this._getCurrencyScheme(session, currency);

		var mvcmodule = global.getModuleObject('mvc-client-wallet');

		var schemeinfo = {uuid: scheme.getSchemeUUID()};
		
		mvcmodule._fillSchemeInfoFromScheme(schemeinfo, scheme);

		return schemeinfo;
	}

	async getPretradeSchemeInfo(sessionuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var global = this.global;

		var _apicontrollers = this._getClientAPI();
		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		

		var pretradescheme = await this._getPretradeScheme(session, currency);

		var mvcmodule = global.getModuleObject('mvc-client-wallet');

		var pretradeschemeinfo = {uuid: pretradescheme.getSchemeUUID()};
		
		mvcmodule._fillSchemeInfoFromScheme(pretradeschemeinfo, pretradescheme);

		return pretradeschemeinfo;
	}

	async getPretradeWeb3Url(sessionuuid, currencyuuid) {
		var pretrade_schemeinfo = await this.getPretradeSchemeInfo(sessionuuid, currencyuuid);
	
		var pretrade_web3providerurl = pretrade_schemeinfo.network.ethnodeserver.web3_provider_url;

		return pretrade_web3providerurl;
	}

	async _getCardsOnScheme(wallet, scheme, bRefresh = true) {
		var schemeuuid = scheme.getSchemeUUID();
		var cardlist = await wallet.getCardList(bRefresh);

		var array = [];

		for (var i = 0; i < (cardlist ? cardlist.length : 0); i++) {
			var card = cardlist[i];

			if (card.getSchemeUUID() === schemeuuid)
				array.push(card);
		}

		return array;
	}

	async getPretradeCard(sessionuuid, walletuuid, carduuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		
		var card = await wallet.getCardFromUUID(carduuid).catch(err => {});
		
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
	
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var pretradecardinfo;

		// for the moment we usually return a card on firenze
		var pretradescheme = await this._getPretradeScheme(session, currency);
		
		var cards = await this._getCardsOnScheme(wallet, pretradescheme, true)
		.catch(err => {
			console.log('error in getPretradeCard: ' + err);
		});

		if (cards) {
			for (var i = 0; i < cards.length; i++) { 
				let pretradecard = cards[i];

				if (pretradecard.isLocked()) {
					await pretradecard.unlock();
				}

				var canPretradeCardSign = await pretradecard.canSign();

				if (canPretradeCardSign === true) {
					pretradecardinfo = await mvcmodule.getCardInfo(sessionuuid, walletuuid, pretradecard.getCardUUID());
					break;
				}				
			}
		}
		
/* 		var pretradeschemeuuid = pretradescheme.getSchemeUUID();
		
		var cardinfos = await mvcmodule.getCardList(sessionuuid, walletuuid, true)
		.catch(err => {
			console.log('error in getPretradeCard: ' + err);
		});

		if (cardinfos) {
			for (var i = 0; i < cardinfos.length; i++) {

				if (pretradeschemeuuid === cardinfos[i].schemeuuid) {
					// check card can sign
					let pretradecard = await wallet.getCardFromUUID(cardinfos[i].uuid).catch(err => {});

					if (pretradecard) {			
						if (pretradecard.isLocked()) {
							await pretradecard.unlock();
						}

						var canPretradeCardSign = await pretradecard.canSign();

						if (canPretradeCardSign === true) {
							pretradecardinfo = cardinfos[i];
							break;
						}
					}
				}
			}
		} */

		

		if (!pretradecardinfo) {
			if (card.isLocked()) {
				await card.unlock();
			}
						
			let canCardSign = await card.canSign();
			let pretradecard;

			if (canCardSign === true) {
				var pretrade_schemeinfo = await this.getPretradeSchemeInfo(sessionuuid, currencyuuid);

				if (pretrade_schemeinfo.uuid != card.getSchemeUUID()) {
					// we clone card on pretrade scheme
					pretradecardinfo = await mvcmodule.cloneCard(sessionuuid, walletuuid, carduuid, pretrade_schemeinfo.uuid);
				}
				else {
					// we return the card it self
					pretradecardinfo = await mvcmodule.getCardInfo(sessionuuid, walletuuid, carduuid);
				}

				if (!pretradecardinfo)
					return Promise.reject('could not clone or pick the main card for pretrade use');

				pretradecard = await wallet.getCardFromUUID(pretradecardinfo.uuid);
			}
			else {
				// main card is read-only, we can not use a clone or the card itself
				//return Promise.reject('card is read-only, can not create corresponding pretrade card');

				// let's create a card on the fly
				var _privatekey = _apicontrollers.generatePrivateKey(session);

				pretradecard = await _apicontrollers.createWalletCard(session, wallet, pretradescheme, _privatekey);

				if (!pretradecard)
					return Promise.reject('could not generate a pretrade card');

			}

			if (!pretradecard)
				return Promise.reject('could not create a pretrade card');

			// mark as pretrade card
			await this.setPretradeCard(sessionuuid, walletuuid, currencyuuid, pretradecard.uuid);

			pretradecardinfo = await mvcmodule.getCardInfo(sessionuuid, walletuuid, pretradecard.uuid);

		}

		if (!pretradecardinfo)
			return Promise.reject('could not find a card to register transactions');

		return pretradecardinfo;
	}


	async setPretradeCard(sessionuuid, walletuuid, currencyuuid, carduuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);

		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var card = await wallet.getCardFromUUID(carduuid);
	
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		// sift through cards for currency to set the pretradecard flag accordingly
		var pretradescheme = await this._getPretradeScheme(session, currency);
		
		var cards = await this._getCardsOnScheme(wallet, pretradescheme, true)
		.catch(err => {
			console.log('error in getPretradeCard: ' + err);
		});

		if (cards) {
			for (var i = 0; i < (cards ? cards.length : 0); i++) {
				let card = cards[i];
				let xtradata = card.getXtraData('myquote');
	
				if (xtradata && (xtradata.pretradecard === true)) {
					// remove flag
					xtradata.pretradecard = false;
	
					card.putXtraData('myquote', xtradata);
	
					if (card.isLocked()) {
						await card.unlock();
					}
			
					await card.save();
				}
	
				if (card.getCardUUID() === carduuid) {
					xtradata = (xtradata ? xtradata : {});
					xtradata.pretradecard = true;
	
					card.putXtraData('myquote', xtradata);
	
					if (card.isLocked()) {
						await card.unlock();
					}
	
					await card.save();
				}
	
			}
		}
	
	}



	//
	// uniswap
	//
	async getPriceForCreditUnits(sessionuuid, currencyuuid, creditunits) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var swapmodule = global.getModuleObject('uniswap');

		var scheme = await this._getCurrencyScheme(session, currency);

		// compute corresponding ethereum credits
		var ethnodemodule = global.getModuleObject('ethnode');

		var avg_transaction_fee = this._getAverageTransactionFee(scheme)

		var weiamount = ethnodemodule.getWeiFromEther(avg_transaction_fee);
		var ethamount = await this._createDecimalAmount(session, weiamount, 18);
		ethamount.multiply(creditunits);
		
		var ethcredit = await ethamount.toInteger();

		// token info
		var uniswap_v2 = currency.uniswap_v2;
		uniswap_v2.version = 'uniswap_v2';

		var token = {};
		token.name = currency.name;
		token.address = currency.address;
		token.symbol = currency.symbol;
		token.decimals = currency.decimals;

		var weth = {};
		weth.name = uniswap_v2.gas_name;
		weth.address = uniswap_v2.gas_address;
		weth.symbol = uniswap_v2.gas_symbol;
		weth.decimals = uniswap_v2.gas_decimals;

		var pricing = await swapmodule.getPriceForOutput(session, scheme, token, weth, ethcredit, uniswap_v2);

		var priceamount = (pricing.amounts_in ? pricing.amounts_in[0] : null)

		var price_struct = {};

		price_struct.creditunits_requested = creditunits;
		price_struct.currency_amount = await this._createCurrencyAmount(session, currency, (priceamount ? priceamount : -1));

		return price_struct;
	}

	async buyCreditUnits(sessionuuid, walletuuid, carduuid, currencyuuid, creditunits, feelevel = 0) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
		return Promise.reject('wallet uuid is undefined');
	
		if (!carduuid)
		return Promise.reject('card uuid is undefined');
	
		if (!currencyuuid)
		return Promise.reject('currency uuid is undefined');
	
		var global = this.global;
		var mvcmodule = global.getModuleObject('mvc-client-wallet');
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
		
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);
		
		var card = await wallet.getCardFromUUID(carduuid);
		
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var swapmodule = global.getModuleObject('uniswap');

		var scheme = await this._getCurrencyScheme(session, currency);

		var cardsession = await this._getMonitoredCardSession(session, wallet, card);
		var fromaccount = card._getSessionAccountObject();

		// compute corresponding ethereum credits
		var ethnodemodule = global.getModuleObject('ethnode');

		var avg_transaction_fee = this._getAverageTransactionFee(scheme)

		var weiamount = ethnodemodule.getWeiFromEther(avg_transaction_fee);
		var ethamount = await this._createDecimalAmount(session, weiamount, 18);
		ethamount.multiply(creditunits);
		
		var ethcredit = await ethamount.toInteger();

		// token info
		var uniswap_v2 = currency.uniswap_v2;
		uniswap_v2.version = 'uniswap_v2';

		var token = {};
		token.name = currency.name;
		token.address = currency.address;
		token.symbol = currency.symbol;
		token.decimals = currency.decimals;

		var currencyposition = await this.getCurrencyPosition(sessionuuid, walletuuid, currencyuuid, carduuid);
		var tokenamountmax = await currencyposition.toInteger();

		var weth = {};
		weth.name = uniswap_v2.gas_name;
		weth.address = uniswap_v2.gas_address;
		weth.symbol = uniswap_v2.gas_symbol;
		weth.decimals = uniswap_v2.gas_decimals;

		// create ethereum transaction object
		//var ethtx = _apicontrollers.createEthereumTransaction(cardsession, fromaccount);
		var ethtx = await this._createMonitoredEthereumTransaction(wallet, card, cardsession, fromaccount);

		ethtx.setToAddress(fromaccount.getAddress()); // ask to send credits to card

		// fee
		var fee = await _apicontrollers.createSchemeFee(scheme, feelevel);
			
		let units_per_swap_transfer = 3;
		let gaslimit = fee.gaslimit * units_per_swap_transfer;

		ethtx.setGas(gaslimit);
		ethtx.setGasPrice(fee.gasPrice);

		// send swap request
		return swapmodule.buyEthOnOutput(cardsession, scheme, token, tokenamountmax, weth, ethcredit, uniswap_v2, ethtx);
	}

	//
	// utils
	//
	async _unformatAmount(session, amountstring, decimals) {
		if (amountstring === undefined)
			return;
		
		var _amountstring = amountstring.trim();

		// remove trailing symbol if some
  		var index = _amountstring.indexOf(' ');
		if ( index > 0)
		_amountstring = _amountstring.substring(0, index);

		if ((!_amountstring) || isNaN(_amountstring))
			return -1;
		
		
		var split = amountstring.toString().split(".");
		var amountnumberstring;
		
		if (typeof split[1] === 'undefined') {
			// no decimal
			var multiplier = '';
			for (var i = 0; i < decimals; i++) multiplier += '0';
	
			amountnumberstring = _amountstring + multiplier;
		}
		else {
			var integerstring = split[0];
			
			if (split[1].length < decimals) {
				integerstring += split[1];
				// fill with trailing zeros
				for (var i = 0; i < (decimals - split[1].length); i++)
					integerstring += '0';
			}
			else {
				integerstring += split[1].substr(0, decimals);
			}
			
			amountnumberstring = integerstring;
		}
		
		return amountnumberstring;
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
	

	async _formatMonetaryAmount(session, amount, symbol, decimals, options) {
		var amountstring = await this._formatAmount(session, amount, decimals, options);
		
		return amountstring + ' ' + symbol;
	}

	async _formatTokenAmount(session, tokenamount, token, options) {
		// TODO: unsupported calls that would need to be
		// wrapped up in a token.init function
		var erc20contrat = token._getERC20TokenContract(session); // necessary for _synchronize
		await token._synchronizeERC20TokenContract(session);
		// TODO: end
		
		var decimals = token.getDecimals();
		var symbol = token.getSymbol();
		
		var amountstring = await this._formatMonetaryAmount(session, tokenamount, symbol, decimals, options);
		
		return amountstring;
	}

	async getDecimalAmount(sessionuuid, amount, decimals = 18) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		return this._createDecimalAmount(session, amount, decimals);
	}

	async getCurrencyAmount(sessionuuid, currencyuuid, amount) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var mvcmodule = global.getModuleObject('mvc-client-wallet')
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var decimals = currency.decimals;
		let tokenamountstring;
		
		if (typeof amount === 'string'){
			tokenamountstring = await this._unformatAmount(session, amount, decimals);
		}
		else if (Number.isInteger(amount)) {
			tokenamountstring = mvcmodule.formatAmount(amount, decimals)
		} 
		else {
			let isFloat = (n) => {
				return Number(n) === n && n % 1 !== 0;
			};

			if (isFloat(amount)) {
				let amountstring = amount.toString();
				tokenamountstring = await this._unformatAmount(session, amountstring, decimals);
			}
			else {
				return Promise.reject('amount is not correct: ' + amount);
			}
		}

		return this._createCurrencyAmount(session, currency, tokenamountstring);
	}
	
	async formatCurrencyAmount(sessionuuid, currencyuuid, currencyamount, options) {
		var global = this.global;

		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');

		var CurrencyAmountClass = global.getModuleClass('currencies', 'CurrencyAmount');		
		if ((currencyamount instanceof CurrencyAmountClass) !== true)
		return Promise.reject('wrong currency amount type');
		
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);
		
		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		var _options = (options ? options : {showdecimals: true, decimalsshown: 2});

		// TEST
/* 		var currencyscheme = await this._getCurrencyScheme(session, currency);
		var tokenaddress = currency.address;

		var token = await currencyscheme.getTokenObject(tokenaddress);
		
		var currencyamountstring = await this._formatTokenAmount(session, tokenamount, token, _options);
 */		// TEST: end

 		var tokenamountstring = await currencyamount.toString();
		var currencyamountstring = await this._formatMonetaryAmount(session, tokenamountstring, currency.symbol, currency.decimals, _options);

		return currencyamountstring;
	}
}

if ( (typeof GlobalClass === 'undefined') || (!GlobalClass)) {
	var GlobalClass = ((typeof window !== 'undefined') && window && window.simplestore && window.simplestore.Global ? window.simplestore.Global : null);
}

if ( typeof GlobalClass !== 'undefined' && GlobalClass ) {
	GlobalClass.getGlobalObject().registerModuleObject(new Module());

	//dependencies
	GlobalClass.getGlobalObject().registerModuleDepency('mvc-currencies', 'common');

	// module classes	
	//GlobalClass.registerModuleClass('mvc-currencies', 'DecimalAmount', DecimalAmount);
	//GlobalClass.registerModuleClass('mvc-currencies', 'CurrencyAmount', CurrencyAmount);
}



'use strict';


var Module = class {

	static get DEFAULT_GAS_LIMIT() { return 4850000;}
	static get DEFAULT_GAS_PRICE() { return 10000000000;}
	static get DEFAULT_GAS_UNIT() { return 21000;}

	static get AVG_TRANSACTION_FEE() { return 0.00021;}

	static get TRANSACTION_UNITS_MIN() { return 240;} 
		// AVG_TRANSACTION_FEE * TRANSACTION_UNITS_MIN should be higher than DEFAULT_GAS_LIMIT * DEFAULT_GAS_PRICE

	
	constructor() {
		this.name = 'mvc-currencies';
		this.current_version = "0.30.15.2023.02.22";
		
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
		
		// hooks

		// signal module is ready
		var rootscriptloader = global.getRootScriptLoader();
		rootscriptloader.signalEvent('on_mvc_currencies_module_ready');
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
		
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
		
		this.clientapicontrollers = mvcclientwalletmodule._getClientAPI();
		
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
	// Monitored Session functions
	//

	async _createDummyWalletSession(walletsession) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		return currenciesmodule._createDummyWalletSession(walletsession);
	}

	async _setMonitoredEthereumNodeAccess(session, ethnodeserver) {
		var global = this.global;
		var ethnodecurrenciesmodule = global.getModuleObject('ethnode-currencies');
		return ethnodecurrenciesmodule._setMonitoredEthereumNodeAccess(session, ethnodeserver);
	}

	async _getMonitoredCurrencySession(session, wallet, currency) {
		var global = this.global;
		var ethnodecurrenciesmodule = global.getModuleObject('ethnode-currencies');
		return ethnodecurrenciesmodule._getMonitoredCurrencySession(session, wallet, currency);
	}

	async _getMonitoredCurrencyCardSession(session, wallet, card) {
		var global = this.global;

		var cardsession = card._getSession();
		var currency = await this._findCardCurrency(session, wallet, card);

		if (!currency)
			return Promise.reject('not a currency card: ' + card.getCardUUID());

		var ethnodecurrenciesmodule = global.getModuleObject('ethnode-currencies');
		return ethnodecurrenciesmodule._getMonitoredCardSessionForCurrency(session, wallet, card, currency);
	}

	async _getMonitoredCardSessionForCurrency(session, wallet, card, currency) {
		var global = this.global;
		var cardsession = card._getSession();
		var ethnodecurrenciesmodule = global.getModuleObject('ethnode-currencies');
		return ethnodecurrenciesmodule._getMonitoredCardSessionForCurrency(session, wallet, card, currency);
	}



	//
	// Ethnode
	//

	_canWalletHandleScheme(wallet, scheme) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		return currenciesmodule._canWalletHandleScheme(wallet, scheme);
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

	_getSchemeSessionMap(session) {
		var schemesessionmap = session.getSessionVariable('schemesessionmap');
		
		if (!schemesessionmap) {
			schemesessionmap = Object.create(null);
			session.setSessionVariable('schemesessionmap', schemesessionmap);
		}

		return schemesessionmap;
	}

	async _getChildSessionOnScheme(parentsession, scheme) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		if (!parentsession)
			return Promise.reject('could not create child of null session');

		var schemesessionmap = this._getSchemeSessionMap(parentsession);
		
		// we could look if a pre-existing session with corresponding web3providerurl could be re-used
		var schemeuuid = scheme.getSchemeUUID();

		if (schemesessionmap[schemeuuid])
			return schemesessionmap[schemeuuid];

		// else we create one and set it
		var childsession = await _apicontrollers.createChildSessionObject(parentsession);
		childsession.MYCURRENCY = this.current_version;

		if (!parentsession.MYCURRENCY_ROOT)
			parentsession.MYCURRENCY_ROOT = (this.current_version ? this.current_version : 'xxx');

		var networkconfig = scheme.getNetworkConfig();

		await _apicontrollers.setSessionNetworkConfig(childsession, networkconfig);

		schemesessionmap[schemeuuid] = childsession;

		return childsession;
	}


	async _getMonitoredSchemeSession(session, wallet, scheme) {
		console.log('OBSOLETE: Module._getMonitoredSchemeSession should no longer be used, should use Module._getMonitoredCurrencySession!')
		var fetchsession;

		if (!scheme)
			return Promise.reject('scheme is not defined');

		if (scheme.isRemote()) {
			if (wallet) {
				var walletschemeuuid = wallet.getSchemeUUID();
				var schemeuuid = scheme.getSchemeUUID();
	
				if (this._canWalletHandleScheme(wallet, scheme)) {
					let walletsession = wallet._getSession();

					let network = scheme.getNetworkConfig();
					let ethnodeserver = (network.ethnodeserver ? network.ethnodeserver : {});

					if (ethnodeserver && ethnodeserver.web3_provider_url) {
						// scheme overloaded for serving ethnode access
						var schemesessionmap = this._getSchemeSessionMap(walletsession);

						fetchsession = schemesessionmap[scheme.uuid];
	
						if (!fetchsession) {
								// FIX v0.30.10: since version 0.30.10 does not pass web3providerurl to lower levels functions
								// and relies on session.ethereum_node_access_instance in getEthereumNodeAccessInstance(session)
								fetchsession = await this._createDummyWalletSession(walletsession);
								fetchsession.DUMMY_SESSION_SCHEME = scheme;
								schemesessionmap[scheme.uuid] = fetchsession;
	
								await this._setMonitoredEthereumNodeAccess(fetchsession, ethnodeserver);
							
					
							}
					}
					else {
						fetchsession = walletsession;
					}



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
	// Currency functions
	//

	// utils
	async _getAverageTransactionFee(session, currency, feelevel) {
		var global = this.global;
		var ethnodemodule = global.getModuleObject('ethnode');
		
		var avg_transaction_fee = Module.AVG_TRANSACTION_FEE;

		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.avg_transaction_fee)
			avg_transaction_fee = parseFloat(ethnodeserver.avg_transaction_fee.toString());

		return avg_transaction_fee * (feelevel && feelevel.avg_transaction_fee_multiplier ? parseInt(feelevel.avg_transaction_fee_multiplier) : 1);
	}

	async _getTransactionUnitsAsync(session, currency, transactioncredits) {
		// TODO: look if using DecimalAmount could improve the division
		return this._getTransactionUnits(session, currency, transactioncredits);
	}

	async _getTransactionUnits(session, currency, transactioncredits) {
		var global = this.global;
		var ethnodemodule = global.getModuleObject('ethnode');
		var ethcredit = ethnodemodule.getEtherFromwei(transactioncredits);
		
		var avg_transaction_fee = Module.AVG_TRANSACTION_FEE;

		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.avg_transaction_fee)
			avg_transaction_fee = parseFloat(ethnodeserver.avg_transaction_fee.toString());
		
		var units = ethcredit/(avg_transaction_fee > 0 ? avg_transaction_fee : Module.AVG_TRANSACTION_FEE);
		
		return Math.floor(units);
	}

	// minimal number of transactions
	async _getTransactionUnitsThreshold(session, currency, feelevel) {
		var number = Module.TRANSACTION_UNITS_MIN;
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.transaction_units_min)
			number = parseInt(ethnodeserver.transaction_units_min.toString());
		
		return number * (feelevel && feelevel.transaction_units_min_multiplier ? parseInt(feelevel.transaction_units_min_multiplier) : 1);
	}


	async _getTransactionCreditsAsync(session, currency, transactionunits) {
		var global = this.global;

		var transactioninfo  = {};

		transactioninfo.avg_transaction_fee = await this._getAverageTransactionFee(session, currency);
		transactioninfo.units_threshold = await this._getTransactionUnitsThreshold(session, currency);
		
		var ethnodemodule = global.getModuleObject('ethnode');
		var walletmodule = global.getModuleObject('wallet');

		var weiamount = ethnodemodule.getWeiFromEther(transactioninfo.avg_transaction_fee);
		var avg_transaction = await walletmodule.createDecimalAmountAsync(session, weiamount, 18);
		var credits_decimal = await avg_transaction.multiply(transactionunits);

		var credits = await credits_decimal.toInteger();
		
		return credits;
	}
	
	async _getTransactionCredits(session, currency, transactionunits) {
		var global = this.global;
		var ethnodemodule = global.getModuleObject('ethnode');
		
		var avg_transaction_fee = Module.AVG_TRANSACTION_FEE;

		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.avg_transaction_fee)
			avg_transaction_fee = parseFloat(ethnodeserver.avg_transaction_fee.toString());
		
		var transactioncredits = transactionunits*(avg_transaction_fee > 0 ? avg_transaction_fee : Module.AVG_TRANSACTION_FEE);
		var ethcredit = ethnodemodule.getEtherFromwei(transactioncredits);
		
		return ethcredit;
	}
	
	async _getGasLimit(session, currency, feelevel) {
		var default_gas_limit = Module.DEFAULT_GAS_LIMIT;
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.default_gas_limit)
			default_gas_limit = parseInt(ethnodeserver.default_gas_limit.toString());

		return default_gas_limit * (feelevel && feelevel.default_gas_limit_multiplier ? parseInt(feelevel.default_gas_limit_multiplier) : 1);
	}
	
	async _getGasPrice(session, currency, feelevel) {
		var default_gas_price = Module.DEFAULT_GAS_PRICE;
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.default_gas_price)
			default_gas_price = parseInt(ethnodeserver.default_gas_price.toString());
		
		return default_gas_price * (feelevel && feelevel.default_gas_price_multiplier ? parseInt(feelevel.default_gas_price_multiplier) : 1);
	}

	async _getGasUnit(session, currency) {
		var default_gas_unit = Module.DEFAULT_GAS_UNIT;
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		if (ethnodeserver && ethnodeserver.gas_unit)
			default_gas_unit = parseInt(ethnodeserver.gas_unit.toString());

		return default_gas_unit;
	}
	
	async _getUnitsFromCredits(session, currency, credits) {
		var units = await this._getTransactionUnits(session, currency, credits);
		
		return units;
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

	async transferCurrencyAmount(sessionuuid, walletuuid, cardfromuuid, cardtouuid, currencyuuid, currencyamount, feelevel = null) {
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

		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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
		
		var cardsession = await this._getMonitoredCardSessionForCurrency(session, wallet, fromcard, currency);
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

		var currenciesmodule = global.getModuleObject('currencies');

		return currenciesmodule.getCurrencyProvider(session, currency.uuid);
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
		var global = this.global;
		var currenciesmodule = global.getModuleObject('currencies');
		return currenciesmodule.getCurrencyScheme(session, currency);
	}

	async _getCurrencyEthNodeServer(session, currency) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('ethnode-currencies');
		return currenciesmodule.getCurrencyEthNodeServer(session, currency);
	}

	async _getCurrencyWeb3ProviderUrl(session, currency) {
		var global = this.global;
		var currenciesmodule = global.getModuleObject('ethnode-currencies');
		return currenciesmodule.getCurrencyWeb3ProviderUrl(session, currency);
	}

	async getCurrencyInfo(sessionuuid, walletuuid, currencyuuid) {
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

		var currencyinfo = {};

		currencyinfo.web3_provider_url = await this._getCurrencyWeb3ProviderUrl(session, currency);

		return currencyinfo;
	}


	
	_compareUrl(url1, url2) {
		var _url1 = (url1 && url1.endsWith('/') ? url1.substring(0, url1.length - 1 ) : url1);
		var _url2 = (url2 && url2.endsWith('/') ? url2.substring(0, url2.length - 1 ) : url2);

		if (_url1 && _url2 && (_url1 == _url2))
		return true;
		else
		return false;
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
				if (this._compareUrl(currency.web3providerurl, web3providerurl))
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

		if (!pretradeschemeuuid)
			return;

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
					var currencyscheme = await this._getCurrencyScheme(session, currency).catch(err => {});

					if (!currencyscheme) continue;
					
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

 	async readLocalCurrencies(sessionuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var _apicurrencies = this._getCurrenciesAPI();

		return _apicurrencies.readLocalCurrencies(session);
	}

	async saveLocalCurrencies(sessionuuid, currencies) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
			
		var _apicurrencies = this._getCurrenciesAPI();

		return _apicurrencies.saveLocalCurrencies(session, currencies);	
	}

	async saveLocalCurrency(sessionuuid, currency) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var _apicurrencies = this._getCurrenciesAPI();

		return _apicurrencies.saveLocalCurrency(session, currency);	
	}

 

	async getCurrencies(sessionuuid, walletuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var currenciesmodule = global.getModuleObject('currencies');
		var current_currencies_timestamp = currenciesmodule.getCurrenciesTimeStamp();

		// look if already stored in the session variables
		var currencies = session.getSessionVariable('currencies');

		if (currencies) {
			// verify version is up-to-date
			var currencies_timestamp = session.getSessionVariable('currencies-timestamp');

			if (currencies_timestamp === current_currencies_timestamp) {
				// send back copy from cached list
				var _currencies = await this._filterCurrencies(session, currencies, walletuuid);

				return _currencies;
			}
		}
	
		// otherwise retrieve the list of currencies
		var global = this.global;

		var currencies = currenciesmodule.getCurrencies();

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
			var currency_pretrade_scheme_json = (currency_pretrade_scheme ? currency_pretrade_scheme.getJsonConfig() : null);
			var currency_pretrade_ethnode_conf = (currency_pretrade_scheme_json && currency_pretrade_scheme_json.ethnodeserver ? currency_pretrade_scheme_json.ethnodeserver : null);

			array[i].pretrade_web3_provider_url = (currency_pretrade_ethnode_conf ? currency_pretrade_ethnode_conf.web3_provider_url : null)
			array[i].pretrade_explorer_url = (currency_pretrade_ethnode_conf ? currency_pretrade_ethnode_conf.explorerurl : null)
		}

		// store in session
		session.setSessionVariable('currencies', array);
		session.setSessionVariable('currencies-timestamp', current_currencies_timestamp);

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

	async getAllCurrenciesWithAddress(sessionuuid, walletuuid, address) {
		var currencies = await this.getCurrencies(sessionuuid, walletuuid);

		var arr = [];
		var tokenaddress = (address ? address.trim().toLowerCase() : null);

		for (var i = 0; i < (currencies ? currencies.length : 0); i++) {
			let _currencyaddress = (currencies[i].address ? currencies[i].address.trim().toLowerCase() : null);
			if (_currencyaddress == tokenaddress)
			arr.push(currencies[i]);
		}

		return arr;
	}

	async synchronizeCurrency(sessionuuid, walletuuid, currency) {
		// to fetch name, symbol,... if it went bad during the first import
		if (!currency)
			return Promise.reject('currency is undefined');
		
		if (!currency.address)
			return Promise.reject('currency has not token address');


		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
	
		var session = await _apicontrollers.getSessionObject(sessionuuid);
	
		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);
		
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);

		if (!wallet)
			return Promise.reject('could not find wallet ' + walletuuid);

		var currenciesmodule = global.getModuleObject('currencies');

		var currencyscheme = await currenciesmodule.getCurrencyScheme(session, currency);
	
		if (!currencyscheme)
			return Promise.reject('could not find scheme of currency ' + currency.uuid);
		
		var childsession = await this._getMonitoredCurrencySession(session, wallet, currency);

		// get erc20 token contract
		var erc20token_contract = await _apicontrollers.importERC20Token(childsession, currency.address);

		// re-fetch main elements
		currency.name = await erc20token_contract.getChainName();
		currency.symbol = await erc20token_contract.getChainSymbol();
		currency.decimals = await erc20token_contract.getChainDecimals();

		// then save currency
		await currenciesmodule.saveLocalCurrency(session, currency);

		return currency;
	}

	async setCurrencyDescription(sessionuuid, walletuuid, currencyuuid, description) {
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


		var currenciesmodule = global.getModuleObject('currencies');

		// set description
		currency.description = description;
		
		// then save currency
		await currenciesmodule.saveLocalCurrency(session, currency);

		return currency;
	}

	async getCurrenciesFromAddress(sessionuuid, walletuuid, schemeuuid, address) {
		var currencies = await this.getCurrencies(sessionuuid, walletuuid);

		var arr = [];
		var tokenaddress = (address ? address.trim().toLowerCase() : null);

		for (var i = 0; i < (currencies ? currencies.length : 0); i++) {
			let _currencyaddress = (currencies[i].address ? currencies[i].address.trim().toLowerCase() : null);
			if ((currencies[i].scheme_uuid == schemeuuid) && (_currencyaddress == tokenaddress))
			arr.push(currencies[i]);
		}

		return arr;
	}

	async getCurrencyScheme(sessionuuid, walletuuid, currencyuuid) {
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

		var currenciesmodule = global.getModuleObject('currencies');

		var scheme = await currenciesmodule.getCurrencyScheme(session, currency);

		var mvcclienwallet = global.getModuleObject('mvc-client-wallet');

		var schemeinfo = {uuid: scheme.getSchemeUUID()};

		mvcclienwallet._fillSchemeInfoFromScheme(schemeinfo, scheme);

		return schemeinfo;
	}

	async _getEthereumTransaction(session, txhash) {
		var global = this.global;

		var ethereumnodeaccessmodule = global.getModuleObject('ethereum-node-access');

		const result = new Promise((resolve, reject) => { 
			ethereumnodeaccessmodule.readEthereumTransactionObject(session, txhash, (err, res) => {
				if (err) reject(err);
				else {
					var ethereumnodeaccessmodule = global.getModuleObject('ethereum-node-access');
					var data = res.data;
					try {
						// can throw invalid UTF8 detected
						res.data_decoded_utf8 = ethereumnodeaccessmodule.web3ToUTF8(session, data);
					}
					catch(e) {}
				
					resolve(res);
				}
			})
			.then(res => {
				// fixing missing callback call when data == null
				// in EthereumNodeAccess.readEthereumTransactionObject
				if (res)
					return res;
				else
					throw new Error('no transaction found with hash ' + txhash);
			})
			.catch(err => {
				reject(err);
			});
		});
		
		return result;
	}

	async _readTransaction(session, txhash) {
		var global = this.global;
		
		var ethchainreadermodule = global.getModuleObject('ethchainreader');
		
		var chainreaderinterface = ethchainreadermodule.getChainReaderInterface(session);
		
		const result = new Promise((resolve, reject) => { 
			chainreaderinterface.getTransaction(txhash,(err, res) => {
				if (err) reject(err); 
				else {
					var ethereumnodeaccessmodule = global.getModuleObject('ethereum-node-access');
					var input = res.input;
					try {
						res.input_decoded_utf8 = ethereumnodeaccessmodule.web3ToUTF8(session, input);
					}
					catch(e) {}
				
					resolve(res);
				}
			})			
			.then(res => {
				// fixing missing callback calls when data == null
				// because of error read property of null in Transaction._createTransactionObject
				if (res)
					return res;
				else
					throw new Error('no transaction found with hash ' + txhash);
			})
			.catch(err => {
				reject(err);
			});
		});
		
		return result;
	}

	async getCurrencyEthereumTransaction(sessionuuid, walletuuid, currencyuuid, txhash) {
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

		var childsession = await this._getMonitoredCurrencySession(session, wallet, currency);

		// TODO: uncomment for version >= 0.30.8
		//var ethereumtransaction = await _apicontrollers.getEthereumTransaction(childsession, txhash);
		var ethereumtransaction = await this._getEthereumTransaction(childsession, txhash);
		
		ethereumtransaction._ethtx = await this._readTransaction(childsession, txhash);
		//ethereumtransaction._ethtx = await apicontrollers.readTransaction(childsession, txhash);

		return ethereumtransaction;
	}

	async getCurrencyEthereumTransactionReceipt(sessionuuid, walletuuid, currencyuuid, txhash) {
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
	

		var childsession = await this._getMonitoredCurrencySession(session, wallet, currency);

		var ethereumtransactionreceipt = await _apicontrollers.getEthereumTransactionReceipt(childsession, txhash);

		return ethereumtransactionreceipt;
	}

	async getCurrencyERC20TokenInfo(sessionuuid, walletuuid, currencyuuid, tokenaddress) {
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
	

		var childsession = await this._getMonitoredCurrencySession(session, wallet, currency);

		// get erc20 token contract
		var erc20token_contract = await _apicontrollers.importERC20Token(childsession, tokenaddress);

		var token = {address: tokenaddress};

		token.name = await erc20token_contract.getChainName();
		token.symbol = await erc20token_contract.getChainSymbol();
		token.decimals = await erc20token_contract.getChainDecimals();

		return token;
	}

	async getCurrencyTransactionInfo(sessionuuid, walletuuid, currencyuuid, txhash) {
		var tx_info = {hash: txhash};

		if (!sessionuuid)
			return tx_info;

		if (!walletuuid)
			return tx_info;

		if (!currencyuuid)
			return tx_info;

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
	
	
		try {
			let bTokenTx = false;

			// TODO: find if this is a token transaction

			// get transaction for more specific info
			let transaction = await this.getCurrencyEthereumTransaction(sessionuuid, walletuuid, currencyuuid, txhash)
			.catch(err => {
				console.log('could not retrieve transaction in getCurrencyTransactionInfo: ' + err);
			});
			let tx = (transaction ? transaction._ethtx : null);

			if (tx) {
				tx_info.time = tx.time;
				tx_info.status_int = 5; // pending

				// get transaction receipt
				let tx_receipt = await this.getCurrencyEthereumTransactionReceipt(sessionuuid, walletuuid, currencyuuid, txhash).catch(err => {});

				if (tx_receipt) {
					tx_info.blockNumber = tx_receipt.blockNumber;
					tx_info.from_address = tx_receipt.from;
					tx_info.status = tx_receipt.status;
					tx_info.status_int = (tx_receipt.status ? 10 : -10); // 1 success, -1 fail
		
					if (bTokenTx) {
						// erc20 format
						tx_info.tokenaddress = tx_receipt.to
						tx_info.amount = (tx_receipt.logs && tx_receipt.logs[0] ? parseInt(tx_receipt.logs[0].data) : null);
						tx_info.to_address = (tx_receipt.logs && tx_receipt.logs[0] && tx_receipt.logs[0].topics && tx_receipt.logs[0].topics[2] ? '0x' + tx_receipt.logs[0].topics[2].substring(26) : null);
					}
				}
			}
			else {
				tx_info.status_int = -5; // not found
			}
		}
		catch(e) {
			console.log('exception in getCurrencyTransactionInfo: ' + e);
		}

		return tx_info;
	}

	async getCurrencyTransactionUnitsThreshold(sessionuuid, walletuuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var _apicontrollers = this._getClientAPI();
		var session = await _apicontrollers.getSessionObject(sessionuuid);

		if (!session)
			return Promise.reject('could not find session ' + sessionuuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);

		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);

		
		var threshold = await this._getTransactionUnitsThreshold(session, currency);
		
		return threshold;
	}

	//
	// Currency Card functions
	//

	async getTokenCardList(sessionuuid, walletuuid, web3providerurl, tokenaddress) {
		if (!web3providerurl || !tokenaddress)
		return [];

		var currencies = await this.getCurrencies(sessionuuid, walletuuid);
		var _web3providerurl = (web3providerurl.endsWith('/') ? web3providerurl.substring(0, web3providerurl.length - 1 ) : web3providerurl);

		// list of currencies
		var arr = [];

		for (var i = 0; i < (currencies ? currencies.length : 0); i++) {
			var _currency = currencies[i];
			var _currency_scheme = await this.getCurrencyScheme(sessionuuid, walletuuid, _currency.uuid).catch(err => {});

			var _web3_provider_url = ( _currency_scheme && _currency_scheme.network && _currency_scheme.network.ethnodeserver ? _currency_scheme.network.ethnodeserver.web3_provider_url : null);
			_web3_provider_url = (_web3_provider_url && _web3_provider_url.endsWith('/') ? _web3_provider_url.substring(0, _web3_provider_url.length - 1 ) : _web3_provider_url);
			
			if (_web3_provider_url && (this._compareUrl(_web3_provider_url, _web3providerurl)) && (_currency.address == tokenaddress))
			arr.push(currencies[i]);
		}

		// get list of all cards
		var cards = [];

		for (var i = 0; i < arr.length; i++) {
			var _currency = arr[i];
			var _currency_cards = await this.getCurrencyCardList(sessionuuid, walletuuid, _currency.uuid).catch(err => {});

			if (_currency_cards)
			cards = cards.concat(_currency_cards);
		}

		return cards;
	}


	async _getCurrencyCardList(session, wallet, currency) {
		if (!session)
			return Promise.reject('session is undefined');
		
		if (!wallet)
			return Promise.reject('wallet is undefined');

		if (!currency)
			return Promise.reject('currency is undefined');

		var global = this.global;
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');

		var cards = await wallet.getCardList(true);

		var array = [];

		var scheme = await this._getCurrencyScheme(session, currency).catch(err => {});

		if (!scheme)
			return Promise.reject('could not find scheme for currency ' + currency.uuid);

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

		var cards = await this._getCurrencyCardList(session, wallet, currency).catch(err => {});
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


	async _findCardCurrency(session, wallet, card) {
		let xtradata = card.getXtraData('myquote');

		if (xtradata && xtradata.currencyuuid) {
			let currency = await this.getCurrencyFromUUID(session.getSessionUUID(), xtradata.currencyuuid);

			return currency;
		}
	}

	async findCardCurrency(sessionuuid, walletuuid, carduuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
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

		var card = await wallet.getCardFromUUID(carduuid);
	
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		return this._findCardCurrency(session, wallet, card);
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

		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');

		var cardinfo = {uuid: card.getCardUUID()};

		mvcclientwalletmodule._fillCardInfo(cardinfo, card);

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
		var currencycards = await this._getCurrencyCardList(session, wallet, currency).catch(err => {});

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

		// note: wallet.importCard uses getFirstCardWithAddress which replaces
		// a pre-existing currency card

		var sessionaccount = await _apicontrollers.getSessionAccountFromPrivateKey(session, wallet, privatekey);
		var card_address = sessionaccount.getAddress();

		var sibling_cards = await wallet.getCardsWithAddress(card_address).catch(err => {});
		sibling_cards = (sibling_cards ? sibling_cards : []);

		// create a wallet card
		//const card = await this._createWalletCard(session, wallet, scheme, privatekey); 
		const card = await _apicontrollers.createWalletCard(session, wallet, scheme, privatekey);


		if (sibling_cards.length > 0) {
			try {
				// we already had at least a card with same address
				// and createWalletCard returned us the first card
				let _xtradata = card.getXtraData('myquote');

				_xtradata = (_xtradata ? _xtradata : {});
				let _former_currencyuuid = _xtradata.currencyuuid;

				if (_former_currencyuuid && (_former_currencyuuid != currencyuuid)) {
					// we will overload the currency when saving
					// look if we have no other card for this currency
					// to re-add it if necessary
					let bInsert = true;

					for (var i = 1; i < sibling_cards.length; i++) {
						let sibling_card = sibling_cards[i];
						let _sibling_xtradata = sibling_card.getXtraData('myquote');
						let _sibling_currencyuuid = _sibling_xtradata.currencyuuid;

						if (_sibling_currencyuuid == _former_currencyuuid) {
							bInsert = false;
							break;
						}
					}

					if (bInsert === true) {
						// we re-insert the card that has been replaced
						let _old_card = await wallet.cloneCard(card, scheme).catch(err => {});

						if (_old_card) {
							// re-initialize
							if (_old_card.isLocked()) {
								await _old_card.unlock();
							}

							let _old_xtradata = Object.assign({}, _xtradata);

							xtradata = (xtradata ? xtradata : {});
							_old_xtradata.currencyuuid = _former_currencyuuid;
					
							_old_card.putXtraData('myquote', _old_xtradata);

							await _old_card.save()
						}					
					}

				}
			}
			catch(e) {
				console.log('could not re-insert pre-existing currency card: ' + card_address);
			};

		}

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
		var currencycards = await this._getCurrencyCardList(session, wallet, currency).catch(err => {});

		if (!currencycards || (currencycards.length == 1)) {
			await this.setCurrencyCard(sessionuuid, walletuuid, currencyuuid, card.uuid);
		}

		// return cardinfo
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
		var cardinfo = {};

		mvcclientwalletmodule._fillCardInfo(cardinfo, card);
		
		return cardinfo;
	}

	async makeCurrencyCard(sessionuuid, walletuuid, currencyuuid, carduuid) {
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
		var currencycards = await this._getCurrencyCardList(session, wallet, currency).catch(err => {});

		if (!currencycards || (currencycards.length == 1)) {
			await this.setCurrencyCard(sessionuuid, walletuuid, currencyuuid, card.uuid);
		}

		// return cardinfo
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
		var cardinfo = {};

		mvcclientwalletmodule._fillCardInfo(cardinfo, card);
		
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

		// look if we have a card with this address for this currency
		var card;
		var cardarray = await wallet.getCardsWithAddress(address);

		for (var i = 0; i < (cardarray ? cardarray.length : 0); i++) {
			let xtradata = cardarray[i].getXtraData('myquote');

			xtradata = (xtradata ? xtradata : {});
			
			if (xtradata.currencyuuid == currencyuuid) {
				card = cardarray[i];
				break;
			}
		}

		if (card) {
			// return cardinfo
			var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
			var cardinfo = {};

			mvcclientwalletmodule._fillCardInfo(cardinfo, card);
			
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
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
		var cardinfo = {};

		mvcclientwalletmodule._fillCardInfo(cardinfo, card);
		
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
		console.log('OBSOLETE: Module.getCurrencyPosition should no longer be used, should use Module.getCurrencyCardPosition!')
		return this.getCurrencyCardPosition(sessionuuid, walletuuid, currencyuuid, carduuid);
	}


	async getCurrencyCardPosition(sessionuuid, walletuuid, currencyuuid, carduuid) {
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

		var card;
		if (!carduuid) {
			card = await this._getCurrencyCard(session, wallet, currency).catch(err => {});

			if (!card)
			return Promise.reject('could not find card for currency ' + currencyuuid);
		}
		else {
			card = await wallet.getCardFromUUID(carduuid);

			if (!card)
				return Promise.reject('could not find card for ' + carduuid);
		}



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
			var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
			cardinfo = await mvcclientwalletmodule. getCardInfo(sessionuuid, walletuuid, carduuid);

			// TODO: check this card is associated with the currency or send Promise.reject
		}
		
		
		var cardaddress = cardinfo.address;
		
		// get a childsession on currency scheme
		var childsession = await this._getMonitoredCardSessionForCurrency(session, wallet, card, currency);
		var position;
		var web3providerurl = await this._getCurrencyWeb3ProviderUrl(childsession, currency);

		position = await _apicontrollers.getAddressERC20Position(childsession, web3providerurl, tokenaddress, cardaddress)
		.catch((err) => {
			position = 0;
		});

		var currency_amount = await this._createCurrencyAmount(childsession, currency, position);

		return currency_amount;
	}

	async getCurrencyCardCredits(sessionuuid, walletuuid, currencyuuid) {
		console.log('OBSOLETE: Module.getCurrencyCardCredits should no longer be used, should use Module.getCurrencyCardCreditBalance!')
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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

		var credits = await this.getCurrencyCardCreditBalance(sessionuuid, walletuuid, carduuid, currencyuuid);

		credits.threshold = await this.getCurrencyTransactionUnitsThreshold(sessionuuid, walletuuid, currencyuuid);

		return credits;
	}

	async getCreditBalance(sessionuuid, walletuuid, carduuid, currencyuuid) {
		console.log('OBSOLETE: Module.getCreditBalance should no longer be used, should use Module.getCurrencyCardCreditBalance!')
		return this.getCurrencyCardCreditBalance(sessionuuid, walletuuid, carduuid, currencyuuid)
	}


	async getCurrencyCardCreditBalance(sessionuuid, walletuuid, carduuid, currencyuuid) {
		
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
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		var card = await wallet.getCardFromUUID(carduuid);
		
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);

		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);
		
		var childsession = await this._getMonitoredCardSessionForCurrency(session, wallet, card, currency);

		var ethereumnodeaccess;
		
		if (childsession.ethereum_node_access_instance) {
			// _getMonitoredCurrencySession has set ethereumnodeaccess for a remote access
			ethereumnodeaccess = childsession.ethereum_node_access_instance;
		}
		else {
			let ethnodemodule = global.getModuleObject('ethnode');
			
			ethereumnodeaccess  = ethnodemodule.getEthereumNodeAccessInstance(childsession);
		}
	
		//var transactioncredits = await card.getTransactionCredits();
		//var transactionunits = await card.getTransactionUnits();
		var card_address = card.getAddress();
		var transactioncredits = await ethereumnodeaccess.web3_getBalance(card_address);
		var transactionunits = await this._getTransactionUnits(session, currency, transactioncredits);
	
		
		var credits = {transactioncredits: transactioncredits, transactionunits: transactionunits};

		// add threshold		
		//credits.threshold = await this.getCurrencyTransactionUnitsThreshold(sessionuuid, walletuuid, currencyuuid);
		credits.threshold = await this._getTransactionUnitsThreshold(session, currency);

		return credits;
	}



	async getCurrencyTransactionContext(sessionuuid, currencyuuid, feelevel = null) {
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
	
		var transactioninfo  = {};

		transactioninfo.gasLimit = await this._getGasLimit(session, currency, feelevel);
		transactioninfo.gasPrice = await this._getGasPrice(session, currency, feelevel);
		transactioninfo.avg_transaction_fee = await this._getAverageTransactionFee(session, currency, feelevel);
		transactioninfo.units_threshold = await this._getTransactionUnitsThreshold(session, currency, feelevel);
		
		var ethnodemodule = global.getModuleObject('ethnode');

		var weiamount = ethnodemodule.getWeiFromEther(transactioninfo.avg_transaction_fee);
		var avg_transaction = await this._createDecimalAmount(session, weiamount, 18);
		var credits_threshold = await avg_transaction.multiply(transactioninfo.units_threshold);

		transactioninfo.credits_threshold = await credits_threshold.toInteger();

		return transactioninfo;
	}

	async _getRecommendedFeeLevel(session, wallet, card, currency, tx_fee) {
		// standard fee level
		var	feelevel = {
			default_gas_limit_multiplier: 1,
			default_gas_price_multiplier: 1,
			avg_transaction_fee_multiplier: 1, 
			transaction_units_min_multiplier: 1
		};

		// get scheme transaction info
		var sessionuuid = session.getSessionUUID();
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		var tx_info = await this.getCurrencyTransactionContext(sessionuuid, currency.uuid, feelevel);

		var gasLimit = tx_info.gasLimit;
		var gasPrice = tx_info.gasPrice;
		var avg_transaction_fee = tx_info.avg_transaction_fee;

		var gas_unit = (ethnodeserver && ethnodeserver.gas_unit ? parseInt(ethnodeserver.gas_unit) : 21000);
		var credit_cost_unit_ratio = (avg_transaction_fee * 1000000000000000000) / (gas_unit * gasPrice);

		// execution cost
		var units_exec_fee; 
		var credits_exec_fee;
		
		if (tx_fee.estimated_cost_credits) {
			credits_exec_fee = tx_fee.estimated_cost_credits;
			units_exec_fee = await this._getUnitsFromCredits(session, currency, credits_exec_fee);
		}
		else {
			units_exec_fee = (tx_fee.estimated_cost_units ? Math.ceil(tx_fee.estimated_cost_units / credit_cost_unit_ratio) : 1);
			credits_exec_fee = await this._getTransactionCreditsAsync(session, currency, units_exec_fee);
		}

		// max price
		var credits_max_fee = gasLimit * gasPrice;
		var units_max_fee =  await this._getUnitsFromCredits(session, currency, credits_max_fee);

		if (units_exec_fee > units_max_fee)
			feelevel.default_gas_limit_multiplier = Math.ceil(units_exec_fee / units_max_fee);

		return feelevel;
	}

	async getRecommendedFeeLevel(sessionuuid, walletuuid, carduuid, currencyuuid, tx_fee) {
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

		return this._getRecommendedFeeLevel(session, wallet, card, currency, tx_fee);
	}



	async computeTransactionFee(sessionuuid, walletuuid, carduuid, currencyuuid, tx_fee, feelevel = null) {
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

		// get scheme transaction info
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		var tx_info = await this.getCurrencyTransactionContext(sessionuuid, currency.uuid, feelevel);

		var gasLimit = tx_info.gasLimit;
		var gasPrice = tx_info.gasPrice;
		var avg_transaction_fee = tx_info.avg_transaction_fee;

		var gas_unit = (ethnodeserver && ethnodeserver.gas_unit ? parseInt(ethnodeserver.gas_unit) : 21000);
		var credit_cost_unit_ratio = (avg_transaction_fee * gasPrice) / gas_unit;

		// execution cost
		var units_exec_fee; 
		var credits_exec_fee;
		
		if (tx_fee.estimated_cost_credits) {
			credits_exec_fee = tx_fee.estimated_cost_credits;
			units_exec_fee = await this._getUnitsFromCredits(session, currency, credits_exec_fee);
		}
		else {
			units_exec_fee = (tx_fee.estimated_cost_units ? Math.ceil(tx_fee.estimated_cost_units / credit_cost_unit_ratio) : 1);
			credits_exec_fee = await this._getTransactionCreditsAsync(session, currency, units_exec_fee);
		}

		// transferred value
		var units_transferred;
		var credits_transferred;

		if (tx_fee.transferred_credits) {
			credits_transferred = tx_fee.transferred_credits;
			units_transferred = await this._getUnitsFromCredits(session, currency, credits_exec_fee);
		}
		else {
			units_transferred = tx_fee.transferred_credit_units;
			credits_transferred = await this._getTransactionCreditsAsync(session, currency, units_transferred);
		}

		// max price
		var credits_max_fee = gasLimit * gasPrice;
		var units_max_fee =  await this._getUnitsFromCredits(session, currency, credits_max_fee);

		// fill tx_fee
		tx_fee.tx_info = tx_info;

		tx_fee.estimated_fee = {};

		// estimated execution fee
		tx_fee.estimated_fee.execution_units = units_exec_fee; 
		tx_fee.estimated_fee.execution_credits = credits_exec_fee; 

		// estimated transaction total
		tx_fee.estimated_fee.total_credits = credits_exec_fee + credits_transferred; 
		tx_fee.estimated_fee.total_units = await this._getUnitsFromCredits(session, currency, tx_fee.estimated_fee.total_credits); 

		// max fee
		tx_fee.estimated_fee.max_units = units_max_fee; 
		tx_fee.estimated_fee.max_credits = credits_max_fee; 

		// required balance
		if (tx_fee.estimated_fee.max_credits > tx_fee.estimated_fee.total_credits) {
			tx_fee.required_credits = tx_fee.estimated_fee.max_credits;
		}
		else {
			if (tx_fee.estimated_fee.max_credits >= tx_fee.estimated_fee.execution_credits)
				tx_fee.required_credits = tx_fee.estimated_fee.max_credits + credits_transferred; // because of "Insufficient funds for gas * price + value" web3 error
			else {
				tx_fee.required_credits = tx_fee.estimated_fee.total_credits; // won't go through because will reach gas limit
				tx_fee.limit_overdraft = true;
			}
		}
		
		tx_fee.required_units =  await this._getUnitsFromCredits(session, currency, tx_fee.required_credits); 

		return tx_fee;
	}

	async canCompleteTransaction(sessionuuid, walletuuid, carduuid, currencyuuid, tx_fee, feelevel = null) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');

		// get card balance
		const credits = await this.getCurrencyCardCreditBalance(sessionuuid, walletuuid, carduuid, currencyuuid);

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

		// can the card send transactions
		var cardaccount = card._getSessionAccountObject();

		if (!cardaccount)
			return false;

		var privatekey = cardaccount.getPrivateKey();
	
		if (!privatekey)
			return false;


		// get transaction fee
		var tx_fee = await this.computeTransactionFee(sessionuuid, walletuuid, carduuid, currencyuuid, tx_fee, feelevel);

		// check estimated cost is not above max credits (corresponds to tx_fee.limit_overdraft == true)
		if (tx_fee.estimated_fee.execution_credits > tx_fee.estimated_fee.max_credits) {
			return false;
		}

		// check balance in units is above requirement
		if (credits.transactionunits < tx_fee.required_units) {
			return false;
		}

		// check
		var tx_info = tx_fee.tx_info;
		var scheme_units_threshold = tx_info.units_threshold;
		var scheme_credits_threshold = tx_info.credits_threshold;

		if (scheme_credits_threshold > credits.transactioncredits) {
			if (tx_fee.threshold_enforced === true) {
				tx_fee.required_units = scheme_credits_threshold;
				return false;
			}
			else {
				tx_fee.threshold_unmet = true;
			}
		}


		return true;
	}

	async topUpCard(sessionuuid, walletuuid, carduuid, currencyuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		

		var _apicontrollers = this._getClientAPI();
		var session = await _apicontrollers.getSessionObject(sessionuuid);
		var wallet = await _apicontrollers.getWalletFromUUID(session, walletuuid);
		
		var currency = await this.getCurrencyFromUUID(sessionuuid, currencyuuid);

		if (!currency)
			return Promise.reject('could not find currency ' + currencyuuid);
	
		var card = await wallet.getCardFromUUID(carduuid);
		var address = card.getAddress();
		
		var ethnodeserver = await this._getCurrencyEthNodeServer(session, currency);
		
		var childsession = await this._getMonitoredCardSessionForCurrency(session, wallet, card, currency);

		var topinfo = await new Promise((resolve, reject) => {
			var restconnection = childsession.createRestConnection(ethnodeserver.rest_server_url, ethnodeserver.rest_server_api_path);

			if (restconnection) {
				if (restconnection._isReady()) {
					var resource = "/faucet/topup/" + address;
					
					restconnection.rest_get(resource, (err, res) => {
						var data = (res ? res['data'] : null);
						if (data) {
							resolve(data);
						}
						else {
							reject('rest error calling ' + resource + ' : ' + err);
						}
						
					});
				}
				else {
					reject('rest connection can not issue a faucet request');
				}
			}
			else {
				reject('no rest server to receive faucet request');
			}
		});
		
		return topinfo;
	}

	async _createCurrencyFee(session, currency, feelevel) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();
		var fee = _apicontrollers.createFee(feelevel);
		
		if (currency) {
			fee.gaslimit = await this._getGasLimit(session, currency, feelevel);
			fee.gasPrice = await this._getGasPrice(session, currency, feelevel);
		}	
		
		return fee;
	}

	async _transferTransactionUnits(session, wallet, currency, fromaccount, toaddress, units, feelevel) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var childsession = await this._getMonitoredCurrencySession(session, wallet, currency);

		var transactioninfo = await this.getCurrencyTransactionContext(session.getSessionUUID(), currency.uuid, feelevel);

		// create transaction object
		var transaction = _apicontrollers.createEthereumTransaction(childsession, fromaccount);
		
		// parameters
		var ethnodemodule = global.getModuleObject('ethnode');

		var weiamount = ethnodemodule.getWeiFromEther(transactioninfo.avg_transaction_fee);
		var ethamount = await this._createDecimalAmount(childsession, weiamount, 18);
		ethamount.multiply(units);
		var valuestring = await ethamount.toFixedString();

		transaction.setToAddress(toaddress);
		transaction.setValue(valuestring);

		// fee
		var fee = await this._createCurrencyFee(session, currency, feelevel);

		transaction.setGas(fee.gaslimit);
		transaction.setGasPrice(fee.gasPrice);

		
		const txhash = await _apicontrollers.sendEthereumTransaction(childsession, transaction)
		.catch((err) => {
			console.log('error in transferTransactionUnits: ' + err);
		});

		if (!txhash)
			return Promise.reject('could not send ethereum transaction');

		return txhash;		
	}

	async _transferCardTransactionUnitsForCurrency(session, wallet, currency, card, toaddress, units, feelevel) {
		var global = this.global;
		var _apicontrollers = this._getClientAPI();

		var childsession = await this._getMonitoredCardSessionForCurrency(session, wallet, card, currency);

		var transactioninfo = await this.getCurrencyTransactionContext(session.getSessionUUID(), currency.uuid, feelevel);

		// create transaction object
		var fromaccount = card._getSessionAccountObject();

		var transaction = _apicontrollers.createEthereumTransaction(childsession, fromaccount);
		
		// parameters
		var ethnodemodule = global.getModuleObject('ethnode');

		var weiamount = ethnodemodule.getWeiFromEther(transactioninfo.avg_transaction_fee);
		var ethamount = await this._createDecimalAmount(childsession, weiamount, 18);
		ethamount.multiply(units);
		var valuestring = await ethamount.toFixedString();

		transaction.setToAddress(toaddress);
		transaction.setValue(valuestring);

		// fee
		var fee = await this._createCurrencyFee(session, currency, feelevel);

		transaction.setGas(fee.gaslimit);
		transaction.setGasPrice(fee.gasPrice);

		
		const txhash = await _apicontrollers.sendEthereumTransaction(childsession, transaction)
		.catch((err) => {
			console.log('error in transferTransactionUnits: ' + err);
		});

		if (!txhash)
			return Promise.reject('could not send ethereum transaction');

		return txhash;
	}


	async transferTransactionUnits(sessionuuid, walletuuid, cardfromuuid, currencyuuid, cardtouuid, units, feelevel = null) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!cardfromuuid)
			return Promise.reject('from card uuid is undefined');
		
		if (!cardtouuid)
			return Promise.reject('to card uuid is undefined');
		
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
	
		var fromcard = await wallet.getCardFromUUID(cardfromuuid);
		
		if (!fromcard)
			return Promise.reject('could not find card ' + cardfromuuid);

		var tocard = await wallet.getCardFromUUID(cardtouuid);
	
		if (!tocard)
			return Promise.reject('could not find card ' + cardtouuid);
	
	
		var fromaccount = fromcard._getSessionAccountObject();

		if (!fromaccount)
			return Promise.reject('card has no private key ' + cardfromuuid);
		
		var toaddress = tocard.getAddress();

		//return this._transferTransactionUnits(session, wallet, currency, fromaccount, toaddress, units, feelevel);
		return this._transferCardTransactionUnitsForCurrency(session, wallet, currency, fromcard, toaddress, units, feelevel);
	}

	async sendTransactionUnits(sessionuuid, walletuuid, cardfromuuid, currencyuuid, toaddress, units, feelevel = null) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');

		if (!cardfromuuid)
			return Promise.reject('card uuid is undefined');
		
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
		
		var fromcard = await wallet.getCardFromUUID(cardfromuuid);
	
		if (!fromcard)
			return Promise.reject('could not find card ' + cardfromuuid);
			
		var fromaccount = fromcard._getSessionAccountObject();

		if (!fromaccount)
			return Promise.reject('card has no private key ' + cardfromuuid);
		
		//return mvcclientwalletmodule.transferSchemeTransactionUnits(sessionuuid, walletuuid, schemeuuid, fromprivatekey, toaddress, units, feelevel);
		//return this._transferTransactionUnits(session, wallet, currency, fromaccount, toaddress, units, feelevel);
		return this._transferCardTransactionUnitsForCurrency(session, wallet, currency, fromcard, toaddress, units, feelevel);
	}

	async canPayAmount(sessionuuid, walletuuid, carduuid, currencyuuid, amount, tx_fee, feelevel = null) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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


		// can the card send transactions
		var cardaccount = card._getSessionAccountObject();

		if (!cardaccount)
			return false;

		var privatekey = cardaccount.getPrivateKey();
	
		if (!privatekey)
			return false;


		// first look if we have enough transaction units
		if (currency.ops.cantxfree !== true) {
			var _tx_fee = (tx_fee ? tx_fee : {transferred_credit_units: 0, estimated_cost_units: 3} );
			let _feelevel;

			if (feelevel)
			_feelevel = feelevel;
			else
			_feelevel = await this.getRecommendedFeeLevel(sessionuuid, walletuuid, carduuid, _tx_fee);

			var canspend = await this.canCompleteTransaction(sessionuuid, walletuuid, carduuid, _tx_fee, _feelevel).catch(err => {});

			if (!canspend)
				return false;
		}

		// then look if we enough currency amount
		var currencyposition = await this.getCurrencyPosition(sessionuuid, walletuuid, currencyuuid, carduuid);
		var tokenamountmax = await currencyposition.toInteger();

		if (amount > tokenamountmax)
			return false;

		return true;
	}


	async payAmount(sessionuuid, walletuuid, carduuid, toaddress, currencyuuid, amount, feelevel = null) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
		if (!carduuid)
			return Promise.reject('card uuid is undefined');

		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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
		// (if we need to have credit units)
		var ops = await this._getCurrencyOps(session, currency);

		if ((ops.cantxfree !== true) && (ops.cantopup === true)) {
			const topupinfo = await mvcclientwalletmodule.topUpCard(sessionuuid, walletuuid, carduuid)		
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
		var tokenamount_string = tokenamount.toString(); // use string to avoid "fault='overflow', operation='BigNumber.from'"

	
		// using token account to make transfer
/* 		
		var tokenaccount = await this._getTokenAccountFromAddress(session, card, tokenaddress).catch(err => {});

		// create contact from toaddress
		var name = toaddress;
		var contactinfo = {};
		var tocontact = await _apicontrollers.createContact(session, name, toaddress, contactinfo).catch(err => {});

		await tokenaccount.transferTo(contact, tokenamount_string);
 */

		// using direct call to ERC20 to speed up call
		var cardsession = await this._getMonitoredCardSessionForCurrency(session, wallet, card, currency);
		var fromaccount = card._getSessionAccountObject();

		var scheme = await this._getCurrencyScheme(session, currency);

		var providerurl = await this._getCurrencyWeb3ProviderUrl(session, currency);
		var fee  = await _apicontrollers.createSchemeFee(scheme, feelevel);
		var value = 0;

		const credits = await this.getCurrencyCardCreditBalance(sessionuuid, walletuuid, carduuid, currencyuuid)
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

		var txhash = await _apicontrollers.transferERC20Tokens(cardsession, providerurl, tokenaddress, tokenamount_string, ethtx);

		return txhash;
	}

	async payAndReport(sessionuuid, walletuuid, toaddress, currencyuuid, amount) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!currencyuuid)
			return Promise.reject('currency uuid is undefined');
		
		var global = this.global;
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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

	async getCurrencyTotalSupply(sessionuuid, walletuuid, currencyuuid) {
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

		var currenciesmodule = global.getModuleObject('currencies');

		var childsession = await this._getMonitoredCurrencySession(session, wallet, currency);


		var tokenaddress = currency.address;

		var erc20token = await _apicontrollers.importERC20Token(childsession, tokenaddress);

		var totalsupply = await erc20token.getChainTotalSupply();

		return totalsupply;
	}

	async _getAddressFromTokenUUID(session, wallet, card, tokenuuid) {
		var global = this.global;

		if (card.isLocked()) {
			await card.unlock();
		}

		var erc20tokenaccount = await card.importTokenAccount(tokenuuid);
		// this creates a token account associated to carduuid

		if (!erc20tokenaccount)
			return Promise.reject('could not find token ' + tokenuuid);

		var token = erc20tokenaccount.getToken();

		var tokenaccountsession = erc20tokenaccount._getSession();

		var erc20tokencontract = token._getERC20TokenContract(tokenaccountsession);
		var contractinterface = erc20tokencontract.getContractInterface();
		var contractinstance = contractinterface.getContractInstance();

		// TODO: remove once EthereumNodeAccessInstance._findTransactionFromUUID(transactionuuid) is fixed
		var ethereumnodeaccessinstance = contractinstance.getEthereumNodeAccessInstance();

		ethereumnodeaccessinstance.MYWIDGET_OVERLOAD = Date.now();
		ethereumnodeaccessinstance._findTransactionFromUUID = (transactionuuid) => {
			var self = ethereumnodeaccessinstance;

			// get local list
			var jsonarray = self._readTransactionLogs();

			for (var i = 0; i < (jsonarray ? jsonarray.length : 0); i++) {
				var tx_log = jsonarray[i];
				if (tx_log.transactionuuid == transactionuuid)
				return tx_log.transactionHash;
			}

		};

		// END

		var tokenaddress = await contractinterface.getAddressFromTransactionUUID(tokenuuid);

		return tokenaddress;
	}

	async importCurrencyFromTokenUUID(sessionuuid, walletuuid, carduuid, tokenuuid) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
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

		var card = await wallet.getCardFromUUID(carduuid);
	
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		var tokenaddress = await this._getAddressFromTokenUUID(session, wallet, card, tokenuuid);

		if (!tokenaddress)			
			return Promise.reject('could not find address for token ' + tokenuuid);

		return this.importCurrencyFromTokenAddress(sessionuuid, walletuuid, carduuid, tokenaddress);
	}

	async importCurrencyFromTokenAddress(sessionuuid, walletuuid, carduuid, tokenaddress) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
			return Promise.reject('wallet uuid is undefined');
		
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

		var card = await wallet.getCardFromUUID(carduuid);
	
		if (!card)
			return Promise.reject('could not find card ' + carduuid);

		var cardsession = await this._getMonitoredCurrencyCardSession(session, wallet, card);


		// get erc20 token contract
		var erc20token_contract = await _apicontrollers.importERC20Token(cardsession, tokenaddress);

		var currency = {uuid: session.guid(), address: tokenaddress, xtra_data: {origin: 'import-from-token-address'}};

		currency.name = await erc20token_contract.getChainName();
		currency.symbol = await erc20token_contract.getChainSymbol();
		currency.decimals = await erc20token_contract.getChainDecimals();

		currency.scheme_uuid = card.getSchemeUUID();
		currency.ops = {canpay: true};
		currency.provider = 'provider.js';

		// save currency
		await this.saveLocalCurrency(sessionuuid, currency);

		// make card as a currency card for this new currency
		var currencyuuid = currency.uuid;

		await this.makeCurrencyCard(sessionuuid, walletuuid, currencyuuid, carduuid);

		return currency;
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

		// TEST
		var scheme_config_list = await _apicontrollers.getSchemeConfigList(session, true);
		// TEST
			
			

		var cards = await this._getCurrencyCardList(session, wallet, currency).catch(err => {});

		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
		var array = [];
				
		for (var i = 0; i < (cards ? cards.length : 0); i++) {
			var carduuid = cards[i].getCardUUID();
			var cardinfo = {uuid: carduuid};
			
			mvcclientwalletmodule._fillCardInfo(cardinfo, cards[i]);
			
			array.push(cardinfo);
		}
		
		return array;
	}

	async getCurrencySchemeInfo(sessionuuid, currencyuuid) {
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

		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');

		var schemeinfo = {uuid: scheme.getSchemeUUID()};
		
		mvcclientwalletmodule._fillSchemeInfoFromScheme(schemeinfo, scheme);

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

		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');

		var pretradeschemeinfo = {uuid: pretradescheme.getSchemeUUID()};
		
		mvcclientwalletmodule._fillSchemeInfoFromScheme(pretradeschemeinfo, pretradescheme);

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
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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
					pretradecardinfo = await mvcclientwalletmodule.getCardInfo(sessionuuid, walletuuid, pretradecard.getCardUUID());
					break;
				}				
			}
		}
		
/* 		var pretradeschemeuuid = pretradescheme.getSchemeUUID();
		
		var cardinfos = await mvcclientwalletmodule.getCardList(sessionuuid, walletuuid, true)
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
					pretradecardinfo = await mvcclientwalletmodule.cloneCard(sessionuuid, walletuuid, carduuid, pretrade_schemeinfo.uuid);
				}
				else {
					// we return the card it self
					pretradecardinfo = await mvcclientwalletmodule.getCardInfo(sessionuuid, walletuuid, carduuid);
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

			pretradecardinfo = await mvcclientwalletmodule.getCardInfo(sessionuuid, walletuuid, pretradecard.uuid);

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

		var avg_transaction_fee = await this._getAverageTransactionFee(session, currency)

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

	async buyCreditUnits(sessionuuid, walletuuid, carduuid, currencyuuid, creditunits, feelevel = null) {
		if (!sessionuuid)
			return Promise.reject('session uuid is undefined');
		
		if (!walletuuid)
		return Promise.reject('wallet uuid is undefined');
	
		if (!carduuid)
		return Promise.reject('card uuid is undefined');
	
		if (!currencyuuid)
		return Promise.reject('currency uuid is undefined');
	
		var global = this.global;
		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet');
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

		var cardsession = await this._getMonitoredCardSessionForCurrency(session, wallet, card, currency);
		var fromaccount = card._getSessionAccountObject();

		// compute corresponding ethereum credits
		var ethnodemodule = global.getModuleObject('ethnode');

		var avg_transaction_fee = await this._getAverageTransactionFee(session, currency);

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
			
		ethtx.setGas(fee.gaslimit);
		ethtx.setGasPrice(fee.gasPrice);

		// send swap request
		let tx_hash = await swapmodule.buyEthOnOutput(cardsession, scheme, token, tokenamountmax, weth, ethcredit, uniswap_v2, ethtx);

		return tx_hash;
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

		var mvcclientwalletmodule = global.getModuleObject('mvc-client-wallet')
	
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
			tokenamountstring = mvcclientwalletmodule.formatAmount(amount, decimals)
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

 		var tokenamountstring = await currencyamount.toString();
		var currencyamountstring = await this._formatMonetaryAmount(session, tokenamountstring, currency.symbol, currency.decimals, _options);

		return currencyamountstring;
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

//dependencies
_GlobalClass.getGlobalObject().registerModuleDepency('mvc-currencies', 'common');



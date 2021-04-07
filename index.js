/**
 * 
 */
'use strict';


console.log('@primusmoney/currencies');

if ( typeof window !== 'undefined' && window  && (typeof window.simplestore === 'undefined')) {
	// browser or react-native
	console.log('creating window.simplestore in @primusmoney/currencies index.js');

	window.simplestore = {};
	
	window.simplestore.nocreation = true;
	
} else if ((typeof global !== 'undefined') && (typeof global.simplestore === 'undefined')) {
	// nodejs
	console.log('creating global.simplestore in @primusmoney/currencies.js');
	global.simplestore = {};
}

const Currencies = require('./currencies.js');


module.exports = Currencies;
import './module.js';

import './model/currency-amount.js';
import './model/decimal-amount.js';
import './model/providers/provider.js';

var _globalscope;

if (typeof window !== 'undefined') {
	_globalscope = window;		
}
else if (typeof global !== 'undefined') {
	_globalscope = global;
}

_globalscope.simplestore.BigNumber = require('bignumber.js');

# sails-util-cold

You have to install it in the project where you want your models to be coldified.

## How to use it

As this module tries to be compatible with all ways of injecting models in sails, including [mvcsloader](https://raw.githubusercontent.com/leeroybrun/sails-util-mvcsloader), you have to tell it to coldify models : 
  var cold = require('sails-util-cold')(sails);
  cold.cold(__dirname + '/api/models');

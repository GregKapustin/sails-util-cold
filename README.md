# sails-util-cold

You have to install it in the project where you want your models to be coldified.

## How to use it

As this module tries to be compatible with all ways of injecting models in sails, including [mvcsloader](https://raw.githubusercontent.com/leeroybrun/sails-util-mvcsloader), you have to tell it to coldify models : 

    var cold = require('sails-util-cold')(sails);
    cold.cold(__dirname + '/api/models');

**Your models must have a `cold` property set to true** if you want them to be coldified.


## What does it do

### Coldify content

Cold creates _cold_ copies of your contents, in order to **keep track of every modification applied to it**. This is an alternative to [Event sourcing](http://martinfowler.com/eaaDev/EventSourcing.html) like described my Martin Fowler.

This way, you have 2 main versions of every piece of content : the "hot" one, and the "cold" ones, that you don't need to worry about.

The "hot" model is still named after your model _(ie. MyModel)_ and the cold copy is named "Cold" _(ie. MyModelCold)_.

### Link cold contents to cold contents

**Furthermore, Cold also doubles every relational attributes of your models.** The relation, of type `collection` (many-to-many or one-to-many) or `model` (one-to-one), is kept as the original, pointing to the hot model from the cold one.

But Cold will create the same relational attribute "coldified", pointing to the cold instance of the pointed model if it exists.

Example : If model "Pet" has a relation to "Human" via "Owner" attribute, "PetCold" will have "Owner" attribute linking to "Human" model and "OwnerCold" attribute linking to "HumanCold" model.

### Benefits

Every time you update a content (an instance of a model, let's say the dog "Pluto", instance of "Pet" model), Cold creates a cold copy of Pluto, so you have 2 instances of "PetCold" : the original one and the new one.

#### Time 0 :

Pet

ID | Name | Toy
--- | --- | ---
1 | Pluto | Ball

PetCold

ID | Name | Toy | coldReference
--- | --- | --- | ---
1 | Pluto | Ball | 1

#### Time 1 : We change Pluto's toy, he prefers now shoe

Pet

ID | Name | Toy
--- | --- | ---
1 | Pluto | Shoe

PetCold

ID | Name | Toy | coldReference
--- | --- | --- | ---
1 | Pluto | Ball | 1
2 | Pluto | Shoe | 1




## Use it with caution !

Even if Cold tried to be the lightest possible, it **is a huge amount of data** that will be added to your database. Use it only if you absolutely need it on production environments, and don't set "cold" property on models that don't need it.


## Todo

- Add a `cold` property on attributes, to specify if they have to be copied in cold copy of the model
- Add sails-specific cold methods like `findCold` and so on
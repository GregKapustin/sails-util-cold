var buildDictionary = require('sails-build-dictionary');

module.exports = function sailsUtilsCold(sails) {

    if(!sails) {
        console.log('Warning! The Sails app injected into sails-util-cold seems invalid.');
    }
    

    var Loader = {
        cold: function(obj) {
            var self = this;
            buildDictionary.optional({
                dirname: obj.models,
                filter: /^([^.]+)\.(js|coffee|litcoffee)$/,
                replaceExpr: /^.*\//,
                flattenDirectories: true
            }, function (err, models) {
                if (err) {
                    return cb(err);
                }
                var coldModels = _.filter(models, {"cold": true});
                if(_.size(coldModels)) {
                    _.forEach(coldModels, function(coldModel) {
                        self.coldify(coldModel);
                    });
                }
            });
        },
        coldify: function(model) {
            var self = this;
            var modelCold = _.clone(model);
            modelCold.identity += "cold";
            modelCold.globalId += "Cold";
            
            // Modify model itself
            modelCold = self.coldifyModel(modelCold, model);
            
            // Register model
            sails.hooks.orm.models[modelCold.identity] = modelCold;
            sails.models[modelCold.identity] = modelCold;
            
            // Register controller
            sails.controllers[modelCold.identity] = {identity: modelCold.identity, globalId: modelCold.globalId, sails: sails};
            sails.hooks.controllers.middleware[modelCold.identity] = {identity: modelCold.identity, globalId: modelCold.globalId, sails: sails};
            var actionId = "sails";
            var action = _.clone(sails);
                action._middlewareType = 'ACTION: ' + modelCold.identity + '/' + actionId;
                sails.hooks.controllers.middleware[modelCold.identity][actionId] = action;
                sails.hooks.controllers.explicitActions[modelCold.identity] = sails.hooks.controllers.explicitActions[modelCold.identity] || {};
                sails.hooks.controllers.explicitActions[modelCold.identity][actionId] = true;
                
            // Tell hot model to create instance of cold model when updated
            sails.models[model.identity].beforeUpdate = self.coldUpdateHotModel(modelCold, model);
        },
        coldifyModel: function(modelCold, model) {
            var self = this;
            
            // Delete references via
            _.forEach(modelCold.attributes, function(attribute, attributeId) {
                // Disable via
                if(attribute.hasOwnProperty("via")) {
                    delete attribute.via;
                }
                // Model
                if(attribute.hasOwnProperty("model")) {
                    var attributeRef = attribute.model.toLowerCase();
                    if(sails.models[attributeRef].hasOwnProperty("cold") && sails.models[attributeRef].cold) {
                        // Cloner l'attribute
                        modelCold.attributes[attributeId + "Cold"] = _.clone(attribute);
                        // Le faire pointer sur du cold
                        modelCold.attributes[attributeId + "Cold"].model = attribute.model + "Cold";
                        // Trouver la référence réciproque du hot et l'appliquer au cold
                        var hotVia = _.findKey(sails.models[attributeRef].attributes, function(a) {return a.collection == model.identity || a.model == model.identity;});
                        if(hotVia && hotVia != 'undefined') {
                            modelCold.attributes[attributeId + "Cold"].via = hotVia + "Cold";
                        }
                    }
                }
                // Collection
                else if(attribute.hasOwnProperty("collection")) {
                    var attributeRef = attribute.collection.toLowerCase();
                    if(sails.models[attributeRef].hasOwnProperty("cold") && sails.models[attributeRef].cold) {
                        // Cloner l'attribute
                        modelCold.attributes[attributeId + "Cold"] = _.clone(attribute);
                        // Le faire pointer sur du cold
                        modelCold.attributes[attributeId + "Cold"].collection = attribute.collection + "Cold";
                        // Trouver la référence réciproque du hot et l'appliquer au cold
                        var hotVia = _.findKey(sails.models[attributeRef].attributes, function(a) {return a.collection == model.globalId || a.model == model.globalId;});
                        if(hotVia && hotVia != 'undefined') {
                            modelCold.attributes[attributeId + "Cold"].via = hotVia + "Cold";
                        }
                    }
                }
                
            });
            
            // Add reference to hot model
            modelCold.attributes.coldReference = {
                model: model.globalId
            };
            
            return modelCold;
        },
        coldUpdateHotModel: function(modelCold, model) {
            // Save and replace existing beforeUpdate function on hot model
            var beforeUpdate = sails.models[model.identity].hasOwnProperty("beforeUpdate")
                && typeof sails.models[model.identity].beforeUpdate == "function"
                && sails.models[model.identity].beforeUpdate ?
                    sails.models[model.identity].beforeUpdate
                    : function(values, cb) {return cb();};
                    
            // Create a beforeUpdate function that creates a new cold content every time a hot model is updated. It's ran asynchronously, as you can see return beforeUpdate is ran at the end
            var createAndUpdateFunction = function(values, cb) {
                // find actual version of hot content and populate all models and collection fields
                var search = sails.models[model.identity].findOne(values.id);
                _.forEach(sails.models[model.identity].associations, function(association) {
                    search.populate(association.alias);
                });
                search.exec(function(err, contentHot) {
                    // Disable ID, createdAt, updatedAt
                    contentHot.id = null;
                    contentHot.createdAt = null;
                    contentHot.updatedAt = null;
                    // Add coldReference
                    contentHot.coldReference = values.id;
                    // Fill cold references with hottest cold models
                    var coldSearches = [];
                    var hotContents = {};
                    _.forEach(sails.models[model.identity].associations, function(association) {
                        if(modelCold.attributes.hasOwnProperty(association.alias + "Cold")) {
                            // Find all cold contents from hot contents referenced through this association
                            hotContents[association[association.type]] = {alias: association.alias + "Cold", model: association[association.type] + "cold", type: association.type, contents: contentHot[association.alias].hasOwnProperty("id") ? [contentHot[association.alias].id] : _.map(contentHot[association.alias], "id")};
                        }
                    });
                    // Finally do a search for each content
                    _.forEach(hotContents, function(associationType) {
                        _.forEach(associationType.contents, function(contentId) {
                            coldSearches.push(
                                sails.models[associationType.model].find({where: {coldReference: contentId}, orderBy: 'createdAt DESC'}).limit(1)
                            );
                        });
                    });
                    Promise.all(coldSearches).then(function(res) {
                        // Put cold contents in cold fields
                        var i = 0;
                        _.forEach(hotContents, function(associationType) {
                            if(associationType.type == "collection") {
                                if(!contentHot[associationType.alias])
                                    contentHot[associationType.alias] = [];
                                _.forEach(associationType.contents, function(contentId) {
                                    contentHot[associationType.alias].push(res[i][0]);
                                    i++;
                                });
                            } else if(associationType.type == "model") {
                                contentHot[associationType.alias] = res[i][0];
                                i++;
                            }
                        });
                        // Finally create cold content
                        sails.models[modelCold.identity].create(contentHot).exec(function(err, contentColdCreatedFromContentHot) {
                        });
                    }).catch(function(e) {
                        sails.log.error(e);
                    });
                });
                return beforeUpdate(values, cb);
            };
            return createAndUpdateFunction;
        }
    };
    return Loader;
};


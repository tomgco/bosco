var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var crypto = require("crypto");
var exec = require('child_process').exec;
var async = require('async');

var AssetHelper = require('./AssetHelper');
var minify = require('./Minify').minify;
var removeDuplicates = require('./Duplicates').removeDuplicates;
var doBuild = require('./ExternalBuild').doBuild;
var getLastCommitForAssets = require('./Git').getLastCommitForAssets;
var createHtmlFiles = require('./Html').createHtmlFiles;

module.exports = function(bosco) {

    return {
        getStaticAssets: getStaticAssets
    }

    function getStaticAssets(options, next) {

        async.mapSeries(options.repos, loadService, function(err, services) {

            // Remove any that don't have a bosco-service
            services = _.filter(services, function(service) {
                return service;
            });

            async.mapSeries(services, function(service, cb) {
                createAssetList(service, options.minify, options.tagFilter, cb);
            }, function(err, assetList, builds) {

                // Pull tags together from across projects
                var staticAssets = {};
                assetList.forEach(function(asset) {
                    _.forOwn(asset, function(value, key) {
                        if (value.type == 'build') return;
                        if (staticAssets[key]) {
                            staticAssets[key].content += value.content;
                        } else {
                            staticAssets[key] = value;
                        }
                    });
                });

                // Check for externally built projects
                var builds = [];
                assetList.forEach(function(asset) {
                    _.forOwn(asset, function(value, key) {
                        if (value.type !== 'build') return;
                        builds.push(value);
                    });
                });

                // Build any external projects
                async.mapSeries(builds, function(build, cb) {

                    doBuild(bosco, build, options.watchBuilds, options.reloadOnly, options.tagFilter, cb);

                }, function(err, assets) {

                    // join build assets into staticAssets
                    assets.forEach(function(asset) {
                        _.forOwn(asset, function(value, key) {
                            staticAssets[key] = value;
                        });
                    });

                    // Dedupe
                    removeDuplicates(bosco, staticAssets, function(err, staticAssets) {
                        // Now go and minify
                        if (options.minify) {
                            getLastCommitForAssets(bosco, staticAssets, function(err, staticAssets) {
                                minify(bosco, staticAssets, function(err, staticAssets) {
                                    createHtmlFiles(bosco, staticAssets, next);
                                });
                            });
                        } else {
                        	createHtmlFiles(bosco, staticAssets, next);	
                        }
                    });
                });

            });
        });
    }

    function createAssetList(boscoRepo, minified, tagFilter, next) {

        var assetKey, staticAssets = {},
            staticBuild = {},
            assetHelper = AssetHelper.getAssetHelper(bosco, boscoRepo, tagFilter);

        if (boscoRepo.assets && boscoRepo.assets.js) {
            _.forOwn(boscoRepo.assets.js, function(value, tag) {
                if (value) {
                    value.forEach(function(asset) {
                        assetKey = boscoRepo.name + "/" + asset;
                        assetHelper.addAsset(staticAssets, assetKey, asset, tag, 'js');
                    });
                }
            });
        }

        if (boscoRepo.assets && boscoRepo.assets.css) {
            _.forOwn(boscoRepo.assets.css, function(value, tag) {
                if (value) {
                    value.forEach(function(asset) {
                        assetKey = boscoRepo.name + "/" + asset;
                        assetHelper.addAsset(staticAssets, assetKey, asset, tag, 'css');
                    });
                }
            });
        }

        if (boscoRepo.assets && boscoRepo.assets.build) {
            staticBuild = boscoRepo.assets.build;
            staticBuild.name = boscoRepo.name;
            staticBuild.repoPath = boscoRepo.repoPath;
            staticBuild.basePath = boscoRepo.basePath;
            staticBuild.path = boscoRepo.repoPath + boscoRepo.basePath;
            staticBuild.type = 'build';
            staticAssets['build:' + staticBuild.name] = staticBuild;
        }

        next(null, staticAssets);

    }

    function loadService(repo, next) {
        var boscoRepo, basePath, repoPath = bosco.getRepoPath(repo),
            boscoRepoConfig = [repoPath, "bosco-service.json"].join("/");
        if (bosco.exists(boscoRepoConfig)) {

            boscoRepo = JSON.parse(fs.readFileSync(boscoRepoConfig)) || {};
            boscoRepo.name = repo;
            boscoRepo.path = repoPath;
            boscoRepo.repoPath = repoPath;

            if (boscoRepo.assets) {
                if (boscoRepo.assets.basePath) {
                    boscoRepo.path += boscoRepo.assets.basePath;
                    boscoRepo.basePath = boscoRepo.assets.basePath;
                }
                next(null, boscoRepo);
            } else {
                next();
            }
        } else {
            next();
        }
    }


};
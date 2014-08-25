var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var UglifyJS = require("uglify-js");
var sass = require("node-sass");
var crypto = require("crypto");
var CleanCSS = require("clean-css");
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var async = require('async');

module.exports = function(bosco) {

    return {
        getStaticAssets: getStaticAssets,
        createHtmlFiles: createHtmlFiles,
        createKey: createKey,
        loadService: loadService
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

                    doBuild(build, options.watchBuilds, options.reloadOnly, options.tagFilter, cb);

                }, function(err, assets) {

                    // join build assets into staticAssets
                    assets.forEach(function(asset) {
                        _.forOwn(asset, function(value, key) {
                            staticAssets[key] = value;
                        });
                    });

                    // Dedupe
                    removeDuplicates(staticAssets, function(err, staticAssets) {

                        // Now go and minify
                        if (options.minify) {
                            getLastCommitForAssets(staticAssets, function(err, staticAssets) {
                                minify(staticAssets, function(err, staticAssets) {
                                    createHtmlFiles(staticAssets, next);
                                });
                            });
                        } else {
                            createHtmlFiles(staticAssets, next);
                        }
                    });
                });

            });
        });
    }

    function doBuild(build, watchBuilds, reloadOnly, tagFilter, next) {

        var command = watchBuilds ? (build.watch ? build.watch.command : build.command) : build.command;
        command = reloadOnly ? "echo 'Not running build as change triggered by external build tool'" : command;

        var buildFinished = function(err, stdout, stderr) {

            if (err) {
                bosco.error(stderr);
            }

            console.log(stdout);

            var assetKey, staticAssets = {},
                assetHelper = getAssetHelper(bosco, build, tagFilter);

            // Now go and get the static assets
            if (build.output && build.output.js) {
                _.forOwn(build.output.js, function(value, tag) {
                    if (value) {
                        value.forEach(function(asset) {
                            assetKey = build.name + "/" + asset;
                            assetHelper.addAsset(staticAssets, assetKey, asset, tag, 'js');
                        });
                    }
                });
            }

            if (build.output && build.output.css) {
                _.forOwn(build.output.css, function(value, tag) {
                    if (value) {
                        value.forEach(function(asset) {
                            assetKey = build.name + "/" + asset;
                            assetHelper.addAsset(staticAssets, assetKey, asset, tag, 'css');
                        });
                    }
                });
            }

            next(null, staticAssets);

        }

        if (watchBuilds) {

            bosco.log("Spawning watch command for " + build.name.blue + ": " + command);

            var cmdArray = command.split(" ");
            var command = cmdArray.shift();
            var wc = spawn(command, cmdArray, {
                cwd: build.repoPath
            });
            var finishedText = build.watch.finished || 'finished';
            var stdout = "",
                calledReady = false;
            var checkDelay = 2000; // Seems reasonable for build check cycle	

            wc.stdout.on('data', function(data) {
                stdout += data.toString();
            });

            var checkFinished = function() {

                if (stdout.indexOf(finishedText) >= 0 && !calledReady) {
                    calledReady = true;
                    setTimeout(function() {
                        buildFinished(null, stdout, null);
                    }, checkDelay);
                } else {
                    setTimeout(checkFinished, checkDelay);
                }
            }

            checkFinished();

        } else {

            bosco.log("Running build command for " + build.name.blue + ": " + command);
            exec(command, {
                cwd: build.repoPath
            }, buildFinished);

        }

    }

    function getAssetHelper(bosco, boscoRepo, tagFilter) {

        return {
            addAsset: function(staticAssets, assetKey, asset, tag, type) {

                if (tagFilter && tag !== tagFilter) return;

                var newAsset = {};
                newAsset.assetKey = assetKey;
                newAsset.asset = asset;
                newAsset.repoPath = boscoRepo.repoPath;
                newAsset.basePath = boscoRepo.basePath;
                newAsset.relativePath = "." + [boscoRepo.basePath, asset].join("/");
                newAsset.path = [boscoRepo.path, asset].join("/");
                newAsset.extname = path.extname(asset);
                newAsset.tag = tag;
                newAsset.repo = boscoRepo.name;
                newAsset.type = type;
                newAsset.content = fs.readFileSync(newAsset.path);
                newAsset.checksum = checksum(newAsset.content, 'sha1', 'hex');

                staticAssets[assetKey] = newAsset;

            }

        }

    }

    function removeDuplicates(staticAssets, next) {

        var duplicates = [];

        var checkDuplicate = function(a, b) {
                var duplicate = false;
                if (a.checksum == b.checksum) {
                    bosco.warn("Skipping duplicate file: " + a.assetKey + " <> " + b.assetKey);
                    duplicate = true;
                }
                return duplicate;
            },
            checkDuplicateLibrary = function(a, b) {
                var aLib = checkLibrary(a),
                    duplicate = false;
                if (aLib) {
                    var oLib = checkLibrary(b);
                    if (oLib && oLib.name == aLib.name) {
                        if (oLib.version == aLib.version) {
                            bosco.warn("Duplicate library version: " + a.assetKey + " <> " + b.assetKey);
                        } else {
                            bosco.warn("Duplicate library with different version: " + a.assetKey + " <> " + b.assetKey);
                        }
                        duplicate = true;
                    }
                }
                return duplicate;
            },
            checkLibrary = function(a) {
                var dashSplit = a.asset.split("-");
                if (dashSplit[dashSplit.length - 1] == 'min.js') {
                    return {
                        version: dashSplit[dashSplit.length - 2],
                        name: dashSplit[dashSplit.length - 3]
                    };
                } else {
                    return null;
                }
            }

        _.forOwn(staticAssets, function(avalue, akey) {
            _.forOwn(staticAssets, function(bvalue, bkey) {
                if (akey == bkey) return;
                var duplicate = checkDuplicate(avalue, bvalue);
                var duplicateLibrary = checkDuplicateLibrary(avalue, bvalue);
                if (duplicate || duplicateLibrary) {
                    if (!_.contains(duplicates, bvalue.assetKey)) {
                        duplicates.push(bvalue.assetKey);
                    }
                }
            });
        });

        // Now remove them all
        duplicates.forEach(function(key) {
            delete staticAssets[key];
        })

        next(null, staticAssets);

    }

    function createAssetList(boscoRepo, minified, tagFilter, next) {

        var assetKey, staticAssets = {},
            staticBuild = {},
            assetHelper = getAssetHelper(bosco, boscoRepo, tagFilter);

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

    function getLastCommitForAssets(staticAssets, next) {
        var files = [];
        _.forOwn(staticAssets, function(value, key) {
            files.push({
                key: key,
                repoPath: value.repoPath,
                relativePath: value.relativePath
            });
        });
        async.map(files, getCommit, function(err, results) {
            results.forEach(function(value) {
                staticAssets[value.key].commit = value.commit;
            });
            next(null, staticAssets);
        });
    }

    function minify(staticAssets, next) {

        // Create simple collections of css and js
        var jsAssets = {},
            cssAssets = {};
        _.map(staticAssets, function(asset) {
            if (asset.type == 'js') {
                jsAssets[asset.tag] = jsAssets[asset.tag] || [];
                jsAssets[asset.tag].push(asset.path);
            } else if (asset.type == 'css') {
                cssAssets[asset.tag] = cssAssets[asset.tag] || [];
                cssAssets[asset.tag].push(asset.path);
            }
        });

        async.parallel([

                function pcompileJs(next) {
                    compileJs(jsAssets, next);
                },
                function pcompileCss(next) {
                    compileCss(cssAssets, next);
                },
                function manifest(next) {
                    createManifest(staticAssets, next);
                }
            ],
            function(err, assets) {
                next(err, _.merge(assets[0], assets[1], assets[2]));
            });

    }

    function createManifest(staticAssets, next) {

        var manifest = {};

        _.forOwn(staticAssets, function(value, key) {

            var manifestLine,
                manifestFile = createKey(value.tag, value.type, 'manifest', 'txt');

            manifest[manifestFile] = manifest[manifestFile] || {
                content: "",
                type: 'plain',
                assetType: value.type,
                tag: value.tag,
                extname: ".manifest",
                files: []
            };

            manifest[manifestFile].content += value.repo + value.basePath + "/" + value.asset + ', Last commit: ' + value.commit;
            manifest[manifestFile].files.push({
                key: createKey(value.repo + value.basePath + "/" + value.asset, '', 'src', ''),
                relativePath: value.repo + value.basePath + "/" + value.asset,
                content: value.content,
                path: value.path,
                type: value.type
            });

        });

        next(null, manifest);

    }

    function compileJs(jsAssets, next) {

        var compiledAssets = {};

        _.forOwn(jsAssets, function(files, tag) {

            var compiled;

            try {
                compiled = UglifyJS.minify(files, {
                    outSourceMap: tag + ".js.map",
                    sourceMapIncludeSources: true
                });
            } catch (ex) {
                bosco.error("There was an error minifying files in " + tag.blue + ", error:");
                console.log(ex.message + "\n");
                compiled = {
                    code: ""
                };
            }

            var mapKey = createKey(tag, 'js', 'js', 'map');
            compiledAssets[mapKey] = compiledAssets[mapKey] || {};
            compiledAssets[mapKey].path = "";
            compiledAssets[mapKey].extname = ".map";
            compiledAssets[mapKey].tag = tag;
            compiledAssets[mapKey].type = 'js';
            compiledAssets[mapKey].content = compiled.map;

            var hash = createHash(compiled.code);
            var minKey = createKey(tag, hash, 'js', 'js');
            compiledAssets[minKey] = compiledAssets[minKey] || {};
            compiledAssets[minKey].path = "";
            compiledAssets[minKey].extname = ".js";
            compiledAssets[minKey].tag = tag;
            compiledAssets[minKey].type = 'js';
            compiledAssets[minKey].hash = hash;
            compiledAssets[minKey].content = compiled.code;

        });

        next(null, compiledAssets);

    }

    function compileCss(cssAssets, next) {

        var compiledCss = [];
        var compiledAssets = {};

        _.forOwn(cssAssets, function(files, tag) {
            var compiled = {
                css: "",
                scss: ""
            };
            files.forEach(function(file) {
                if (path.extname(file) == '.css') {
                    compiled.css += fs.readFileSync(file);
                } else if (path.extname(file) == '.scss') {
                    compiled.scss += fs.readFileSync(file);
                }
            });
            compiled.tag = tag;
            compiledCss.push(compiled);
        });

        var sassRender = function(scss, css, callback) {

            // Now sassify it.
            sass.render(scss, function(err, compressed) {
                if (err) return callback(err);
                compressed += "\r\n" + css;
                //if(compressed) compressed = new(bosco.config.get('cleancss')).minify(compressed);
                return callback(null, compressed);
            });

        }

        async.map(compiledCss, function(css, next) {

            sassRender(css.scss, css.css, function(err, code) {

                if (err || code.length == 0) return next({
                    message: 'No css for tag ' + css.tag
                });

                var hash = createHash(code);
                var assetKey = createKey(css.tag, hash, 'css', 'css');
                compiledAssets[assetKey] = compiledAssets[assetKey] || {};
                compiledAssets[assetKey].path = "";
                compiledAssets[assetKey].extname = ".css";
                compiledAssets[assetKey].tag = css.tag;
                compiledAssets[assetKey].type = 'css';
                compiledAssets[assetKey].hash = hash;
                compiledAssets[assetKey].content = code;

                next();
            });

        }, function(err) {
            if (err) return bosco.warn("No CSS assets: " + err.message);
            next(null, compiledAssets);
        });

    }

    function createHash(code) {
        return crypto.createHash("sha1").update(code).digest("hex").slice(0, 10);
    }

    function createKey(tag, hash, type, extension) {
        return bosco.options.environment + '/' + (bosco.options.build ? bosco.options.build + '/' : '') + type + '/' + tag + (hash ? '.' + hash : '') + (extension ? '.' + extension : '');
    }

    function createHtmlFiles(staticAssets, next) {

        var htmlAssets = {},
            port = bosco.config.get('cdn:port') || "7334";

        _.forOwn(staticAssets, function(value, key) {

            var html,
                htmlFile = createKey(value.tag, value.type, 'html', 'html'),
                cdn = bosco.config.get('aws:cdn') ? bosco.config.get('aws:cdn') : 'http://localhost:' + port;

            if ((value.type == 'js' && value.extname == '.js') || value.type == 'css') {

                htmlAssets[htmlFile] = htmlAssets[htmlFile] || {
                    content: "",
                    type: "html",
                    assetType: value.type,
                    tag: value.tag,
                    extname: ".html"
                };

                if (value.type == 'js') {
                    htmlAssets[htmlFile].content += _.template('<script src="<%= url %>"></script>\n', {
                        'url': cdn + "/" + key
                    });
                } else {
                    htmlAssets[htmlFile].content += _.template('<link rel="stylesheet" href="<%=url %>" type="text/css" media="screen" />\n', {
                        'url': cdn + "/" + key
                    });
                }
            }

        });

        staticAssets = _.merge(htmlAssets, staticAssets);

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

    function getCommit(file, next) {
        var gitCmd = 'git log -n1 --oneline ' + file.relativePath;
        exec(gitCmd, {
            cwd: file.repoPath
        }, function(err, stdout, stderr) {
            if (err) {
                bosco.error(stderr);
            }
            next(err, {
                key: file.key,
                path: file.path,
                commit: stdout
            });
        });
    }

    function checksum(str, algorithm, encoding) {
        return crypto
            .createHash(algorithm || 'md5')
            .update(str, 'utf8')
            .digest(encoding || 'hex')
    }

};
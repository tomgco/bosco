var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var UglifyJS = require("uglify-js");
var	sass = require("node-sass");
var	crypto = require("crypto");
var	CleanCSS = require("clean-css");
var exec = require('child_process').exec;
var async = require('async');

module.exports = function(bosco) {

	return {
		getStaticAssets: getStaticAssets,
		createHtmlFiles: createHtmlFiles,
		createKey: createKey,
		loadService: loadService
	}

	function getStaticAssets(repos, minified, tagFilter, next) {
		async.mapSeries(repos, loadService, function(err, services) {

			// Remove any that don't have a bosco-service
			services = _.filter(services,function(service) { return service; });

			async.mapSeries(services, function(service,next) {
				createAssetList(service, minified, tagFilter, next);
			}, function(err, assetList) {					
				var staticAssets = {};
				assetList.forEach(function(asset) {
					_.forOwn(asset, function(value, key) {
						if(staticAssets[key]) {
							staticAssets[key].content += value.content;
						} else {
							staticAssets[key] = value;	
						}
					});
				});
				next(null, staticAssets);	
			});
		});
	}

	function createAssetList(boscoRepo, minified, tagFilter, next) {

			var assetKey, staticAssets = {}, 
				addAsset = function(assetKey, asset, tag, type) {					
					
					if(tagFilter && tag !== tagFilter) return;

					var newAsset = {};
					newAsset.assetKey = assetKey;
					newAsset.asset = asset;
					newAsset.repoPath = boscoRepo.repoPath;
					newAsset.basePath = boscoRepo.basePath;
					newAsset.relativePath = "." + [boscoRepo.basePath, asset].join("/");
					newAsset.path = [boscoRepo.path,asset].join("/");
					newAsset.extname = path.extname(asset);
					newAsset.tag = tag;
					newAsset.repo = boscoRepo.name;
					newAsset.type = type;
					newAsset.content = fs.readFileSync(newAsset.path);
					newAsset.checksum = checksum(newAsset.content, 'sha1','hex');

					var duplicate = checkDuplicate(newAsset);
					var duplicateLibrary = checkDuplicateLibrary(newAsset);										

					if(!duplicate && !duplicateLibrary) staticAssets[assetKey] = newAsset;

				},
				checkDuplicate = function(newAsset) {
					var duplicate = false;
					_.forOwn(staticAssets, function(value, akey) {
						if(value.checksum == newAsset.checksum) {
							bosco.warn("Skipping duplicate file: " + value.assetKey + " <> " + newAsset.assetKey)
							duplicate = true
						}
					});
					return duplicate;
				},
				checkDuplicateLibrary = function(newAsset) {					
					var aLib = checkLibrary(newAsset), duplicate = false;
					if(aLib) {
						_.forOwn(staticAssets, function(value, akey) {
							var oLib = checkLibrary(value);
							if(oLib && oLib.name == aLib.name) {
								if(oLib.version == aLib.version) {
									bosco.warn("Duplicate library version: " + value.assetKey + " <> " + newAsset.assetKey)									
							 	} else {
									bosco.warn("Duplicate library with different version: " + value.assetKey + " <> " + newAsset.assetKey)
							 	}
							 	duplicate = true;
							} 							
						});
					}
					return duplicate;
				},
				checkLibrary = function(asset) {
					var dashSplit = asset.asset.split("-");
					if(dashSplit[dashSplit.length - 1] == 'min.js') {
						return {version: dashSplit[dashSplit.length - 2],
								name: dashSplit[dashSplit.length - 3]};
					} else {
						return null;
					}
				}


			if(boscoRepo.assets && boscoRepo.assets.js) {
				_.forOwn(boscoRepo.assets.js, function(value, tag) {
					if(value) {
						value.forEach(function(asset) {						
							assetKey = boscoRepo.name + "/" + asset;	
							addAsset(assetKey, asset, tag, 'js');
						});
					}
				});
			}

			if(boscoRepo.assets && boscoRepo.assets.css) {
				_.forOwn(boscoRepo.assets.css, function(value, tag) {
					if(value) {
						value.forEach(function(asset) {
							assetKey = boscoRepo.name + "/" + asset;					
							addAsset(assetKey, asset, tag, 'css');
						});
					}
				});
			}

			if(minified) {
				getLastCommitForAssets(staticAssets, function(err, staticAssets) {	
					minify(staticAssets, function(err, staticAssets) {
						createHtmlFiles(staticAssets, next);
					});
				});
			} else {
				createHtmlFiles(staticAssets, next);	
			}		

	}

	function getLastCommitForAssets(staticAssets, next) {
		var files = [];
		_.forOwn(staticAssets, function(value, key) {
			files.push({key: key, repoPath: value.repoPath, relativePath:value.relativePath});
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
		var jsAssets = {}, cssAssets = {};
		_.map(staticAssets, function(asset) {
			if(asset.type == 'js') {
				jsAssets[asset.tag] = jsAssets[asset.tag] || [];
				jsAssets[asset.tag].push(asset.path);
			} else if(asset.type == 'css') {
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
			}],			
			function(err, assets) {
				next(err, _.merge(assets[0],assets[1],assets[2]));
			});		
		
	}

	function createManifest(staticAssets, next) {

		var manifest = {};

		_.forOwn(staticAssets, function(value, key) {			

			var manifestLine, 
				manifestFile = createKey(value.tag, value.type, 'manifest', 'txt');

			manifest[manifestFile] = manifest[manifestFile] || {
				content: "",
				type:'plain',
				assetType: value.type,
				tag:value.tag,
				extname:".manifest"
			};

			manifest[manifestFile].content += value.repo + value.basePath + "/" + value.asset + ', Last commit: ' + value.commit;

		});

		next(null, manifest);

	}

	function compileJs(jsAssets, next) {
		
		var compiledAssets = {};

		_.forOwn(jsAssets, function(files, tag) {
		
			var compiled;

			try {
				compiled = UglifyJS.minify(files);								
			} catch(ex) {
				bosco.error("There was an error minifying files in " + tag.blue + ", error:");
				console.log(ex.message + "\n");
				compiled = {code:""};
			}

			var hash = createHash(compiled.code);

			var assetKey = createKey(tag, hash, 'js', 'js');
			compiledAssets[assetKey] = compiledAssets[assetKey] || {};
			compiledAssets[assetKey].path = "";
			compiledAssets[assetKey].extname = ".js";
			compiledAssets[assetKey].tag = tag;
			compiledAssets[assetKey].type = 'js';
			compiledAssets[assetKey].hash = hash;
			compiledAssets[assetKey].content = compiled.code;

		});

		next(null, compiledAssets);

	}

	function compileCss(cssAssets, next) {

		var compiledCss = [];
		var compiledAssets = {};

		_.forOwn(cssAssets, function(files, tag) {
			var compiled = {css:"",scss:""};
			files.forEach(function(file) {
				if(path.extname(file) == '.css') {
				 compiled.css += fs.readFileSync(file);
				} else if(path.extname(file) == '.scss') {
				 compiled.scss += fs.readFileSync(file);
				}
			});
			compiled.tag = tag;			
			compiledCss.push(compiled);
		});

		var sassRender = function(scss, css, callback) {

			// Now sassify it.
			sass.render(scss, function(err, compressed) {
				if(err) return callback(err);
				compressed += "\r\n" + css;
				if(compressed) compressed = new CleanCSS(bosco.config.get('cleancss')).minify(compressed);
				return callback(null, compressed);
			});

		}

		async.map(compiledCss, function(css, next) {	

			sassRender(css.scss, css.css, function(err, code) {

				if(err || code.length == 0) return next({message: 'No css for tag ' + css.tag});

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
			if(err) return bosco.warn("No CSS assets: " + err.message);
			next(null, compiledAssets);
		});
		
	}

	function createHash(code) {
		return crypto.createHash("sha1").update(code).digest("hex").slice(0,10);
	}

	function createKey(tag, hash, type, extension) {
		return bosco.options.environment + '/' + (bosco.options.build ? bosco.options.build + '/' : '') + type + '/' + tag + (hash ? '.' + hash : '') +'.' + extension;
	}

	function createHtmlFiles(staticAssets, next) {
		
		var htmlAssets = {}, port = bosco.config.get('cdn:port') || "7334";

		_.forOwn(staticAssets, function(value, key) {			
			
			var html, 
				htmlFile = createKey(value.tag, value.type, 'html', 'html'),
				cdn = bosco.config.get('aws:cdn') ? bosco.config.get('aws:cdn') : 'http://localhost:' + port;

			if(value.type == 'js' || value.type == 'css') {

				htmlAssets[htmlFile] = htmlAssets[htmlFile] || {
					content: "",
					type:"html",
					assetType: value.type,
					tag:value.tag,
					extname:".html"
				};

				if(value.type == 'js') {
					htmlAssets[htmlFile].content += _.template('<script src="<%= url %>"></script>\n', { 'url': cdn + "/" + key });	
				} else {
					htmlAssets[htmlFile].content += _.template('<link rel="stylesheet" href="<%=url %>" type="text/css" media="screen" />\n', { 'url': cdn + "/" + key });						
				}
			}
		
		});

		staticAssets = _.merge(htmlAssets, staticAssets);

		next(null, staticAssets);

	}

	function loadService(repo, next) {
		var boscoRepo, basePath, repoPath = bosco.getRepoPath(repo), boscoRepoConfig = [repoPath,"bosco-service.json"].join("/");		
		if(bosco.exists(boscoRepoConfig)) {
			
			boscoRepo = require(boscoRepoConfig) || {};

			boscoRepo.name = repo;
			boscoRepo.path = repoPath;
			boscoRepo.repoPath = repoPath;

			if(boscoRepo.assets) {
				if(boscoRepo.assets.basePath) {
					boscoRepo.path +=  boscoRepo.assets.basePath;
					boscoRepo.basePath =  boscoRepo.assets.basePath;
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
		exec(gitCmd, {cwd:file.repoPath}, function(err, stdout, stderr) {
			if(err) {
				bosco.error(stderr);
			}
			next(err, {key: file.key, path: file.path, commit: stdout});
		});
	}

	function checksum (str, algorithm, encoding) {
	    return crypto
	        .createHash(algorithm || 'md5')
	        .update(str, 'utf8')
	        .digest(encoding || 'hex')
	}

};


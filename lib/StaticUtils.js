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
		loadService: loadService
	}

	function getStaticAssets(repos, minified, next) {
		async.mapSeries(repos, loadService, function(err, services) {
			services = _.filter(services,function(service) { return service; });
			async.mapSeries(services, function(service,next) {
				createAssetList(service, minified, next);
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

	function createAssetList(boscoRepo, minified, next) {

			var assetKey, staticAssets = {}, 
				addAsset = function(assetKey, asset, key, type) {
					staticAssets[assetKey] = staticAssets[assetKey] || {};
					staticAssets[assetKey].asset = asset;
					staticAssets[assetKey].repoPath = boscoRepo.repoPath;
					staticAssets[assetKey].basePath = boscoRepo.basePath;
					staticAssets[assetKey].relativePath = "." + [boscoRepo.basePath, asset].join("/");
					staticAssets[assetKey].path = [boscoRepo.path,asset].join("/");
					staticAssets[assetKey].extname = path.extname(asset);
					staticAssets[assetKey].key = key;
					staticAssets[assetKey].repo = boscoRepo.name;
					staticAssets[assetKey].type = type;
					staticAssets[assetKey].content = fs.readFileSync(staticAssets[assetKey].path);
				}

			if(boscoRepo.assets && boscoRepo.assets.js) {
				_.forOwn(boscoRepo.assets.js, function(value, key) {
					if(value) {
						value.forEach(function(asset) {						
							assetKey = boscoRepo.name + "/" + asset;	
							addAsset(assetKey, asset, key, 'js');
						});
					}
				});
			}

			if(boscoRepo.assets && boscoRepo.assets.css) {
				_.forOwn(boscoRepo.assets.css, function(value, key) {
					if(value) {
						value.forEach(function(asset) {
							assetKey = boscoRepo.name + "/" + asset;					
							addAsset(assetKey, asset, key, 'css');
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

		var jsAssets = {}, cssAssets = {};
		_.map(staticAssets, function(asset) {
			if(asset.type == 'js') {
				jsAssets[asset.key] = jsAssets[asset.key] || [];
				jsAssets[asset.key].push(asset.path);
			} else if(asset.type == 'css') {
				cssAssets[asset.key] = cssAssets[asset.key] || [];
				cssAssets[asset.key].push(asset.path);
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
				manifestFile = createKey(value.key, value.type, 'manifest', 'txt');

			manifest[manifestFile] = manifest[manifestFile] || {
				content: "",
				type:'plain',
				assetType: value.type,
				key:value.key,
				extname:".manifest"
			};

			manifest[manifestFile].content += key + ', Last commit: ' + value.commit;

		});

		next(null, manifest);

	}

	function compileJs(jsAssets, next) {
		
		var compiledAssets = {};

		_.forOwn(jsAssets, function(files, key) {
		
			var compiled = UglifyJS.minify(files);				
			var hash = createHash(compiled.code);

			var assetKey = createKey(key, hash, 'js', 'js');
			compiledAssets[assetKey] = compiledAssets[assetKey] || {};
			compiledAssets[assetKey].path = "";
			compiledAssets[assetKey].extname = ".js";
			compiledAssets[assetKey].key = key;
			compiledAssets[assetKey].type = 'js';
			compiledAssets[assetKey].content = compiled.code;

		});

		next(null, compiledAssets);

	}

	function compileCss(cssAssets, next) {

		var compiledCss = [];
		var compiledAssets = {};

		_.forOwn(cssAssets, function(files, key) {
			var compiled = {css:"",scss:""};
			files.forEach(function(file) {
				if(path.extname(file) == '.css') {
				 compiled.css += fs.readFileSync(file);
				} else if(path.extname(file) == '.scss') {
				 compiled.scss += fs.readFileSync(file);
				}
			});
			compiled.key = key;			
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

				if(err || code.length == 0) return next({message: 'No css for key ' + css.key});

				var hash = createHash(code);
				var assetKey = createKey(css.key, hash, 'css', 'css');
				compiledAssets[assetKey] = compiledAssets[assetKey] || {};
				compiledAssets[assetKey].path = "";
				compiledAssets[assetKey].extname = ".css";
				compiledAssets[assetKey].key = css.key;
				compiledAssets[assetKey].type = 'css';
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

	function createKey(key, hash, type, extension) {
		return bosco.options.environment + '/' + bosco.options.build + '/' + type + '/' + key + (hash ? '.' + hash : '') +'.' + extension;
	}

	function createHtmlFiles(staticAssets, next) {
		
		var htmlAssets = {}, port = bosco.config.get('cdn:port') || "7334";

		_.forOwn(staticAssets, function(value, key) {			
			
			var html, 
				htmlFile = createKey(value.key, value.type, 'html', 'html'),
				cdn = bosco.config.get('aws:cdn') ? bosco.config.get('aws:cdn') : 'http://localhost:' + port;

			if(value.type == 'js' || value.type == 'css') {

				htmlAssets[htmlFile] = htmlAssets[htmlFile] || {
					content: "",
					type:"html",
					assetType: value.type,
					key:value.key,
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

};


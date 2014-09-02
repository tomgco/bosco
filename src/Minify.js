var _ = require('lodash');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var UglifyJS = require("uglify-js");
var sass = require("node-sass");
var CleanCSS = require('clean-css');
var async = require('async');

module.exports = function(bosco) { 
    
	var createKey = require('./AssetHelper')(bosco).createKey;

    return {
    	minify: minify
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

	        manifest[manifestFile].content += value.repo + value.basePath + "/" + value.asset + ', Hash: ' + createHash(value.content) + ', Last commit: ' + value.commit;
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

	        bosco.log("Compiling " + files.length + " " + tag.blue + " JS assets ...");

	        var uglifyConfig = bosco.config.get('js:uglify');	                   

	        var uglifyOptions = {
        		output: uglifyConfig ? uglifyConfig.outputOptions : null,
        		compressor: uglifyConfig ? uglifyConfig.compressorOptions : null,
        		mangle: uglifyConfig ? uglifyConfig.mangle : null,
                outSourceMap: tag + ".js.map",
                sourceMapIncludeSources: true
            };

	        try {
	        	compiled = UglifyJS.minify(files, uglifyOptions);
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
	        compiled.count = files.length	        
	        compiled.tag = tag;
	        compiledCss.push(compiled);
	    });

	    async.map(compiledCss, function(css, next) {

	    	bosco.log("Compiling " + css.count + " " + css.tag.blue + " CSS assets ...");

	        sassRender({key: css.assetKey, content: css.scss}, function(err, code) {

	        	var cssContent = css.css + code.content;

		        var cleanCssConfig = bosco.config.get('css:clean');

		        if(cleanCssConfig && cleanCssConfig.enabled) {
		        	cssContent = new CleanCSS(cleanCssConfig.options).minify(cssContent);	
		        }	       	        

	            if (err || cssContent.length == 0) return next({
	                message: 'No css for tag ' + css.tag
	            });

	            var hash = createHash(cssContent);
	            var assetKey = createKey(css.tag, hash, 'css', 'css');
	            compiledAssets[assetKey] = compiledAssets[assetKey] || {};
	            compiledAssets[assetKey].path = "";
	            compiledAssets[assetKey].extname = ".css";
	            compiledAssets[assetKey].tag = css.tag;
	            compiledAssets[assetKey].type = 'css';
	            compiledAssets[assetKey].hash = hash;
	            compiledAssets[assetKey].content = cssContent;

	            next();
	        });

	    }, function(err) {
	        if (err) return bosco.warn("No CSS assets: " + err.message);
	        next(null, compiledAssets);
	    });

	}

	function createHash(code) {
	    var hash = crypto.createHash("sha1").update(code).digest("hex").slice(0, 7);	    
	    hash = hash.replace(/a/g,"b");
	    hash = hash.replace(/e/g,"f");
	    hash = hash.replace(/i/g,"j");
	    hash = hash.replace(/o/g,"p");
	    hash = hash.replace(/u/g,"v");
	    return hash;
	}

	function  sassRender(scss, callback) {	    

	    sass.render(scss.content, function(err, css) {	        
	        if (err) return callback(err);
	        return callback(null, {key: scss.key, content: css});
	    });
	}
}
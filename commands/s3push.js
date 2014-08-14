var _ = require('lodash'),
	 async = require('async'),
	fs = require("fs"), 
	path = require("path"),
	UglifyJS = require("uglify-js"),
	sass = require("node-sass"),
	crypto = require("crypto"), 
	cleanCSS = require("clean-css");

module.exports = {
	name:'s3push',
	description:'Builds all of the front end assets for each microservice and pushes them to S3 for the current environment',
	example:'bosco s3push | bosco s3push top',
	cmd:cmd
}

var tag = "", noprompt = false;

function cmd(bosco, args) {
	
	if(args.length > 0) tag = args[0];

	noprompt = bosco.options.noprompt;
 
	bosco.log("Compile front end assets across services " + (tag ? "for tag: " + tag.blue : ""));

	var repos = bosco.config.get('github:repos'),
		jsAssets = {},
		cssAssets = {};

	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var loadRepo = function(repo, next) {	
		var repoBosco, basePath, repoPath = bosco.getRepoPath(repo), repoBoscoConfig = [repoPath,"bosco-service.json"].join("/");
		if(bosco.exists(repoBoscoConfig)) {
			repoBosco = require(repoBoscoConfig);
			if(repoBosco.assets) {
				basePath = repoBosco.assets.basePath || "";
				process(repoPath + basePath, repoBosco.assets);		
			} 
		} 
		next();
	}

	var process = function(repoPath, assets) {
		_.forOwn(assets.js, function(value, key) {
			if(value) {
				value.forEach(function(asset) {
					jsAssets[key] = jsAssets[key] || [];
					jsAssets[key].push([repoPath,asset].join("/"));
				})
			}
		});
		_.forOwn(assets.css, function(value, key) {
			if(value) {
				value.forEach(function(asset) {
					cssAssets[key] = cssAssets[key] || [];
					cssAssets[key].push([repoPath,asset].join("/"));
				})
			}
		})
	}

	var compileJs = function(next) {
		
		var compiledJs = [];
		_.forOwn(jsAssets, function(files, key) {
			if(tag && tag !== key) return;			
			var compiled = UglifyJS.minify(files);
			compiled.key = key;
			compiled.hash = crypto.createHash("sha1").update(compiled.code).digest("hex");
			compiledJs.push(compiled);
		});

		async.map(compiledJs, function(js, next) {
			pushToS3(js.code, js.hash, bosco.options.environment, 'js', js.key, next);
		}, function(err, result) {
			async.map(result, function(s3file, cb) { 
				createHtml('js',bosco.config.get('aws:cdn'),s3file.file, s3file.key,cb);
			},next);
		});

	}

	var compileCss = function(next) {

		var compiledCss = [];
		_.forOwn(cssAssets, function(files, key) {
			if(tag && tag !== key) return;
			var compiled = {code:""};
			compiled.code += _.map(files, function(file){ return fs.readFileSync(file) });
			compiled.key = key;
			compiled.hash = crypto.createHash("sha1").update(compiled.code).digest("hex");
			compiledCss.push(compiled);
		});

		async.map(compiledCss, function(css, next) {
			pushToS3(css.code, css.hash, bosco.options.environment, 'css', css.key, next);
		}, function(err, result) {			
			async.map(result, function(s3file, cb) { 
				createHtml('css',bosco.config.get('aws:cdn'), s3file.file, s3file.key, cb);
			},next);
		});
		
	}

	var createHtml = function(type, cdn, file, key, next) {
		var html;
		if(type == 'js') {
			html = _.template('<script src="<%= url %>"></script>', { 'url': cdn + file });	
		} else {
			html = _.template('<link rel="stylesheet" href="<%=url %>" type="text/css" media="screen" />', { 'url': cdn + file });						
		}
		pushToS3(html, type, bosco.options.environment, 'html', key, next);
	}

	var pushToS3 = function(content, hash, environment, type, key, next) {

		if(!bosco.knox) return bosco.warn("Knox AWS not configured - so not pushing " + key + "." + type + " to S3.");

		var buffer = new Buffer(content);
		var s3file = '/' + environment + '/' + type + '/' + key + (hash ? '.' + hash : '') +'.' + type;
		var headers = {
		  'Content-Type': 'text/' + type
		};
		bosco.knox.putBuffer(buffer, s3file, headers, function(err, res){		  
	      if(res.statusCode != 200 && !err) err = {message:'S3 error, code ' + res.statusCode};
	      bosco.log('Pushed to S3: ' +  bosco.config.get('aws:cdn') + s3file);
		  next(err, {file: s3file, key:key});
		});
	}

	var confirm = function(next) {
		 bosco.prompt.start();
	  	 bosco.prompt.get({
		    properties: {
		      confirm: {
		        description: "Are you sure you want to publish ".white + (tag ? "all " + tag.blue + " assets in " : "ALL".red + " assets in ").white + bosco.options.environment.blue + " (y/N)?".white
		      }
		    }
		  }, function (err, result) {
		  	if(result.confirm == 'Y' || result.confirm == 'y') {
	  	 		next()
	  	 	} else {
	  	 		next({message:'Did not confirm'});
	  	 	}
	  	 });
	}

	var go = function() {
		bosco.log("Compiling front end assets ...");
		async.mapSeries(repos, loadRepo, function(err) {
			async.parallel([compileJs,compileCss],function(err) {
				bosco.log("Complete pushing files to : " + bosco.config.get('aws:cdn'));	
			});		
		})
	}

	if(!noprompt) {
		confirm(function(err) {
			if(!err) go();
		})
	} else {
		go();
	}

}
var _ = require('lodash'),
	 async = require('async'),
	fs = require("fs"),
	path = require("path"),
	colors = require('colors'),
	jsdiff = require('diff'),
	mime = require('mime'),
	utils;

module.exports = {
	name:'s3push',
	description:'Builds all of the front end assets for each microservice and pushes them to S3 for the current environment',
	example:'bosco -e <environment> -b <build> s3push <tag>',
	cmd:cmd
}

var tag = "", noprompt = false;

function cmd(bosco, args) {

	if(args.length > 0) tag = args[0];

	cdnUrl = bosco.config.get('aws:cdn') + "/";
	force = bosco.options.force;
	noprompt = bosco.options.noprompt;

	var maxAge = bosco.config.get('aws:maxage');
	if(typeof maxAge !== 'number') maxAge = 300;

	bosco.log("Compile front end assets across services " + (tag ? "for tag: " + tag.blue : ""));

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco clone'.");

	var pushAllToS3 = function(staticAssets, confirmation, next) {

		var toPush = [];
		_.forOwn(staticAssets, function(asset, key) {
			if(tag && tag !== asset.tag) return;
			if(isContentEmpty(asset)) {
				bosco.log('Skipping asset: ' + key.blue + ' (content empty)');
				return;
			}

			// Check confirmation by type and key
			if (!isPushConfirmed(confirmation, asset)) {
				bosco.log('Skipping asset: ' + key.blue + ' (not confirmed)');
				return;
			}

			var s3Filename = getS3Filename(key);
			var mimeType = asset.mimeType || mime.lookup(key);

			bosco.log('Staging publish: ' + s3Filename.blue + ' ('+ mimeType +')');

			toPush.push({
				content:  getS3Content(asset),
				path:     s3Filename,
				type:     asset.type,
				mimeType: mimeType
			});

		});

		// Disable for now so that per environment configs can be committed
		// saveS3record(toPush);

		// Add index
		toPush.push({
			content:staticAssets.formattedAssets,
			path: getS3Filename('index.html'),
			type:'html',
			mimeType:'text/html'
		});

		async.mapSeries(toPush, pushToS3, next);
	}

	var saveS3record = function(toPush) {
		// Get the environment + build tag to save in your config file
		if(toPush.length > 0) {
			var envBuild = toPush[0].path.split("/")[1];
			var myRepos = bosco.config.get('S3:published') || [];
			if(!_.contains(myRepos,envBuild)) {
				myRepos.push(envBuild);
				var envConfig = bosco.config.stores.environment;
				envConfig.store.S3 = {published: myRepos};
				bosco.config.save();
			};
		}
	}

	var pushToS3 = function(file, next) {

		if(!bosco.knox) return bosco.warn("Knox AWS not configured for environment " + bosco.options.envrionment + " - so not pushing " + file.path + " to S3.");
		var buffer = file.content;
		var headers = {
		  'Content-Type': file.mimeType,
		  'Cache-Control': ('max-age=' + (maxAge == 0 ? "0, must-revalidate" : maxAge))
		};
		bosco.knox.putBuffer(buffer, file.path, headers, function(err, res){
	      if(res.statusCode != 200 && !err) err = {message:'S3 error, code ' + res.statusCode};
	      bosco.log('Pushed to S3: ' +  cdnUrl + file.path);
		  next(err, {file: file});
		});
	}

	var confirm = function(message, next) {
		 bosco.prompt.start();
	  	 bosco.prompt.get({
		    properties: {
		      confirm: {
		        description: message
		      }
		    }
		  }, function (err, result) {
		  	if(!result) return next({message:'Did not confirm'});
		  	if(result.confirm == 'Y' || result.confirm == 'y') {
	  	 		next(null, true);
	  	 	} else {
	  	 		next(null, false);
	  	 	}
	  	 });
	}

	var checkManifests = function(staticAssets, next) {

		if(!bosco.knox) return next({message: "You don't appear to have any S3 config for this environment?"});

		var manifestFiles = [];
		_.forOwn(staticAssets, function(value, key) {
			if(value.extname == '.manifest') {
				value.file = key;
				manifestFiles.push(value);
			}
		});

		async.mapSeries(manifestFiles, function(file, cb) {
			bosco.log("Pulling previous version of " + file.file.blue + " from S3");
			bosco.knox.getFile(getS3Filename(file.file), function(err, res){
				var currFile = "", isError;
				if(!err && res.statusCode == 404) return cb(null, true);
				if(err || res.statusCode !== 200) {
					bosco.error("There was an error talking to S3 to retrieve the file:")
					isError = true;
				}
				res.on('data', function(chunk) { currFile += chunk; });
				res.on('end', function() {
					if(isError) {
						bosco.error(currFile);
						return cb(null, false);
					}
					if(currFile == file.content) {
						bosco.log("No changes".green + " found in " + file.file.blue + "." + (force ? " Forcing push anyway." : ""));
						return cb(null, force);
					}
					bosco.log("Changes found in " + file.file.blue + ", diff:");
					showDiff(currFile, file.content, cb);
				});
			});
		}, function(err, result) {
			var results = {};
			result.forEach(function(confirm, index) {
				var mkey = manifestFiles[index].tag, atype = manifestFiles[index].assetType;
				results[mkey] = results[mkey] || {};
				results[mkey][atype] = confirm;
			});
			next(err, results);
		});

	}

	var showDiff = function(original, changed, next) {

		var diff = jsdiff.diffLines(original, changed);

		diff.forEach(function(part){
		  var color = part.added ? 'green' :
		  		part.removed ? 'red' : 'grey';
			bosco.log(part.value[color]);
		});

		if(!noprompt) return confirm("Are you certain you want to push based on the changes above?".white, next);
		return next(null, true);

	}

	var go = function() {

		bosco.log("Compiling front end assets, this can take a while ... ");

		var options = {
			repos: repos,
			minify: true,
			tagFilter: tag,
			watchBuilds: false,
			reloadOnly: false
		}

		bosco.staticUtils.getStaticAssets(options, function(err, staticAssets) {
			checkManifests(staticAssets, function(err, confirmation) {
				if(err) return bosco.error(err.message);
				pushAllToS3(staticAssets, confirmation, function(err) {
					if(err) return bosco.error("There was an error: " + err.message);
					bosco.log("Done");
				});

			})

		});
	}

	if(!noprompt) {
		var confirmMsg = "Are you sure you want to publish ".white + (tag ? "all " + tag.blue + " assets in " : "ALL".red + " assets in ").white + bosco.options.environment.blue + " (y/N)?".white
		confirm(confirmMsg, function(err, confirmed) {
			if(!err && confirmed) go();
		})
	} else {
		go();
	}

	function isCompiledAsset(asset) {
		if (asset.type === 'js') return true;
		if (asset.type === 'css') return true;

		return false;
	}

	function isSummaryAsset(asset) {
		if (asset.type === 'html') return true;
		if (asset.type === 'plain') return true;

		return false;
	}

	function isPushConfirmed(confirmation, asset) {
		if (isCompiledAsset(asset)) {
			return isCompiledAssetConfirmed(confirmation, asset);
		}

		if (isSummaryAsset(asset)) {
			return isSummaryAssetConfirmed(confirmation, asset);
		}

		return true;
	}

	function isCompiledAssetConfirmed(confirmation, asset) {
		if (!confirmation[asset.tag]) return true;
		if (confirmation[asset.tag][asset.type]) return false;

		return true;
	}

	function isSummaryAssetConfirmed(confirmation, asset) {
		if (!confirmation[asset.tag]) return true;
		if (confirmation[asset.tag][asset.assetType]) return false;

		return true;
	}

	function getS3Content(file) {
		return file.data || new Buffer(file.content);
	}

	function isContentEmpty(file) {
		return !(file.data || file.content);
	}

	function getS3Filename(file) {
		if (bosco.options.build) {
			file = bosco.options.build + '/' + file;
		}

		file = bosco.options.environment + '/' + file;

		return file;
	}
}

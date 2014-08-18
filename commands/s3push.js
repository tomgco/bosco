var _ = require('lodash'),
	 async = require('async'),
	fs = require("fs"), 
	path = require("path"),
	UglifyJS = require("uglify-js"),
	sass = require("node-sass"),
	crypto = require("crypto"), 
	CleanCSS = require("clean-css"),
	colors = require('colors'),
	jsdiff = require('diff'),
	utils;

module.exports = {
	name:'s3push',
	description:'Builds all of the front end assets for each microservice and pushes them to S3 for the current environment',
	example:'bosco s3push | bosco s3push top',
	cmd:cmd
}

var tag = "", noprompt = false;

function cmd(bosco, args) {
	
	utils = require('../lib/repoUtils')(bosco);
	if(args.length > 0) tag = args[0];

	noprompt = bosco.options.noprompt;
 
	bosco.log("Compile front end assets across services " + (tag ? "for tag: " + tag.blue : ""));

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var pushAllToS3 = function(staticAssets, confirmation, next) {
		var toPush = [];
		_.forOwn(staticAssets, function(asset, key) {			
			if(tag && tag !== asset.key) return;
			
			if(asset.type == 'js' && !confirmation[asset.key][asset.type]) return;
			if(asset.type == 'css' && !confirmation[asset.key][asset.type]) return;
			if(asset.type == 'html' && !confirmation[asset.key][asset.assetType]) return;
			if(asset.type == 'plain' && !confirmation[asset.key][asset.assetType]) return;

			toPush.push({content:asset.content, path:key, type:asset.type});
		});
		async.mapSeries(toPush, pushToS3, next);
	}

	var pushToS3 = function(file, next) {

		if(!bosco.knox) return bosco.warn("Knox AWS not configured for environment " + bosco.options.envrionment + " - so not pushing " + file.path + " to S3.");
		var buffer = new Buffer(file.content);
		var headers = {
		  'Content-Type': 'text/' + file.type,
		  'Cache-Control': 'max-age=300'
		};
		bosco.knox.putBuffer(buffer, file.path, headers, function(err, res){		  
	      if(res.statusCode != 200 && !err) err = {message:'S3 error, code ' + res.statusCode};
	      bosco.log('Pushed to S3: ' +  bosco.config.get('aws:cdn') + "/" + file.path);
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
		
		var manifestFiles = [];

		if(!bosco.knox) return next();

		_.forOwn(staticAssets, function(value, key) {
			if(value.extname == '.manifest') {
				value.file = key;
				manifestFiles.push(value);
			}
		});

		async.mapSeries(manifestFiles, function(file, cb) {
			bosco.knox.getFile(file.file, function(err, res){
				var currFile = "";
				res.on('data', function(chunk) { currFile += chunk; });
				res.on('end', function() { 	
					if(currFile == file.content) {
						bosco.warn("No change in file: " + file.file);
						return cb(null, false);			
					}
					showDiff(currFile, file.content, cb);
				});
			});
		}, function(err, result) {
			
			var results = {};
			result.forEach(function(confirm, index) {
				var mkey = manifestFiles[index].key, atype = manifestFiles[index].assetType;
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

		confirm("Are you certain you want to push based on the changes above?".white, next);	

	}

	var go = function() {
		
		bosco.log("Compiling front end assets, this can take a while ...");

		utils.getStaticAssets(repos, true, function(err, staticAssets) {
			checkManifests(staticAssets, function(err, confirmation) {
				//if(err) return bosco.error(err.message);
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

}
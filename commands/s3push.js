var _ = require('lodash'),
	 async = require('async'),
	fs = require("fs"), 
	path = require("path"),
	UglifyJS = require("uglify-js"),
	sass = require("node-sass"),
	crypto = require("crypto"), 
	CleanCSS = require("clean-css"),
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

	var pushAllToS3 = function(staticAssets, next) {
		var toPush = [];
		_.forOwn(staticAssets, function(asset, key) {			
			toPush.push({content:asset.content, path:key, type:asset.type});
		});
		async.mapSeries(toPush, pushToS3, next);
	}

	var pushToS3 = function(file, next) {

		if(!bosco.knox) return bosco.warn("Knox AWS not configured for environment " + bosco.options.envrionment + " - so not pushing " + file.path + " to S3.");
		var buffer = new Buffer(file.content);
		var headers = {
		  'Content-Type': 'text/' + file.type
		};
		bosco.knox.putBuffer(buffer, file.path, headers, function(err, res){		  
	      if(res.statusCode != 200 && !err) err = {message:'S3 error, code ' + res.statusCode};
	      bosco.log('Pushed to S3: ' +  bosco.config.get('aws:cdn') + "/" + file.path);
		  next(err, {file: file});
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
		  	if(!result) return next({message:'Did not confirm'});
		  	if(result.confirm == 'Y' || result.confirm == 'y') {
	  	 		next()
	  	 	} else {
	  	 		next({message:'Did not confirm'});
	  	 	}
	  	 });
	}

	var go = function() {
		bosco.log("Compiling front end assets, this can take a while ...");
		utils.getStaticAssets(repos, true, function(err, staticAssets) {
			pushAllToS3(staticAssets, function(err) {
				if(err) return bosco.error("There was an error: " + err.message);
				bosco.log("Done");
			});
		});
	}

	if(!noprompt) {
		confirm(function(err) {
			if(!err) go();
		})
	} else {
		go();
	}

}
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var sass = require("node-sass");
var path = require('path');
var hb = require('handlebars');
var utils;

module.exports = {
	name:'cdn',
	description:'Aggregates all the static assets across all microservices and serves them via a pseudo local CDN url',
	example:'bosco cdn <minify>',
	cmd:cmd
}

function cmd(bosco, args) {
	
	utils = require('../src/StaticUtils')(bosco);
	
	var minify = _.contains(args,'minify');
	var port = bosco.config.get('cdn:port') || 7334;
	var serverUrl = "http://localhost:" + port + "/";

	bosco.log("Starting pseudo CDN on port: " + (port+"").blue);

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var startServer = function(staticAssets, serverPort) {
		
		var server = http.createServer(function(request, response) {
		  
		  var url = request.url.replace("/","");

		  if(staticAssets[url]) {
			response.writeHead(200, {
				"Content-Type": "text/" + staticAssets[url].type, 
				"Cache-Control": "no-cache, must-revalidate", 
				"Pragma": "no-cache",
				"Expires": "Sat, 21 May 1952 00:00:00 GMT"
			});
			getContent(staticAssets[url], function(err, content) {
				if(err) {
					response.writeHead(500, {"Content-Type": "text/html"});
					response.end("<h2>There was an error: " + err.message + "</h2>");				
				} else {
					response.end(content);
				}
			})
		  } else {
		  	response.writeHead(404, {"Content-Type": "text/html"});
		  	response.end(formattedAssets(staticAssets));
		  }		  
		});		

		server.listen(serverPort);
		bosco.log("Server is listening on " + serverPort);
	
	}

	var formattedAssets = function(staticAssets) {
		
		var assets = {html: [], js: [], css: [], plain: []},
			templateContent = fs.readFileSync(__dirname + '/../templates/assetList.html'),
			template = hb.compile(templateContent.toString());

		_.map(staticAssets, function(asset, key) {
			assets[asset.type].push(key);	  		
	  	});

		return template(assets);
	  	
	}

	var startMonitor = function(staticAssets) {

	  var watchSet = {};
	  _.forOwn(staticAssets, function(asset, key) {
	  	
	  	if(!minify) return watchSet[asset.path] = key;

	  	if(asset.extname == ".manifest") {

	  		var manifestKey = key, 
	  			manifestFile,
	  			manifestFiles = asset.files;

	  			manifestFiles.forEach(function(file) {	  			
	  				if(file) watchSet[file.path] = asset.tag;
	  			});
	  	}
	  });

	  watch.createMonitor(bosco.getOrgPath(), {ignoreDirectoryPattern: /node_modules/, interval: 50}, function (monitor) {

	    monitor.on("changed", function (f, curr, prev) {	      
	      var fileKey = watchSet[f];	      
	      if(!minify) {		      	      	
	      	if(fileKey) {
		      	staticAssets[fileKey].content = fs.readFileSync(staticAssets[fileKey].path);
		      	bosco.log("Reloaded " + fileKey);	
	      	}
		  } else {
		  	if(fileKey) {
		  		bosco.log('Recompiling tag ' + fileKey.blue + ' due to change in ' + f.blue);
		  		var options = {
					repos: repos, 
					minify: minify,
					tagFilter: fileKey,
					watchBuilds: false,
					reloadOnly: true
				}
		  		utils.getStaticAssets(options, function(err, updatedAssets) {
		  			// Clear old for tag
		  			_.forOwn(staticAssets, function(value, key) {
		  				if(value.tag == fileKey) delete staticAssets[key];
		  			});
		  			// Add new
		  			_.forOwn(updatedAssets, function(value, key) {
		  				staticAssets[key] = value;
		  			});
		  			bosco.log("Reloaded minified assets for tag " + fileKey.blue);	
		  		});
		  	}
		  }
	    })
	  });

	}

	var getContent = function(asset, next) {
		if(asset.extname == '.scss') {
			sass.render(asset.content, next);
		} else {
			next(null, asset.content);	
		}
	}

	if(minify) bosco.log("Minifying front end assets, this can take some time ...");
	var options = {
		repos: repos, 
		minify: minify,
		tagFilter: null,
		watchBuilds: true,
		reloadOnly: false
	}
	utils.getStaticAssets(options, function(err, staticAssets) {
		startServer(staticAssets, port);
		startMonitor(staticAssets);
	});
	
}
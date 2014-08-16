var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var sass = require("node-sass");
var path = require('path');
var utils;

module.exports = {
	name:'cdn',
	description:'Aggregates all the static assets across all microservices and serves them via a pseudo local CDN url',
	example:'bosco cdn minify',
	cmd:cmd
}

function cmd(bosco, args) {
	
	utils = require('../lib/repoUtils')(bosco);
	
	var minify = args.length ? args[0] == "minify" : false;
	var port = bosco.config.get('cdn:port') || 7334;

	bosco.log("Starting pseudo CDN on port: " + (port+"").blue);

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var startServer = function(staticAssets, serverPort) {
		
		var server = http.createServer(function(request, response) {
		  var url = request.url.replace("/","");		 
		  if(staticAssets[url]) {
			response.writeHead(200, {"Content-Type": "text/" + staticAssets[url].type});
			getContent(staticAssets[url], function(err, content) {
				if(err) {
					response.writeHead(500, {"Content-Type": "text/html"});
					response.write("<h2>There was an error: " + err.message + "</h2>");
				} else {
					response.write(content);
				}
			})
		  } else {
		  	response.writeHead(404, {"Content-Type": "text/html"});
		  	response.write("<h2>Couldn't find that, why not try:</h2>");
		  	response.write(_.map(staticAssets, function(asset, key) {
		  		return "<a href='/" + key + "''>" + key + "</a><br/>";
		  	}).join("\n"));
		  }
		  response.end();
		});		
		server.listen(serverPort);
		bosco.log("Server is listening on " + serverPort);
	
	}

	var startMonitor = function(staticAssets) {
	  watch.createMonitor(bosco.getOrgPath(), {ignoreDirectoryPattern: /node_modules/, interval: 50}, function (monitor) {
	    monitor.on("changed", function (f, curr, prev) {
	      _.forOwn(staticAssets, function(asset, key) {
	      	if(asset.path == f) {
	      		staticAssets[key].content = fs.readFileSync(staticAssets[key].path);
	      		bosco.log("Reloaded " + key);
	      	}
	      });
	    })
	  })
	}

	var getContent = function(asset, next) {
		if(asset.extname == '.scss') {
			sass.render(asset.content, next);
		} else {
			next(null, asset.content);	
		}
	}

	if(minify) bosco.log("Minifying front end assets, this can take some time ...");
	if(minify) bosco.warn("Live reload doesn't work (yet) in this mode!");
	utils.getStaticAssets(repos, minify, function(err, staticAssets) {
		startServer(staticAssets, port);
		startMonitor(staticAssets);
	});
	
}
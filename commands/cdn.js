var _ = require('lodash');
var async = require('async');
var fs = require('fs');

module.exports = {
	name:'cdn',
	description:'Aggregates all the static assets across all microservices and serves them via a pseudo local CDN url',
	example:'bosco cdn <port|7334>',
	cmd:cmd
}

var port = 7334;

function cmd(bosco, args) {
	
	port = args.length ? +args[0] : port;

	bosco.log("Starting pseudo CDN on port: " + (port+"").blue);

	var repos = bosco.config.get('github:repos'),
		staticAssets = {};

	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var loadRepo = function(repo, next) {	
		var repoBosco, basePath, repoPath = bosco.getRepoPath(repo), repoBoscoConfig = [repoPath,"bosco-service.json"].join("/");
		if(bosco.exists(repoBoscoConfig)) {
			repoBosco = require(repoBoscoConfig);
			if(repoBosco.assets) {
				basePath = repoBosco.assets.basePath || "";
				if(repoBosco.assets) process(repoPath + basePath, repo, repoBosco.assets);
			}
		}
		next();
	}

	var process = function(repoPath, repo, assets) {
		var assetKey;
		if(assets.js) {
			_.forOwn(assets.js, function(value, key) {
				if(value) {
					value.forEach(function(asset) {						
						assetKey = repo + "/" + asset;					
						staticAssets[assetKey] = staticAssets[assetKey] || {};
						staticAssets[assetKey].path = [repoPath,asset].join("/");
						staticAssets[assetKey].key = key;
						staticAssets[assetKey].repo = repo;
						staticAssets[assetKey].type = 'js';
						staticAssets[assetKey].content = fs.readFileSync(staticAssets[assetKey].path);
					});
				}
			});
		}
		if(assets.css) {
			_.forOwn(assets.css, function(value, key) {
				if(value) {
					value.forEach(function(asset) {
						assetKey = repo + "/" + asset;					
						staticAssets[assetKey] = staticAssets[assetKey] || {};
						staticAssets[assetKey].path = [repoPath,asset].join("/");
						staticAssets[assetKey].key = key;
						staticAssets[assetKey].repo = repo;
						staticAssets[assetKey].type = 'css';
						staticAssets[assetKey].content = fs.readFileSync(staticAssets[assetKey].path);
					});
				}
			});
		}	

	}

	var createHtml = function() {
		
		var htmlAssets = {};

		_.forOwn(staticAssets, function(value, key) {			
			var html, htmlFile = 'html/' + value.key + '.' + value.type + '.html', cdn = 'http://localhost:' + port + '/';
			htmlAssets[htmlFile] = htmlAssets[htmlFile] || {
				content: "",
				type:"html"
			};
			if(value.type == 'js') {
				htmlAssets[htmlFile].content += _.template('<script src="<%= url %>"></script>\n', { 'url': cdn + value.repo + "/" + key });	
			} else {
				htmlAssets[htmlFile].content += _.template('<link rel="stylesheet" href="<%=url %>" type="text/css" media="screen" />\n', { 'url': cdn + value.repo + "/" + key });						
			}
		});

		staticAssets = _.merge(htmlAssets, staticAssets);
	}

	var startServer = function(serverPort) {

		var http = require("http");

		var server = http.createServer(function(request, response) {
		  var url = request.url.replace("/","");		 
		  if(staticAssets[url]) {
			response.writeHead(200, {"Content-Type": "text/" + staticAssets[url].type});
			response.write(staticAssets[url].content);
		  } else {
		  	response.writeHead(404, {"Content-Type": "text/html"});
		  	response.write("<h2>Couldn't find that, why not try:</h2>");
		  	response.write(_.map(staticAssets, function(asset, key) {
		  		return "<a href='" + key + "''>" + key + "</a><br/>";
		  	}).join("\n"));
		  }
		  response.end();
		});		
		server.listen(serverPort);
		bosco.log("Server is listening on " + serverPort);
	}

	async.mapSeries(repos, loadRepo, function(err) {
		createHtml();
		startServer(port);
	})

}
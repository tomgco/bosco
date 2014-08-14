var _ = require('lodash');
var async = require('async');
var fs = require('fs');

module.exports = {
	name:'cdn',
	description:'Aggregates all the static assets across all microservices and serves them via a pseudo local CDN url',
	example:'bosco cdn <port|7334>',
	cmd:cmd
}

function cmd(bosco, args) {
	
	bosco.log("Starting pseudo CDN " + args);

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
		if(assets.js) {
			_.forOwn(assets.js, function(value, key) {
				if(value) {
					value.forEach(function(asset) {
						if(staticAssets[asset]) bosco.error("Duplicate static asset: " + asset + " in Repo " + repo);
						staticAssets[asset] = staticAssets[asset] || {};
						staticAssets[asset].path = [repoPath,asset].join("/");
						staticAssets[asset].key = key;
						staticAssets[asset].type = 'js';
						staticAssets[asset].content = fs.readFileSync(staticAssets[asset].path);
					});
				}
			});
		}
		if(assets.css) {
			_.forOwn(assets.css, function(value, key) {
				if(value) {
					value.forEach(function(asset) {
						if(staticAssets[asset]) bosco.error("Duplicate static asset: " + asset + " in Repo " + repo);
						staticAssets[asset] = staticAssets[asset] || {};
						staticAssets[asset].path = [repoPath,asset].join("/");
						staticAssets[asset].key = key;
						staticAssets[asset].type = 'css';
						staticAssets[asset].content = fs.readFileSync(staticAssets[asset].path);
					});
				}
			});
		}	

	}

	var createHtml = function() {
		
		var htmlAssets = {};

		_.forOwn(staticAssets, function(value, key) {			
			var html, htmlFile = 'html/' + value.key + '.' + value.type + '.html', cdn = 'http://localhost:7334/';
			htmlAssets[htmlFile] = htmlAssets[htmlFile] || {
				content: ""	
			};
			if(value.type == 'js') {
				htmlAssets[htmlFile].content += _.template('<script src="<%= url %>"></script>\n', { 'url': cdn + key });	
			} else {
				htmlAssets[htmlFile].content += _.template('<link rel="stylesheet" href="<%=url %>" type="text/css" media="screen" />\n', { 'url': cdn + key });						
			}
		});

		staticAssets = _.merge(staticAssets, htmlAssets);
	}

	var startServer = function(port) {

		var http = require("http");

		var server = http.createServer(function(request, response) {
		  var url = request.url.replace("/","");		 
		  if(staticAssets[url]) {
			response.writeHead(200, {"Content-Type": "text/html"});
			response.write(staticAssets[url].content);
		  } else {
		  	response.writeHead(404, {"Content-Type": "text/html"});
		  	response.write("<h2>" + url + " not found, try:</h2>");
		  	response.write("<br/>" + _.map(staticAssets, function(asset, key) {
		  		return key + " >> " + asset.path + "<br/>";
		  	}).join("\n"));
		  }
		  response.end();
		});		
		server.listen(port);
		bosco.log("Server is listening on " + port);
	}

	async.mapSeries(repos, loadRepo, function(err) {
		createHtml();
		startServer(7334);
	})

}
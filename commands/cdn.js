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
		_.forOwn(assets.js, function(value, key) {
			if(value) {
				value.forEach(function(asset) {
					if(staticAssets[asset]) bosco.error("Duplicate static asset: " + asset + " in Repo " + repo);
					staticAssets[asset] = staticAssets[asset] || {};
					staticAssets[asset].path = [repoPath,asset].join("/");
					staticAssets[asset].content = fs.readFileSync(staticAssets[asset].path);
				});
			}
		});
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
		startServer(7334);
	})

}

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var http = require('http');
var pm2 = require('pm2');

module.exports = {
	name:'run',
	description:'Runs all of the microservices (or subset based on regex pattern) using pm2',
	example:'bosco run -r <repoPattern>',
	cmd:cmd
}

function cmd(bosco, args) {

	var repoPattern = bosco.options.repo;
	var repoRegex = new RegExp(repoPattern);
	var repos = bosco.config.get('github:repos');
	var runningServices = {};

	// Connect or launch PM2
	pm2.connect(function(err) {

		var startRunnableServices = function(running) {			
			async.map(repos, function(repo, next) {				
				var pkg, basePath, repoPath = bosco.getRepoPath(repo), packageJson = [repoPath,"package.json"].join("/");
				if(repo.match(repoRegex) && bosco.exists(packageJson)) {
					pkg = require(packageJson);
					if(_.contains(running, repos)) {
						bosco.warn(repo + " already running, use 'bosco stop " + repo + "'");
						return next();
					}					
					if(pkg.scripts && pkg.scripts.start) {
						runService(repo, pkg.scripts, repoPath, next);
					} else {
						next();
					}
				} else {
					next();
				}

			}, function(err) {				
				process.exit(0);
			});

		}

		var getRunningServices = function(next) {
			pm2.list(function(err, list) {
				next(err, _.pluck(list,'name'));				
			});
		}

		var runService = function(repo, scripts, repoPath, next) {
			bosco.log("Starting " + repo + " @ " + repoPath + " via " + scripts.start.blue);
			run(repo, scripts, repoPath, next);
		}

		var run = function(repo, scripts, repoPath, next) {		
			
			// Remove node from the start script as not req'd for PM2
			var start = scripts.start, startArr;			
			if(start.split(" ")[0] == "node") {
				 startArr = start.split(" ");
				 startArr.shift();				 
				 start = startArr.join(" ");
			}

			pm2.start(start, { name: repo, cwd: repoPath, watch: true, executeCommand: ext == ".js" ? false : true }, next);

		}

		bosco.log("Run each mircoservice " + args);

		getRunningServices(function(err, running) {
			startRunnableServices(running);	
		});

	});

}
	

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var pm2 = require('pm2');

module.exports = {
	name:'stop',
	description:'Stops all of the microservices (or subset based on regex pattern) using pm2',
	example:'bosco stop <pattern>',
	cmd:cmd
}

function cmd(bosco, args) {

	var repoPattern = args.shift() || '.*';
	var repoRegex = new RegExp(repoPattern);
	var repos = bosco.config.get('github:repos');
	var runningServices = {};

	// Connect or launch PM2
	pm2.connect(function(err) {

		var stopRunningServices = function(running) {			
			async.map(repos, function(repo, next) {				
				var pkg, basePath, repoPath = bosco.getRepoPath(repo), packageJson = [repoPath,"package.json"].join("/");
				if(repo.match(repoRegex) && bosco.exists(packageJson)) {
					pkg = require(packageJson);
					if(_.contains(running, repo)) {
						stopService(repo, pkg.scripts.start, repoPath, next);						
					} else {
						bosco.error("Not running: " + repo);
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

		var stopService = function(repo, script, repoPath, next) {
			bosco.log("Stopping " + repo + " @ " + repoPath + " via " + script.blue);
			pm2.stop(repo, function(err, proc) {
				pm2.delete(repo, function(err, proc) {
				  next(err);	
				});				
			});	
		}

		bosco.log("Stop each mircoservice " + args);

		getRunningServices(function(err, running) {
			stopRunningServices(running);	
		});

	});

}
	

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var exec = require('child_process').exec;

module.exports = {
	name:'run',
	description:'Runs all of the microservices (or subset based on tag)',
	example:'bosco run <tag>',
	cmd:cmd
}

function cmd(bosco, args) {
	
	var app = args.length > 0 ? args[0] : 'ALL';
	var repos = bosco.config.get('github:repos');
	var runnableServices = {};

	var getRunnableServices = function() {
		_.map(repos, function(repo) {
			var repoPackage, basePath, repoPath = bosco.getRepoPath(repo), repoPackageJson = [repoPath,"package.json"].join("/");
			if(bosco.exists(repoPackageJson)) {
				repoPackage = require(repoPackageJson);
				if(repoPackage.scripts && repoPackage.scripts.start) {
					runService(repo, repoPackage.scripts.start, repoPath);
				}				
			}
		});
	}

	var runService = function(repo, script, repoPath) {
		bosco.log("Starting " + repo + " @ " + repoPath + " via " + script.blue);
		run(repo, script, repoPath);
	}

	bosco.log("Run each mircoservice " + args);
	getRunnableServices();

}

function run(repo, script, repoPath, next) {	
	exec(script, {
	  cwd: repoPath
	}, function(err, stdout, stderr) {
		if(err) {
			bosco.error(stderr);
		} else {
			bosco.log(repo.purple + " " + stdout);
		}
		next(err);
	});
}
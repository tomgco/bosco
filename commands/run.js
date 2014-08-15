
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var spawn = require('child_process').spawn;

module.exports = {
	name:'run',
	description:'Runs all of the microservices (or subset based on tag)',
	example:'bosco run <tag>',
	cmd:cmd
}

function cmd(bosco, args) {
	
	var app = args.length > 0 ? args[0] : 'ALL';
	var repos = bosco.config.get('github:repos');
	var runningServices = {};

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


	var run = function(repo, script, repoPath) {	
		
		var args = script.split(" ");
		scriptCmd = args.shift();

		var cp = spawn(scriptCmd, args, {
		  cwd: repoPath
		});

		runningServices[repo] = {
			repo: repo,
			pid: cp.pid,
			process: cp,
			stdout: "",
			stderr: ""
		}

		cp.stdout.on('data', function(data) {
			runningServices[repo].stdout += data.toString();
		});

		cp.stderr.on('data', function(data) {
			runningServices[repo].stderr += data.toString();
		});

		runningServices[repo].interval = setInterval(function() {
			if(runningServices[repo].stderr) {
				console.log(runningServices[repo].stderr);
				runningServices[repo].stderr = "";
			};
			if(runningServices[repo].stdout) {
				console.log(runningServices[repo].stdout);
				runningServices[repo].stdout = "";
			};
		},5000);
	
	}

	bosco.log("Run each mircoservice " + args);
	getRunnableServices();

}

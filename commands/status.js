var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var sass = require("node-sass");
var path = require('path');
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';
var exec = require('child_process').exec;
var utils;

module.exports = {
	name:'status',
	description:'Checks git status across all services',
	example:'bosco status -r <repoPattern>',
	cmd:cmd
}

function cmd(bosco, args) {

	var repoPattern = bosco.options.repo;
	var repoRegex = new RegExp(repoPattern);

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	bosco.log("Running git status across all repos ...");

	var stashRepos = function(cb) {	    	

		async.mapLimit(repos, bosco.options.cpus, function repoStash(repo, repoCb) {	  

		  if(!repo.match(repoRegex)) return repoCb();

		  var repoPath = bosco.getRepoPath(repo); 
		  status(bosco, repoPath, repoCb);
		  
		}, function(err) {
			cb();
		});

	}

	stashRepos(function() {
		bosco.log("Complete");
	});

}

function status(bosco, orgPath, next) {
    
    if(!bosco.exists([orgPath,".git"].join("/"))) {
    	bosco.warn("Doesn't seem to be a git repo: "+ orgPath.blue);
    	return next();
    }

	exec('git status', {
	  cwd: orgPath
	}, function(err, stdout, stderr) {
		if(err) {
			bosco.error(orgPath.blue + " >> " + stderr);
		} else {
			if(stdout) {
				if(stdout.indexOf("Changes not staged") > 0) {
					bosco.log(orgPath.blue + ":\n" + stdout);					
				} else if(stdout.indexOf("Your branch is ahead") > 0) {
					bosco.log(orgPath.blue + ":\n" + stdout);										
				} else {
					bosco.log(orgPath.blue + ": " + "OK".green);	
				}
			}
		}
		next(err);
	});
}
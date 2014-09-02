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
	name:'upstream',
	description:'Runs a git fetch and tells you what has changed upstream for all your repos',
	example:'bosco upstream -r <repoPattern>',
	cmd:cmd
}

function cmd(bosco, args) {

	var repoPattern = bosco.options.repo;
	var repoRegex = new RegExp(repoPattern);

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var changedRepos = function(cb) { 	
		async.mapLimit(repos, bosco.options.cpus, function repoStash(repo, repoCb) {	  
		  var repoPath = bosco.getRepoPath(repo); 
		  if(!repo.match(repoRegex)) return repoCb();
		  upstream(bosco, repoPath, repoCb);
		}, function(err) {
			cb();
		});
	}

	bosco.log("Checking upstream origin for changes, this may take a while ...")

	changedRepos(function() {
		bosco.log("Complete");
	});

}

function upstream(bosco, orgPath, next) {
    
	exec('git fetch; git log HEAD..origin/master --oneline', {
	  cwd: orgPath
	}, function(err, stdout, stderr) {
		if(err) {
			bosco.error(stderr);
		} else {
			if(stdout) {
				bosco.log("Changes in " + orgPath.blue);
				console.log(stdout);
			} else {
				bosco.log(orgPath.blue + ": " + "No Change".green);
			}
		}
		next(err);
	});
}
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
	example:'bosco upstream',
	cmd:cmd
}

function cmd(bosco, args) {

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var changedRepos = function(cb) {
	    	
		async.mapSeries(repos, function repoStash(repo, repoCb) {	  

		  var repoPath = bosco.getRepoPath(repo); 
		  upstream(bosco, repoPath, repoCb);

		}, function(err) {
			if(err) bosco.error(err.message);
			cb();
		});

	}

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
			}
		}
		next(err);
	});
}
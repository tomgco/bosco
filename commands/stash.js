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
	name:'stash',
	description:'Stashes any local changes across all repos',
	example:'bosco stash',
	cmd:cmd
}

function cmd(bosco, args) {

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	bosco.log("Running git stash across all repos ...");

	var stashRepos = function(cb) {
	    	
		var progressbar = bosco.config.get('progress') == 'bar', 
			total = repos.length;

		var bar = progressbar ? new bosco.progress('Doing git stash [:bar] :percent :etas', {
  			complete: green,
  			incomplete: red,
			width: 50,
			total: total
		}) : null;

		async.mapSeries(repos, function repoStash(repo, repoCb) {	  

    	  if(progressbar) bar.tick();
		  var repoPath = bosco.getRepoPath(repo); 
		  stash(bosco, progressbar, repoPath, repoCb);
		  
		}, function(err) {
			cb();
		});

	}

	stashRepos(function() {
		bosco.log("Complete");
	});

}

function stash(bosco, progressbar, orgPath, next) {
    
    if(!progressbar) bosco.log("Stashing "+ orgPath.blue);
    if(!bosco.exists([orgPath,".git"].join("/"))) {
    	bosco.warn("Doesn't seem to be a git repo: "+ orgPath.blue);
    	return next();
    }

	exec('git stash', {
	  cwd: orgPath
	}, function(err, stdout, stderr) {
		if(err) {
			if(progressbar) console.log("");
			bosco.error(orgPath.blue + " >> " + stderr);
		} else {
			if(!progressbar && stdout) bosco.log(orgPath.blue + " >> " + stdout);
		}
		next(err);
	});
}
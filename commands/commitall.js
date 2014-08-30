var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var colors = require('colors');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';
var utils;

module.exports = {
	name:'commitall',
	description:'Will run commit across all repos - useful for batch updates',
	example:'bosco commit <pattern> <commitMsg>',
	cmd:cmd
}

function cmd(bosco, args) {

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var repoPattern = args.shift();
	var message = args.shift();

	if(!repoPattern) return bosco.error("You need to supply at least a commit message.");

	if(!message) {
		message = repoPattern;
		repoPattern = ".*";
	}

	if(args.shift()) {
		return bosco.error("You need to put your commit message in quotes: 'this is my message'");
	}

	var repoRegex = new RegExp(repoPattern);

	bosco.log("Running git commit -am across all repos that match " + repoRegex + "...");
	bosco.log("Using message: " + message.blue);	

	var commitRepos = function(cb) {	    	

		async.mapSeries(repos, function repoPush(repo, repoCb) {	  

    	  var repoPath = bosco.getRepoPath(repo); 
    	  if(repo.match(repoRegex)) {    
    	  	 bosco.log("Running 'git commit -am' on " + repo.blue);	  			 
			 commit(bosco, message, repoPath, repoCb);	
    	  } else {
    	  	repoCb();
    	  }
		  
		}, function(err) {
			cb();
		});

	}

	commitRepos(function() {
		bosco.log("Complete");
	});

}



function confirm(bosco, message, next) {
	 bosco.prompt.start();
  	 bosco.prompt.get({
	    properties: {
	      confirm: {
	        description: message
	      }
	    }
	  }, function (err, result) {
	  	if(!result) return next({message:'Did not confirm'});
	  	if(result.confirm == 'Y' || result.confirm == 'y') {
  	 		next(null, true);
  	 	} else {
  	 		next(null, false);
  	 	}
  	 });
}


function commit(bosco, commitMsg, orgPath, next) {
    
    if(!bosco.exists([orgPath,".git"].join("/"))) {
    	bosco.warn("Doesn't seem to be a git repo: "+ orgPath.blue);
    	return next();
    }    

    confirm(bosco, 'Confirm you want to commit any changes in: ' + orgPath.blue, function(err, confirmed) {
    	if(err || !confirmed) return next();    	
    	var gitCmd = 'git commit -am "' + commitMsg +'"';    	
		exec(gitCmd, {
		  cwd: orgPath
		}, function(err, stdout, stderr) {
			if(err) {
				bosco.warn(orgPath.blue + " >> No changes to commit.");
			} else {
				if(stdout) bosco.log(orgPath.blue + " >> " + stdout);
			}
			next();
		});
    })
}
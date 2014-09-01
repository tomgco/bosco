var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var colors = require('colors');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';
var utils;

/*
* this command is called pushall as there is a weird Node bug when calling the command 'push' - try bosco push to see.
*/

module.exports = {
	name:'pushall',
	description:'Will push any changes across all repos - useful for batch updates, typicall used after commitall',
	example:'bosco pushall -r <repoPattern>',
	cmd:cmd
}

function cmd(bosco, args) {

	var repos = bosco.config.get('github:repos');
	if(!repos) return bosco.error("You are repo-less :( You need to initialise bosco first, try 'bosco fly'.");

	var regex = bosco.options.repo; 

	bosco.log("Running git push across all repos that match " + regex + "...");

	var pushRepos = function(cb) {	    	

		async.mapSeries(repos, function repoPush(repo, repoCb) {	  

    	  var repoPath = bosco.getRepoPath(repo); 
    	  if(repo.match(regex)) {    
    	  	 bosco.log("Running git push on " + repo.blue);	  			 
			 push(bosco, repoPath, repoCb);	
    	  } else {
    	  	repoCb();
    	  }
		  
		}, function(err) {
			cb();
		});

	}

	pushRepos(function() {
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


function push(bosco, orgPath, next) {
    
    if(!bosco.exists([orgPath,".git"].join("/"))) {
    	bosco.warn("Doesn't seem to be a git repo: "+ orgPath.blue);
    	return next();
    }    

    confirm(bosco, 'Confirm you want to push: ' + orgPath.blue, function(err, confirmed) {
    	if(err || !confirmed) return next();    	
		exec('git push origin master', {
		  cwd: orgPath
		}, function(err, stdout, stderr) {
			if(err) {
				bosco.error(orgPath.blue + " >> " + stderr);
			} else {
				if(stdout) bosco.log(orgPath.blue + " >> " + stdout);
			}
			next(err);
		});
    })
}
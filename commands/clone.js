
var request = require('request');
var fs = require('fs');
var _ = require('lodash');
var asciify = require('asciify');
var git = require('gulp-git');
var async = require('async');
var mkdirp = require('mkdirp');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

module.exports = {
	name:'fly',
	description:'Gets an list of all repos in your team and runs git clone for each',
	example: 'bosco clone',
	help: getHelp(),
	cmd:cmd
}

function cmd(bosco, args, next) {

	var options = {
	    headers: {
	        'User-Agent': 'Bosco-You-Fool'
	    },
	    auth: {
	        user: bosco.config.get('github:authToken') + ':x-oauth-basic'
	    },
	    proxy: process.env.http_proxy ? process.env.http_proxy : undefined,
	    json: true
	};

	var repoPattern = bosco.options.repo;
	var repoRegex = new RegExp(repoPattern);

    var ignoredRepos = bosco.config.get('github:ignoredRepos') || [];

    function fetchTeamProfile(err, res, teamJson) {

    	if(teamJson.message) {
    		bosco.error("There was a problem talking to the Github: " + teamJson.message);
    		if(teamJson.message == 'Bad credentials') {
    			bosco.warn("To create a token visit here: https://github.com/blog/1509-personal-api-tokens")
    		}
    		return;
    	}

        if (err) {
            return bosco.error("Could not find your team, or you are not a member of any team", err.message);
        }

        var team = _.find(teamJson, {slug: bosco.config.get('github:team')});

        if(!team) return bosco.error("Unable to get team from Github");

        bosco.log("Fetching repos for " + team.name.magenta);

        function fetchTeamRepositories(err, res, reposJson) {

            if (err) {
                return bosco.error('Problem with request: ' + err.message);
            }

            if (res.statusCode != '200') {
                return bosco.error('Received non-ok reponse: ' + res.statusCode);
            }

            var repos = [];

            function obtainRepositoryName(repo) {
                if(_.contains(ignoredRepos,repo.name)) return;
                repos.push(repo.name);                
            }

            reposJson.forEach(obtainRepositoryName);
            fetch(bosco, repos, repoRegex, args, next);

        }

        request.get(team.repositories_url + '?per_page=100', options, fetchTeamRepositories);

    }

    request.get('https://api.github.com/user/teams', options, fetchTeamProfile);
	
}

function fetch(bosco, repos, repoRegex, args, next) {

	var org = bosco.config.get('github:organization'), orgPath;

	var checkOrg = function(cb) {
		orgPath = bosco.getOrgPath();
		if(!bosco.exists(orgPath)) {
			bosco.log("Creating organization folder " + orgPath.magenta);
			mkdirp(orgPath, cb);
		} else {
			cb();
		}
	}

	var saveRepos = function(cb) {
		bosco.config.set("github:repos",repos);
		bosco.config.save(cb);
	}

	var getRepos = function(cb) {

		var progressbar = bosco.config.get('progress') == 'bar', 
			total = repos.length, 
			pullFlag = false;

  		var bar = progressbar ? new bosco.progress('Getting repositories [:bar] :percent :etas', {
			complete: green,
  			incomplete: red,
			width: 50,
			total: total
		}) : null;

    	async.mapLimit(repos, bosco.options.cpus, function repoGet(repo, repoCb) {	      	 

    	  if(!repo.match(repoRegex)) return repoCb();

		  var repoPath = bosco.getRepoPath(repo); 
		  var repoUrl = bosco.getRepoUrl(repo);

		  if(bosco.exists(repoPath)) {
		  	pullFlag = true;	  		
		  	if(progressbar) bar.tick();
		  	repoCb();
		  } else {
		  	clone(bosco,  progressbar, bar, repoUrl, orgPath, repoCb);
		  }
		}, function(err) {
			if(pullFlag) bosco.warn("Some repositories already existed, to pull changes use 'bosco pull'");
			cb(err);
		})
		
	}

	async.series([checkOrg, saveRepos, getRepos], function(err) {
		bosco.log("Complete");
		if(next) next();
	});

}

function clone(bosco, progressbar, bar, repoUrl, orgPath, next) {
    if(!progressbar) bosco.log("Cloning " + repoUrl.blue + " into " + orgPath.blue);
	exec('git clone ' + repoUrl, {
	  cwd: orgPath
	}, function(err, stdout, stderr) {
		if(progressbar) bar.tick();
		if(err) {
			if(progressbar) console.log("");
			bosco.error(repoUrl.blue + " >> " + stderr);
		} else {
			if(!progressbar && stdout) bosco.log(repoUrl.blue + " >> " + stdout);
		}
		next();
	});
}

function getHelp() {
	return "This is some example help for the go command."
}

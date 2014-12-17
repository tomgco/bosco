
var request = require('request');
var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var parse = require('parse-link-header');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

module.exports = {
    name:'clone',
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

    if(!bosco.config.get('github:team')) {
        // The user does not have a team, so just treat the repos config
        // as manually edited
        bosco.log('No team set, so using repos in config as manually managed list ...');
        var repos = bosco.config.get('github:repos');
        return fetch(bosco, repos, repoRegex, args, next);
    }

    function fetchTeamProfile(err, res, teamJson) {

        if(teamJson.message) {
            bosco.error('There was a problem talking to the Github: ' + teamJson.message);
            if(teamJson.message == 'Bad credentials') {
                bosco.warn('To create a token visit here: https://github.com/blog/1509-personal-api-tokens')
            }
            return;
        }

        if (err) {
            return bosco.error('Could not find your team, or you are not a member of any team', err.message);
        }

        var team = _.find(teamJson, {slug: bosco.config.get('github:team')});

        if(!team) return bosco.error('Unable to get team from Github');

        bosco.log('Fetching repos for ' + team.name.magenta);

		var repos = [];

        function fetchTeamRepositories(url, callback) {

            var org = bosco.getOrg();

            function obtainRepositoryName(repo) {
                if(repo.full_name.indexOf(org + '/') !== 0) return;
                if(_.contains(ignoredRepos, repo.name)) return;
                repos.push(repo.name);
            }

            function fetchReposPage(next) {
                request.get(url, options, function (err, res, reposJson) {
                    if (err) err = new Error('Problem with request: ' + err.message);

                    if (res.statusCode != '200') err = new Error('Received non-ok reponse: ' + res.statusCode);

                    if (err) {
                        bosco.error(err.message);
                        return next(err);
                    }

                    reposJson.forEach(obtainRepositoryName);

                    var pagination = parse(res.headers.link);

                    if (!_.isNull(pagination)) {
                        url = pagination.next ? pagination.next.url : null;
                    } else {
                        url = null;
                    }

                    next();
                });
            }

            // While loop version of async.js
            async.whilst(
                function() { return !!url }, // Stop once url is falsy
                fetchReposPage,
                callback
            );
        }

		fetchTeamRepositories(team.repositories_url + '?per_page=100', function (err) {
			if (!err) fetch(bosco, repos, repoRegex, args, next);
		});
    }

    request.get('https://api.github.com/user/teams', options, fetchTeamProfile);

}

function fetch(bosco, repos, repoRegex, args, next) {

    var orgPath = bosco.getOrgPath();

    var saveRepos = function(cb) {
        bosco.config.set('github:repos',repos);
        bosco.config.save(cb);
    }

    var checkOrphans = function(cb) {

        fs.readdir(bosco.getOrgPath(), function(err, files) {

            var orphans = _.chain(files)
                            .map(function(file) { return path.join(bosco.getOrgPath(),file) })
                            .filter(function(file) { return fs.statSync(file).isDirectory() && bosco.exists(path.join(file, '.git')) })
                            .map(function(file) { return path.relative(bosco.getOrgPath(), file); })
                            .difference(repos)
                            .value()

            orphans.forEach(function(orphan) {
                bosco.warn('I am concerned that you still have the repo ' + orphan.red + ' as it is no longer in the github team, you should probably remove it?');
            });

            cb();

        });

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
            if(pullFlag) bosco.warn('Some repositories already existed, to pull changes use \'bosco pull\'');
            cb(err);
        })

    }

    async.series([saveRepos, checkOrphans, getRepos], function() {
        bosco.log('Complete');
        if(next) next();
    });

}

function clone(bosco, progressbar, bar, repoUrl, orgPath, next) {
    if(!progressbar) bosco.log('Cloning ' + repoUrl.blue + ' into ' + orgPath.blue);
    exec('git clone ' + repoUrl, {
      cwd: orgPath
    }, function(err, stdout, stderr) {
        if(progressbar) bar.tick();
        if(err) {
            if(progressbar) console.log('');
            bosco.error(repoUrl.blue + ' >> ' + stderr);
        } else {
            if(!progressbar && stdout) bosco.log(repoUrl.blue + ' >> ' + stdout);
        }
        next();
    });
}

function getHelp() {
    return 'This is some example help for the go command.'
}

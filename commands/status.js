var async = require('async');
var exec = require('child_process').exec;

module.exports = {
    name:'status',
    description:'Checks git status across all services',
    example:'bosco status -r <repoPattern>',
    cmd:cmd
}

function cmd(bosco) {

    var repoPattern = bosco.options.repo;
    var repoRegex = new RegExp(repoPattern);

    var repos = bosco.config.get('github:repos');
    if(!repos) return bosco.error('You are repo-less :( You need to initialise bosco first, try \'bosco clone\'.');

    bosco.log('Running git status across all repos ...');

    var statusRepos = function(cb) {

        async.mapLimit(repos, bosco.options.cpus, function(repo, repoCb) {

          if(!repo.match(repoRegex)) return repoCb();

          var repoPath = bosco.getRepoPath(repo);
          status(bosco, repoPath, repoCb);

        }, function() {
            cb();
        });

    }

    statusRepos(function() {
        bosco.log('Complete');
    });

}

function status(bosco, orgPath, next) {

    if(!bosco.exists([orgPath,'.git'].join('/'))) {
        bosco.warn('Doesn\'t seem to be a git repo: '+ orgPath.blue);
        return next();
    }

    exec('git status', {
      cwd: orgPath
    }, function(err, stdout, stderr) {
        if(err) {
            bosco.error(orgPath.blue + ' >> ' + stderr);
        } else {
            if(stdout) {
                if(stdout.indexOf('Changes not staged') > 0) {
                    bosco.log(orgPath.blue + ':\n' + stdout);
                } else if(stdout.indexOf('Your branch is ahead') > 0) {
                    bosco.log(orgPath.blue + ':\n' + stdout);
                } else {
                    bosco.log(orgPath.blue + ': ' + 'OK'.green);
                }
            }
        }
        next(err);
    });
}

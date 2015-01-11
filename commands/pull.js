var async = require('async');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

module.exports = {
    name:'pull',
    description:'Pulls any changes across all repos',
    example:'bosco pull -r <repoPattern>',
    cmd:cmd
}

function cmd(bosco, args, next) {

    var repoPattern = bosco.options.repo;
    var repoRegex = new RegExp(repoPattern);

    var repos = bosco.getRepos();
    if(!repos) return bosco.error('You are repo-less :( You need to initialise bosco first, try \'bosco clone\'.');

    bosco.log('Running ' + 'git pull --rebase'.blue + ' across all repos ...');

    var pullRepos = function(cb) {

        var progressbar = bosco.config.get('progress') == 'bar',
            total = repos.length;

        var bar = progressbar ? new bosco.progress('Doing git pull [:bar] :percent :etas', {
              complete: green,
              incomplete: red,
            width: 50,
            total: total
        }) : null;

        async.mapLimit(repos, bosco.concurrency.network, function repoStash(repo, repoCb) {

          if(!repo.match(repoRegex)) return repoCb();

          var repoPath = bosco.getRepoPath(repo);
          pull(bosco, progressbar, bar, repoPath, repoCb);

        }, function() {
            cb();
        });

    }

    pullRepos(function() {
        bosco.log('Complete');
        if(next) next();
    });

}


function pull(bosco, progressbar, bar, repoPath, next) {

    if(!bosco.exists([repoPath,'.git'].join('/'))) {
        bosco.warn('Doesn\'t seem to be a git repo: '+ repoPath.blue);
        return next();
    }

    exec('git pull --rebase origin master', {
      cwd: repoPath
    }, function(err, stdout, stderr) {
        if(progressbar) bar.tick();
        if(err) {
            if(progressbar) console.log('');
            bosco.error(repoPath.blue + ' >> ' + stderr);
        } else {
            if(!progressbar && stdout) {
                if(stdout.indexOf('up to date') > 0) {
                    bosco.log(repoPath.blue + ': ' + 'No change'.green);
                } else {
                    bosco.log(repoPath.blue + ': ' + 'Pulling changes ...'.red + '\n' + stdout);
                }
            }
        }
        next();
    });
}

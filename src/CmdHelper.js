var async = require('async');
var _ = require('lodash');
var exec = require('child_process').exec;

/**
 * Helper functions to reduce repetition and boiler plate in commands
 */
function createOptions(bosco, options) {

    return _.defaults(options, {
        cmd: 'echo NO COMMAND DEFINED!',
        guardFn: function(bosco, repoPath, options, next) {
            next();
        },
        stdoutFn: function(stdout, repoPath) {
            bosco.error(repoPath.green + ' >> ' + stdout);
        },
        stderrFn: function(stderr, repoPath) {
            bosco.error(repoPath.red + ' >> ' + stderr);
        },
        dieOnError: false
    });

}

function iterate(bosco, options, next) {

    var repoPattern = bosco.options.repo;
    var repoRegex = new RegExp(repoPattern);
    var repos = bosco.config.get('github:repos');
    if(!repos) return bosco.error('You are repo-less :( You need to initialise bosco first, try \'bosco clone\'.');

    async.mapLimit(repos, bosco.options.cpus, function(repo, repoCb) {
      if(!repo.match(repoRegex)) return repoCb();

      var repoPath = bosco.getRepoPath(repo);

      options.guardFn(bosco, repoPath, options, function(err) {
        if(err) return repoCb(err);
        execute(options.cmd, repoPath, options, repoCb);
      });

    }, function(err) {
        if(options.dieOnError) return next(err);
        next();
    });

}

function execute(command, repoPath, options, next) {

    exec(command, {
      cwd: repoPath
    }, function(err, stdout, stderr) {
        if(err) {
            options.stderrFn(stderr, repoPath);
        } else {
            options.stdoutFn(stdout, repoPath);
        }
        next(err);
    });

}

module.exports = {
    createOptions: createOptions,
    iterate: iterate,
    execute: execute
}

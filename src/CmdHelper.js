var async = require('async');
var _ = require('lodash');
var spawn = require('child_process').spawn;
var hl = require('highland');

/**
 * Helper functions to reduce repetition and boiler plate in commands
 */
function createOptions(bosco, options) {

    return _.defaults(options, {
        cmd: 'echo NO COMMAND DEFINED!',
        args: [],
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
        execute(bosco, options.cmd, options.args, repoPath, options, repoCb);
      });

    }, function(err) {
        if(options.dieOnError) return next(err);
        next();
    });

}

function execute(bosco, command, args, repoPath, options, next) {

    var stderr = '', stdout = '';

    var sc = spawn(command, args, {
      cwd: repoPath
    });

    if(options.stdoutStreamFn) {
        bosco.log('Starting output stream for: ' + repoPath.green);
        hl(sc.stdout).each(function(buffer) { options.stdoutStreamFn(buffer, repoPath) });
    } else {
        sc.stdout.on('data', function (data) {
            stdout += data;
        });
    }

    if(options.stderrStreamFn) {
        hl(sc.stderr).each(function(buffer) { options.stderrStreamFn(buffer, repoPath) });
    } else {
        sc.stderr.on('data', function (data) {
            stderr += data;
        });
    }

    sc.on('close', function (code) {
      if(stderr) { options.stderrFn(stderr, repoPath); }
      if(stdout) { options.stdoutFn(stdout, repoPath); }
      next(code === 0 ? null : 'Process exited with status code ' + code);
    });

}

module.exports = {
    createOptions: createOptions,
    iterate: iterate,
    execute: execute
}

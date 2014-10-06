var _ = require('lodash');
var async = require('async');
var NodeRunner = require('../src/RunWrappers/Node');
var DockerRunner = require('../src/RunWrappers/Docker');
var runningServices = [];

module.exports = {
    name: 'stop',
    description: 'Stops all of the microservices (or subset based on regex pattern)',
    example: 'bosco stop -r <repoPattern>',
    cmd: cmd
}

function cmd(bosco, args) {

    var repoPattern = bosco.options.repo;
    var repoRegex = new RegExp(repoPattern);
    var repos = bosco.config.get('github:repos');

    var initialiseRunners = function(next) {
        var runners = [NodeRunner, DockerRunner];
        async.map(runners, function loadRunner(runner, cb) {
            runner.init(bosco, cb);
        }, next);
    }

    var stopRunningServices = function() {

        async.map(repos, function(repo, next) {

            var pkg, svc,
                repoPath = bosco.getRepoPath(repo),
                packageJson = [repoPath, 'package.json'].join('/'),
                boscoService = [repoPath, 'bosco-service.json'].join('/');

            if (repo.match(repoRegex)) {

                if (bosco.exists(packageJson)) {
                    pkg = require(packageJson);
                    if (pkg.scripts && pkg.scripts.start) {
                        // Assume node
                        if (_.contains(runningServices, repo)) {
                            return NodeRunner.stop({name: repo, cwd: repoPath, cmd: pkg.scripts.start}, next);
                        }
                    }
                }

                if (bosco.exists(boscoService)) {
                    svc = require(boscoService);
                    if (svc.service) {
                        if (svc.service.type == 'docker') {
                            if (_.contains(runningServices, DockerRunner.getFqn(svc))) {
                                return DockerRunner.stop({name: repo, service: svc.service}, next);
                            }

                        } else {
                            // Assume node
                            if (_.contains(runningServices, repo)) {
                                return NodeRunner.stop({name: repo, cwd: repoPath, cmd: pkg.scripts.start}, next);
                            }
                        }
                    }
                }

            }

            next();

        }, function() {
            process.exit(0);
        });

    }

    var getRunningServices = function(next) {
        NodeRunner.list(false, function(err, nodeRunning) {
            DockerRunner.list(false, function(err, dockerRunning) {
                runningServices = _.union(nodeRunning, dockerRunning);
                next();
            })
        })
    }

    bosco.log('Stop each mircoservice ' + args);

    async.series([initialiseRunners, getRunningServices, stopRunningServices], function() {
        bosco.log('Complete');
        process.exit(0);
    })

}

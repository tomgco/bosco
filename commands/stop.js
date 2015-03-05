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

function cmd(bosco, args, next) {

    var repoPattern = bosco.options.repo;
    var repoRegex = new RegExp(repoPattern);
    var repos = bosco.getRepos();

    var initialiseRunners = function(cb) {
        var runners = [NodeRunner, DockerRunner];
        async.map(runners, function loadRunner(runner, lcb) {
            runner.init(bosco, lcb);
        }, cb);
    }

    var disconnectRunners = function(next) {
        var runners = [NodeRunner, DockerRunner];
        async.map(runners, function loadRunner(runner, cb) {
            runner.disconnect(cb);
        }, next);
    }

    var stopRunningServices = function(scb) {

        async.mapSeries(repos, function(repo, cb) {

            var pkg, svc,
                repoPath = bosco.getRepoPath(repo),
                packageJson = [repoPath, 'package.json'].join('/'),
                boscoService = [repoPath, 'bosco-service.json'].join('/');

            if (repo.match(repoRegex)) {

                if (bosco.exists(boscoService)) {
                    svc = require(boscoService);
                    if (svc.service) {
                        if (svc.service.type == 'docker') {
                            if (_.contains(runningServices, repo)) {
                                return DockerRunner.stop(svc, cb);
                            }
                        } else {
                            // Assume node
                            if (_.contains(runningServices, repo)) {
                                return NodeRunner.stop({name: repo}, cb);
                            }
                        }
                    }
                }

                if (bosco.exists(packageJson)) {
                    pkg = require(packageJson);
                    if (pkg.scripts && pkg.scripts.start) {
                        // Assume node
                        if (_.contains(runningServices, repo)) {
                            return NodeRunner.stop({name: repo}, cb);
                        }
                    }
                }
            }

            cb();

        }, function() {
            scb();
        });

    }

    var getRunningServices = function(cb) {
        NodeRunner.listRunning(false, function(err, nodeRunning) {
            DockerRunner.list(false, function(err, dockerRunning) {
                dockerRunning = _.map(_.flatten(dockerRunning), function(item) { return item.replace('/',''); });
                runningServices = _.union(nodeRunning, dockerRunning);
                cb();
            })
        })
    }

    bosco.log('Stop each microservice ' + args);

    async.series([initialiseRunners, getRunningServices, stopRunningServices, disconnectRunners], function() {
        if(next) return next(null, runningServices);
    });

}

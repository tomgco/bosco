var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var NodeRunner = require('../src/RunWrappers/Node');
var DockerRunner = require('../src/RunWrappers/Docker');
var runningServices = [];

module.exports = {
    name: 'run',
    description: 'Runs all of the microservices (or subset based on regex pattern)',
    example: 'bosco run -r <repoPattern> -t <tag>',
    cmd: cmd,
    options: [{
        option: 'tag',
        syntax: ['-t, --tag [tag]', 'Filter by a tag defined within bosco-service.json']
    }]
}

function cmd(bosco, args) {

    var repoPattern = bosco.options.repo;
    var repoRegex = new RegExp(repoPattern);
    var repoTag = bosco.options.tag;
    var repos = bosco.config.get('github:repos');

    console.log(repoTag);

    var initialiseRunners = function(next) {
        var runners = [NodeRunner, DockerRunner];
        async.map(runners, function loadRunner(runner, cb) {
            runner.init(bosco, cb);
        }, next);
    }

    var getRunConfig = function(repo) {

        var pkg, svc, basePath,
            repoPath = bosco.getRepoPath(repo),
            packageJson = [repoPath, "package.json"].join("/"),
            boscoService = [repoPath, "bosco-service.json"].join("/"),
            svcConfig = {};

        if (bosco.exists(packageJson)) {
            pkg = require(packageJson);
            svcConfig = {
                name: repo,
                cwd: repoPath
            };
            if (pkg.scripts && pkg.scripts.start) {
                svcConfig = _.extend(svcConfig, {
                    service: {
                        type: 'node',
                        start: pkg.scripts.start
                    }
                });
            }
        }

        if (bosco.exists(boscoService)) {
            var svc = require(boscoService);
            if(svc.tags) {
                svcConfig = _.extend(svcConfig, {tags: svc.tags, port: svc.service});
            }
            if (svc.service) {
                if (svc.service.type == 'docker') {
                    svcConfig = _.extend(svcConfig, {
                        service: svc.service
                    });
                } else {
                    if (svc.service.start) {
                        svcConfig = _.extend(svcConfig, {
                            service: {
                                type: 'node',
                                start: svc.service.start
                            }
                        });
                    }
                }
            }
        }

        return svcConfig;

    }

    var getRunList = function(next) {
        var runList = [];
        repos.forEach(function(repo) {
            var svcConfig = getRunConfig(repo);
            if ((!repoTag && repo.match(repoRegex)) || (repoTag && _.contains(svcConfig.tags, repoTag))) {
              if(svcConfig && svcConfig.service) runList.push(svcConfig);
            };
        });
        next(null, runList);
    }

    var startRunnableServices = function(next) {

        getRunList(function(err, runList) {
            async.mapSeries(runList, function(runConfig, cb) {
                if(runConfig.service && runConfig.service.type == 'docker') {
                    if(_.contains(runningServices, DockerRunner.getFqn(runConfig))) {
                        bosco.warn("Service " + runConfig.name.green + " is already running ...");
                        return cb();
                    }
                    return DockerRunner.start(runConfig, cb);
                }

                if(runConfig.service && runConfig.service.type == 'node') {
                    if(_.contains(runningServices, runConfig.name)) {
                        bosco.warn("Service " + runConfig.name.green + " is already running ...");
                        return cb();
                    }
                    return NodeRunner.start(runConfig, cb);
                }
                cb();
            }, function(err) {
                if (err) {
                    bosco.error(err);
                    process.exit(1);
                }
                process.exit(0);
            });
        })

    }

    var getRunningServices = function(next) {
        NodeRunner.list(false, function(err, nodeRunning) {
            DockerRunner.list(false, function(err, dockerRunning) {
                runningServices = _.union(nodeRunning, dockerRunning);
                next();
            });
        });
    }

    bosco.log("Run each mircoservice " + args);

    async.series([initialiseRunners, getRunningServices, startRunnableServices], function(err) {
        bosco.log("Complete");
        process.exit(0);
    })

}

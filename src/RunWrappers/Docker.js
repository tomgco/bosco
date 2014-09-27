var url = require('url');
var es = require('event-stream');
var _ = require('lodash');
var async = require('async');

var Docker = require('dockerode');

function Runner() {

}

Runner.prototype.init = function(bosco, next) {
    this.bosco = bosco;
    var dockerUrl = url.parse(process.env.DOCKER_HOST || 'tcp://127.0.0.1:3000');
    docker = new Docker({
        host: dockerUrl.hostname,
        port: dockerUrl.port
    });
    next();
}

Runner.prototype.list = function(detailed, next) {
    docker.listContainers({
        all: false
    }, function(err, containers) {
        if(!detailed) return next(err, _.pluck(containers, 'Image'));
        next(err, containers);
    });
}

Runner.prototype.stop = function(options, next) {
    var self = this;
    var dockerFqn = self.getFqn(options);
    docker.listContainers({
        all: false
    }, function(err, containers) {
        var toStop = [];
        containers.forEach(function(container) {
            if(container.Image == dockerFqn) {
                var cnt = docker.getContainer(container.Id);
                toStop.push(cnt);
            }
        });
        async.map(toStop, function(container, cb) {
            container.stop(cb);
        }, next);
    });
}

Runner.prototype.start = function(options, next) {

    var self = this;
    var dockerFqn = self.getFqn(options);

    locateImage(dockerFqn, function(err, image) {

        if (!image) {
            // Image not available
            pullImage(dockerFqn, function(err, image) {
                createContainer(dockerFqn, options, function(err, container) {
                    runContainer(dockerFqn, options, container, next);
                });
            });
        } else {
            createContainer(dockerFqn, options, function(err, container) {
                runContainer(dockerFqn, options, container, next);
            });
        }

    })

}

Runner.prototype.getFqn = function(options) {
    var dockerFqn = "";
    if (options.service.registry) dockerFqn += options.service.registry + "/";
    if (options.service.username) dockerFqn += options.service.username + "/";
    dockerFqn += options.service.name + ':' + (options.service.version || "latest");
    return dockerFqn;
}

function createContainer(fqn, options, next) {

    var optsCreate = {
        'Hostname': '',
        'User': '',
        'AttachStdin': false,
        'AttachStdout': false,
        'AttachStderr': false,
        'Tty': false,
        'OpenStdin': false,
        'StdinOnce': false,
        'Env': null,
        'Image': fqn
    };

    docker.createContainer(optsCreate, next);

}

function runContainer(fqn, options, container, next) {

    // We need to get the SSH port?

    var optsRun = {
        'Dns': options.service.dns || ['8.8.8.8', '8.8.4.4'],
        'PortBindings': options.service.ports,
        'Image': fqn,
        'Volumes': {},
        'VolumesFrom': ''
    };

    container.start(optsRun, function(err, data) {
        if (err) {
            console.error("Failed to start Docker image: " + err.message);
            return next(err);
        }
        console.log("Docker image: " + fqn + " now running ...");
        next();
    });

}

function pullImage(repoTag, next) {

    function handler() {
        locateImage(repoTag, function(err, image) {
            if (err) return next(err);
            next(null, image);
        });
    }

    docker.pull(repoTag, function(err, stream) {
        if (err) return next(err);
        stream.on('data', function(data) {
            var json = JSON.parse(data);
            console.log(json.status + (json.progress ? ' ' + json.progress : ''));
        })
        stream.once('end', handler);
    });

}

function locateImage(repoTag, callback) {

    docker.listImages(function(err, list) {
        if (err) return callback(err);

        // search for the image in the RepoTags
        var image;
        for (var i = 0, len = list.length; i < len; i++) {
            if (list[i].RepoTags.indexOf(repoTag) !== -1) {
                return callback(null, docker.getImage(list[i].Id));
            }
        }

        return callback();
    });
}

module.exports = new Runner;
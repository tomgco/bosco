var url = require('url');
var es = require('event-stream');
var _ = require('lodash');
var async = require('async');

var Docker = require('dockerode');

function Runner() {

}

Runner.prototype.init = function(bosco, next) {
    this.bosco = bosco;
    if(process.env.DOCKER_HOST) {
        // We are likely on OSX and Boot2docker
        var dockerUrl = url.parse(process.env.DOCKER_HOST || 'tcp://127.0.0.1:3000');
        docker = new Docker({
            host: dockerUrl.hostname,
            port: dockerUrl.port
        });
    } else {
        // Assume we are on linux and so connect on a socket
        docker = new Docker({socketPath: '/var/run/docker.sock'});
    }
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
    var createAndRun = function(err) {
        if (err) return next(err);

        createContainer(dockerFqn, options, function(err, container) {
            if (err) return next(err);

            runContainer(dockerFqn, options, container, next);
        });
    };

    locateImage(dockerFqn, function(err, image) {
        if (err || image) return createAndRun(err);

        // Image not available
        pullImage(dockerFqn, createAndRun);
    })
}

Runner.prototype.getFqn = function(options) {
    var dockerFqn = "", service = options.service;
    if (service.docker && service.docker.image) {
        dockerFqn = service.docker.image;
        if (dockerFqn.indexOf(':') === -1) {
            dockerFqn += ':latest';
        }
        return dockerFqn;
    }

    if (service.registry) dockerFqn += service.registry + "/";
    if (service.username) dockerFqn += service.username + "/";
    return dockerFqn + service.name + ':' + (service.version || "latest");
}

function createContainer(fqn, options, next) {

    var optsCreate = {
        'name': options.service.name,
        'Image': fqn,
        'Hostname': '',
        'User': '',
        'AttachStdin': false,
        'AttachStdout': false,
        'AttachStderr': false,
        'Tty': false,
        'OpenStdin': false,
        'StdinOnce': false,
        'Env': null,
        'Volumes': null
    };

    if (options.service.docker && options.service.docker.create) {
        optsCreate = _.extend(optsCreate, options.service.docker.create);
    }

    var doCreate = function(err) {
        if (err && err.statusCode !== 404) return next(err);
        docker.createContainer(optsCreate, next);
    };
    var container = docker.getContainer(optsCreate.name);
    if (container) return container.remove(doCreate);
    doCreate();
}

function runContainer(fqn, options, container, next) {

    // We need to get the SSH port?

    var optsRun = {
        'Dns': options.service.dns || ['8.8.8.8', '8.8.4.4'],
        'PortBindings': options.service.ports,
        'NetworkMode': 'bridge',
        'VolumesFrom': null
    };

    if (options.service.docker && options.service.docker.start) {
      optsRun = _.extend(optsRun, options.service.docker.start);
    }

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

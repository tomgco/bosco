var _ = require('lodash');

function createContainer(docker, fqn, options, next) {

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

    if (options.service.docker && options.service.docker.Config) {
        // For example options look in Config in: docker inspect <container_name>
        optsCreate = _.extend(optsCreate, options.service.docker.Config);
    }

    var doCreate = function(err) {
        if (err && err.statusCode !== 404) return next(err);
        docker.createContainer(optsCreate, next);
    };
    var container = docker.getContainer(optsCreate.name);
    if (container) return container.remove(doCreate);
    doCreate();
}

function locateImage(docker, repoTag, callback) {

    docker.listImages(function(err, list) {
        if (err) return callback(err);

        for (var i = 0, len = list.length; i < len; i++) {
            if (list[i].RepoTags.indexOf(repoTag) !== -1) {
                return callback(null, docker.getImage(list[i].Id));
            }
        }

        return callback();
    });
}

function startContainer(docker, fqn, options, container, next) {

    // We need to get the SSH port?
    var optsStart = {
        'NetworkMode': 'bridge',
        'VolumesFrom': null
    };

    if (options.service.docker && options.service.docker.HostConfig) {
        // For example options look in HostConfig in: docker inspect <container_name>
        optsStart = _.extend(optsStart, options.service.docker.HostConfig);
    }

    container.start(optsStart, function(err) {
        if (err) {
            console.error('Failed to start Docker image: ' + err.message);
            return next(err);
        }
        setTimeout(function() {
            console.log('Docker image: ' + fqn + ' now running ...');
            next();
        }, 5000); // Hack delay prior to a check to see if service is running based on ports
    });

}

function pullImage(docker, repoTag, next) {

    function handler() {
        locateImage(docker, repoTag, function(err, image) {
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


module.exports = {
    locateImage: locateImage,
    pullImage: pullImage,
    startContainer: startContainer,
    createContainer: createContainer
}

var _ = require('lodash');
var os = require('os');
var sf = require('sf');

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

    // Process any variables
    if(optsCreate.Cmd) processCmdVars(optsCreate);

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

function processCmdVars(options) {

    // Allow simple variable substitution in Cmds
    var processedCommands = [],
        data = {
            HOST_IP: getHostIp()
        };

    options.Cmd.forEach(function(cmd) {
        processedCommands.push(sf(cmd, data));
    });

    options.Cmd = processedCommands;
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
        var checkPort, attempts = 0;
         _.forOwn(options.service.docker.HostConfig.PortBindings, function(value) {
            if(!checkPort && value[0].HostPort) checkPort = value[0].HostPort; // Check first port
        });

        var isRunning = function() {
            attempts++;
            checkRunning(checkPort, function(err, running) {
                if(running) return next();
                if(attempts > 50) {
                    console.log('Could not detect if ' + options.name + ' had started on port ' + checkPort);
                    return next();
                }
                setTimeout(isRunning, 200);
            });
        }

        isRunning();

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

/**
 * Check to see if the process is running by making a connection and
 * seeing if it is immediately closed or stays open long enough for us to close it.
 */
function checkRunning(port, next) {
    var net = require('net');
    var socket = net.createConnection(port);
    var start = new Date();
    socket.on('connect', function() {
        setTimeout(function() { socket.end() }, 100);
    });
    socket.on('close', function() {
        var closed = new Date() - start;
        next(null, closed > 50 ? true : false);
    });
    socket.on('error', function() {
        next(new Error('Failed to connect'), false);
    });
}

function getHostIp() {

    var ip = _.chain(os.networkInterfaces())
              .values()
              .flatten()
              .filter(function(val) {
                return (val.family === 'IPv4' && val.internal === false)
              })
              .pluck('address')
              .first()
              .value();

    return ip;

}

module.exports = {
    locateImage: locateImage,
    pullImage: pullImage,
    startContainer: startContainer,
    createContainer: createContainer
}

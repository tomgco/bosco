'use strict';

var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

module.exports = function(bosco) {
    function doBuild(service, options, next) {
        if(!service.build) return next(null, false);

        var watchBuilds = options.watchBuilds,
            command = service.build.command,
            cwd = {cwd: service.repoPath};

        var buildFinished = function(err, stdout, stderr) {
            var log = 'Finished build command for ' + service.name.blue;
            if (err || stderr) {
                log += ':';
            }

            bosco.log(log);
            if (err || stderr) {
              if (stdout) console.log(stdout);
              if (stderr) bosco.error(stderr);
            }

            next(null, true);
        };

        if (!watchBuilds || !service.name.match(options.watchRegex)) {
            bosco.log('Running build command for ' + service.name.blue + ': ' + command);
            return exec(command, cwd, buildFinished);
        }

        if (options.reloadOnly) {
            return bosco.warn('Not spawning watch command for ' + service.name.blue + ': change is triggered by external build tool');
        }

        if (service.build.watch) command = service.build.watch.command;

        bosco.log('Spawning ' + 'watch'.red + ' command for ' + service.name.blue + ': ' + command);

        var args = command.split(' ');
        command = args.shift();
        var wc = spawn(command, args, cwd);
        var readyText = service.build.watch.ready || 'finished';
        var output = '', hadError = false, calledReady = false;
        var checkDelay = 500; // delay before checking for any stdout
        var timeout = checkDelay * 50; // Seems reasonable for build cycle
        var timer = 0;

        buildFinished = (function(buildFinished) {
            return function() {
                clearTimeout(checkFinished);
                calledReady = true;
                output = '';
                buildFinished.apply(this, arguments);
            };
        })(buildFinished);

        wc.on('exit', function(code) {
            bosco.error('Watch'.red + ' command for ' + service.name.blue + ' died with code ' + code);
        });

        wc.stdout.on('data', function(data) {
            if (!calledReady) {
                output += data.toString();
            }
        });

        wc.stderr.on('data', function(data) {
            hadError = true;
            if (calledReady) {
                bosco.error('Watch'.red + ' command for ' + service.name.blue + ' stderr:\n' + data.toString());
            } else {
                output += data.toString();
            }
        });

        var checkFinished = function() {
            if (calledReady) return;

            if (output.indexOf(readyText) >= 0) {
                return buildFinished(hadError, output);
            }

            timer = timer + checkDelay;
            if (timer < timeout) return setTimeout(checkFinished, checkDelay);

            bosco.error('Build timed out beyond ' + timeout/1000 + ' seconds, likely an issue with the project build - you may need to check locally. Was looking for: ' + readyText);
            console.error(output);
        };

        checkFinished();
    }

    return {
        doBuild: doBuild
    }
}

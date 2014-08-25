
var _ = require('lodash');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var AssetHelper = require('./AssetHelper');

module.exports = {
	doBuild: doBuild
}

function doBuild(bosco, build, watchBuilds, reloadOnly, tagFilter, next) {

    var command = watchBuilds ? (build.watch ? build.watch.command : build.command) : build.command;
    command = reloadOnly ? "echo 'Not running build as change triggered by external build tool'" : command;

    var buildFinished = function(err, stdout, stderr) {

        if (err) {
            bosco.error(stderr);
        }

        console.log(stdout);

        var assetKey, staticAssets = {},
            assetHelper = AssetHelper.getAssetHelper(bosco, build, tagFilter);

        // Now go and get the static assets
        if (build.output && build.output.js) {
            _.forOwn(build.output.js, function(value, tag) {
                if (value) {
                    value.forEach(function(asset) {
                        assetKey = build.name + "/" + asset;
                        assetHelper.addAsset(staticAssets, assetKey, asset, tag, 'js');
                    });
                }
            });
        }

        if (build.output && build.output.css) {
            _.forOwn(build.output.css, function(value, tag) {
                if (value) {
                    value.forEach(function(asset) {
                        assetKey = build.name + "/" + asset;
                        assetHelper.addAsset(staticAssets, assetKey, asset, tag, 'css');
                    });
                }
            });
        }

        next(null, staticAssets);

    }

    if (watchBuilds) {

        bosco.log("Spawning watch command for " + build.name.blue + ": " + command);

        var cmdArray = command.split(" ");
        var command = cmdArray.shift();
        var wc = spawn(command, cmdArray, {
            cwd: build.repoPath
        });
        var finishedText = build.watch.finished || 'finished';
        var stdout = "", stderr = "",
            calledReady = false;
        var checkDelay = 2000; // Seems reasonable for build check cycle	

        wc.stdout.on('data', function(data) {
            stdout += data.toString();
        });

        wc.stderr.on('data', function(data) {
            stderr += data.toString();
        });

        var checkFinished = function() {
            if (stdout.indexOf(finishedText) >= 0 && !calledReady) {
                calledReady = true;
                setTimeout(function() {
                    buildFinished(null, stdout, null);
                }, checkDelay);
            } else if (stderr.indexOf('Error:') >= 0 && !calledReady) {
            	calledReady = true;
                buildFinished(stderr);
            } else {
                setTimeout(checkFinished, checkDelay);
            }
        }

        checkFinished();

    } else {

        bosco.log("Running build command for " + build.name.blue + ": " + command);
        exec(command, {
            cwd: build.repoPath
        }, buildFinished);

    }

}
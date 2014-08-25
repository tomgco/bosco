var _ = require('lodash');
var exec = require('child_process').exec;
var async = require('async');

module.exports = {
	getLastCommitForAssets: getLastCommitForAssets
}

function getLastCommitForAssets(bosco, staticAssets, next) {
    var files = [];
    _.forOwn(staticAssets, function(value, key) {
        files.push({
            key: key,
            repoPath: value.repoPath,
            relativePath: value.relativePath
        });
    });
    async.map(files, function(file, cb) { getCommit(bosco, file, cb) }, function(err, results) {
        results.forEach(function(value) {
            staticAssets[value.key].commit = value.commit;
        });
        next(null, staticAssets);
    });
}


function getCommit(bosco, file, next) {
    var gitCmd = 'git log -n1 --oneline ' + file.relativePath;
    exec(gitCmd, {
        cwd: file.repoPath
    }, function(err, stdout, stderr) {
        if (err) {
            bosco.error(stderr);
        }
        next(err, {
            key: file.key,
            path: file.path,
            commit: stdout
        });
    });
}

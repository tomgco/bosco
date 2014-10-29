var async = require('async');

module.exports = {
    name:'rstart',
    description:'Runs stop and then run with the same parameters - aka restart ;)',
    example:'bosco restart -r <repoPattern> -t <tag>',
    cmd:cmd
}

function cmd(bosco, args) {

    var stop = require('./stop');
    var run = require('./run');

    var executeStop = function(next) {
        stop.cmd(bosco, args, next);
    };

    var executeRun = function(next) {
        run.cmd(bosco, args, next);
    };

    async.series([executeStop, executeRun], function(){
        // Done
    });

}


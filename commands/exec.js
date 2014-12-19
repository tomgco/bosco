var ch = require('../src/CmdHelper');
var _ = require('lodash');

module.exports = {
    name:'exec',
    description:'Runs arbitrary commands across all services - take care!',
    example:'bosco exec -r <repoRegex> -- <command>',
    cmd:cmd
}

function cmd(bosco, args) {

    var command = args[0],
        cmdArgs = _.rest(args);

    bosco.log('Running "' + args.join(' ').green + '" across all matching repos ...');

    var options = ch.createOptions(bosco, {
        cmd: command,
        args: cmdArgs,
        stdoutStreamFn: function(buffer) {
            process.stdout.write(buffer.toString());
        }
    });

    ch.iterate(bosco, options, function() {
        bosco.log('Complete');
    });

}

var ch = require('../src/CmdHelper');

module.exports = {
    name:'exec',
    description:'Runs arbitrary commands across all services - take care!',
    example:'bosco exec -r <repoRegex> -- <command>',
    cmd:cmd
}

function cmd(bosco, args) {

    var execCommand = args.join(' ');
    bosco.log('Running "' + execCommand.green + '" across all matching repos ...');

    var options = ch.createOptions(bosco, {
        cmd: execCommand
    });

    ch.iterate(bosco, options, function() {
        bosco.log('Complete');
    });

}

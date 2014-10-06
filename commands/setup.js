
module.exports = {
    name:'setup',
    description:'Runs clone and then install to get your environment ready for action.',
    example:'bosco setup',
    cmd:cmd
}

function cmd(bosco, args) {

    var clone = require('./clone');
    var install = require('./install');

    clone.cmd(bosco, args, function() {
        install.cmd(bosco, args);
    });
}

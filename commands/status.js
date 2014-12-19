var ch = require('../src/CmdHelper');

module.exports = {
    name:'status',
    description:'Checks git status across all services',
    example:'bosco status -r <repoPattern>',
    cmd:cmd
}

function cmd(bosco) {

    bosco.log('Running git status across all matching repos ...');

    var options = ch.createOptions(bosco, {
        cmd: 'git',
        args: ['status'],
        guardFn: function(bosco, repoPath, options, next) {
            if(!bosco.exists([repoPath,'.git'].join('/'))) {
                return next(new Error('Doesn\'t seem to be a git repo: '+ repoPath.blue));
            } else {
                next();
            }
        },
        stdoutFn: function(stdout, path) {
            if(stdout) {
                if(stdout.indexOf('Changes not staged') > 0) {
                    bosco.log(stdout);
                } else if(stdout.indexOf('Your branch is ahead') > 0) {
                    bosco.log(path.blue + ':\n' + stdout);
                } else {
                    bosco.log(path.blue + ': ' + 'OK'.green);
                }
            }
        }
    });

    ch.iterate(bosco, options, function() {
        bosco.log('Complete');
    });

}

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
        args: ['-c', 'color.status=always', 'status'],
        guardFn: function(bosco, repoPath, options, next) {
            if(bosco.exists([repoPath,'.git'].join('/'))) return next();
            next(new Error('Doesn\'t seem to be a git repo: '+ repoPath.blue));
        },
        stdoutFn: function(stdout, path) {
            if(stdout && (stdout.indexOf('Changes not staged') >= 0 ||
                    stdout.indexOf('Your branch is ahead') >= 0)) {
                bosco.log(path.blue + ':\n' + stdout);
            }
        }
    });

    ch.iterate(bosco, options, function() {
        bosco.log('Complete');
    });
}

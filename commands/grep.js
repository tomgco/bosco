var async = require('async');
var exec = require('child_process').exec;

module.exports = {
  name:'grep',
  description:'Finds a pattern across your repos excluding the node_modules folder',
  example: 'bosco grep <patternToSearch>',
  cmd:cmd
}

function cmd(bosco, args, next) {

  var repoPattern = bosco.options.repo;
  var repoRegex = new RegExp(repoPattern);
  var pattern = args.shift(0);

  if (!pattern) return bosco.error('A search pattern is required for the grep command');

  var repos = bosco.config.get('github:repos');
  if(!repos) return bosco.error('You are repo-less :( You need to initialise bosco first, try \'bosco clone\'.');

  bosco.log('Running grep across all repos...');

  var grepRepos = function(callback) {

    async.mapLimit(repos, bosco.options.cpus, function(repo, grepCallback) {

      if(!repo.match(repoRegex)) return grepCallback();

      var repoPath = bosco.getRepoPath(repo);

      grepRepo(bosco, args, pattern, repo, repoPath, grepCallback);

    }, callback);

  };

  grepRepos(function(err, results) {
    if(next) next(err, results);
  });

}

var grepRepo = function(bosco, args, pattern, repo, repoPath, callback) {

  var grepCommand = 'git grep --color=always -n \'' + pattern + '\' ' + args.join(' ');

  exec(grepCommand, {
    cwd: repoPath
  }, function(err, stdout, stderr) {
    if(err) return callback(stderr);

    var result = null;

    if (stdout) {
      bosco.log(repo.blue + ':\n' + stdout);
      result = {
        repo: repo,
        grep: stdout
      }
    }

    callback(null, result);

  });
}

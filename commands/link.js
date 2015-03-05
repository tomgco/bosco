var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var async = require('async');
var exec = require('child_process').exec;

module.exports = {
    name: 'link',
    description: 'Automatically npm links any project in a workspace with any other project that depends on it',
    example: 'bosco link',
    cmd: cmd
}

function cmd(bosco, args, next) {

    var repos = bosco.getRepos(),
        dependencies = [],
        dependencyGraph = {};

    repos.forEach(function(repo) {
        var repoPkg = path.resolve(bosco.getRepoPath(repo),'package.json');
        if(bosco.exists(repoPkg)) {
            var pkg = require(repoPkg);
            dependencyGraph[repo] = _.union(_.keys(pkg.dependencies), _.keys(pkg.devDependencies));
            dependencies = _.union(dependencies, dependencyGraph[repo]);
        }
    });

    var modules = _.intersection(repos, dependencies),
        toLink = _.clone(modules),
        globalRoot = '';

    var getGlobalFolder = function(next) {
        execCmd(bosco, 'npm root -g', '.', function(err, stdout) {
            globalRoot = stdout.replace('\n','');
            next();
        });
    }

    // Check if modules are already 'npm link' first to speed it up
    var checkModules = function(next) {
        async.map(toLink, checkModule, next);
    }

    var checkModule = function(module, next) {
        var globalModulePath = path.join(globalRoot, module);
        if(bosco.exists(globalModulePath)) {
            toLink = _.pull(toLink, module);
        }
        next();
    }

    // Globally link module - must be series due to npm locking
    var linkModules = function(next) {
        async.mapSeries(toLink, linkModule, next);
    }

    var linkModule = function(module, next) {
        execCmd(bosco, 'npm link', bosco.getRepoPath(module), next);
    }

    // Check if modules are already 'npm link module' into a repo first to speed it up
    var checkModuleRepos = function(next) {
        async.map(repos, checkModuleRepo, next);
    }

    var checkModuleRepo = function(repo, next) {
        var toLinkInRepo = _.intersection(modules, dependencyGraph[repo]),
            repoPath = bosco.getRepoPath(repo);
        async.map(toLinkInRepo, function(module, cb) {
            var checkPath = path.join(repoPath, 'node_modules', module);
            var globalModulePath = path.join(globalRoot, module);
            fs.readlink(checkPath, function(err, link) {
              if(err) { return cb(); }
              if(path.resolve(repoPath,'node_modules', link) === globalModulePath) {
                dependencyGraph[repo] = _.pull(dependencyGraph[repo], module);
              }
              cb();
            });
        }, next);
    };

    // Link module into repo
    var linkModulesToRepos = function(next) {
        async.mapSeries(repos, linkModulesToRepo, next);
    }

    var linkModulesToRepo = function(repo, next) {
        var toLinkInRepo = _.intersection(modules, dependencyGraph[repo]);
        if(toLinkInRepo.length) {
            bosco.log('Linking ' + (toLinkInRepo.length + '').cyan + ' modules to ' + repo.green)
        }
        async.mapLimit(toLinkInRepo, bosco.concurrency.cpu, function(module, cb) {
            execCmd(bosco, 'npm link ' + module, bosco.getRepoPath(repo), cb);
        }, next);
    }

    bosco.log('Auto linking modules together ...')

    async.series([
        getGlobalFolder,
        checkModules,
        linkModules,
        checkModuleRepos,
        linkModulesToRepos
    ], function() {
        bosco.log('Completed linking modules.');
        if(next) { next(); }
    })

}

function execCmd(bosco, cmd, repoPath, next) {
    bosco.log(repoPath.blue + ': Running ' + cmd.green + ' ...');
    exec(cmd, {
      cwd: repoPath
    }, function(err, stdout) {
        next(err, stdout);
    });
}

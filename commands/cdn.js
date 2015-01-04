var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var http = require('http');
var watch = require('watch');
var sass = require('node-sass');

module.exports = {
    name:'cdn',
    description:'Aggregates all the static assets across all microservices and serves them via a pseudo local CDN url',
    example:'bosco cdn <minify>',
    cmd:cmd,
    options: [{
        option: 'tag',
        syntax: ['-t, --tag [tag]', 'Filter by a tag defined within bosco-service.json']
    },
    {
        option: 'watch',
        syntax: ['-w, --watch [regex]', 'Filter by a regex of services to watch (similar to -r in run)']
    }]
}

function cmd(bosco, args) {

    var minify = _.contains(args,'minify');
    var port = bosco.config.get('cdn:port') || 7334;
    var repoPattern = bosco.options.watch || '$^';
    var repoRegex = new RegExp(repoPattern);
    var repoTag = bosco.options.tag;

    bosco.log('Starting pseudo CDN on port: ' + (port+'').blue);

    var repos = bosco.config.get('github:repos');
    if(!repos) return bosco.error('You are repo-less :( You need to initialise bosco first, try \'bosco clone\'.');

    var startServer = function(staticAssets, staticRepos, serverPort) {

        var server = http.createServer(function(request, response) {

            var url = request.url.replace('/','');

            if(staticAssets[url]) {
                var asset = staticAssets[url];
                response.writeHead(200, {
                    'Content-Type': asset.mimeType,
                    'Cache-Control': 'no-cache, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': 'Sat, 21 May 1952 00:00:00 GMT'
                });

                getContent(staticAssets[url], function(err, content) {
                    if(err) {
                        response.writeHead(500, {'Content-Type': 'text/html'});
                        response.end('<h2>There was an error: ' + err.message + '</h2>');
                    } else {
                        response.end(content);
                    }
                });

          } else {
              if (request.url == '/repos') {
                  response.writeHead(200, {'Content-Type': 'text/html'});
                  return response.end(staticRepos.formattedRepos);
              }
              response.writeHead(404, {'Content-Type': 'text/html'});
              response.end(staticAssets.formattedAssets);
          }
        });

        server.listen(serverPort);
        bosco.log('Server is listening on ' + serverPort);

    }

    var startMonitor = function(staticAssets) {

      var watchSet = {};
      _.forOwn(staticAssets, function(asset, key) {
          if(asset.repo && !asset.repo.match(repoRegex)) {
            return;
          }
          if(!minify) {
            if(asset.path) {  watchSet[asset.path] = key; }
            return;
          }
          if(asset.extname == '.manifest') {
              var manifestFiles = asset.files;
              manifestFiles.forEach(function(file) {
                  if(file) { watchSet[file.path] = asset.tag; }
              });
          }
      });

      var filterFn = function(f, stat) {
        return f.match(repoRegex) && stat.isDirectory() || watchSet[f];
      }

      watch.createMonitor(bosco.getOrgPath(), {filter: filterFn, ignoreDotFiles: true, ignoreUnreadableDir: true, ignoreDirectoryPattern: /node_modules|\.git|coverage|dist/, interval: 1000}, function (monitor) {

        bosco.log('Watching '+ _.keys(monitor.files).length + ' files ...');
        var reloading = false;

        monitor.on('changed', function (f) {

          if(reloading) return; reloading = true; // Ensure only ever doing this once

          var fileKey = watchSet[f];

          if(!minify) {
              if(fileKey) {
                  fs.readFile(staticAssets[fileKey].path, function (err, data) {
                      if (err) {
                          bosco.log('Error reloading '+fileKey);
                          bosco.log(err.toString());
                          return;
                      }

                      staticAssets[fileKey].data = data;
                      staticAssets[fileKey].content = data.toString();
                      bosco.log('Reloaded ' + fileKey);
                      reloading = false;
                  });
              }
          } else {
              if(fileKey) {
                  bosco.log('Recompiling tag ' + fileKey.blue + ' due to change in ' + f.blue);
                  var options = {
                    repos: repos,
                    minify: minify,
                    buildNumber: 'local',
                    tagFilter: fileKey,
                    watchBuilds: false,
                    reloadOnly: true
                  }
                  bosco.staticUtils.getStaticAssets(options, function(err, updatedAssets) {
                      // Clear old for tag
                      _.forOwn(staticAssets, function(value, key) {
                          if(value.tag == fileKey) delete staticAssets[key];
                      });
                      // Add new
                      _.forOwn(updatedAssets, function(value, key) {
                          staticAssets[key] = value;
                      });
                      bosco.log('Reloaded minified assets for tag ' + fileKey.blue);
                      reloading = false;
                  });
              }
          }
        })
      });

    }

    var getContent = function(asset, next) {
        if(asset.extname == '.scss') {
            sass.render(asset.content, next);
        } else {
            next(null, asset.data || asset.content);
        }
    }

    if(minify) bosco.log('Minifying front end assets, this can take some time ...');

    var options = {
        repos: repos,
        buildNumber: 'local',
        minify: minify,
        tagFilter: null,
        watchBuilds: true,
        reloadOnly: false,
        repoRegex: repoRegex,
        repoTag: repoTag
    }

    var executeAsync = {
        staticAssets: bosco.staticUtils.getStaticAssets.bind(null, options),
        staticRepos: bosco.staticUtils.getStaticRepos.bind(null, options)
    }

    async.parallel(executeAsync, function(err, results){
        startServer(results.staticAssets, results.staticRepos, port);
        startMonitor(results.staticAssets);
    });

}

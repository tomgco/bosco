'use strict';

var expect = require("expect.js");
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var StaticUtils = require('../src/StaticUtils');

var repos = ["project1","project2"];


var boscoMock = function() {

  return {
      log: function(msg) { this._log = this._log || []; this._log.push(msg) },
      error: function(msg) { this._error = this._error || []; this._error.push(msg) },
      warn: function(msg) { this._warn = this._warn || []; this._warn.push(msg) },
      options: {
          environment:'test'
      },
      getRepoPath: function(repo) {
          return __dirname + "/TestOrganisation/" + repo
      },
      getAssetCdnUrl: function (asset) {
          return 'http://my-awesome-cdn.example.com/' + asset;
      },
      exists: function(file) {
          return fs.existsSync(file);
      },
      config: {
          get: function(key) {
              if(key == 'css:clean') {
                return {enabled: true};
              }
              return key;
          }
      }
  }

}


describe("Bosco Static Asset Handling", function() {

    this.timeout(10000);
    this.slow(5000);

    it('should load static assets in un-minified cdn mode, deduping where necessary', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: false,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var localBosco = boscoMock()
        var utils = StaticUtils(localBosco);

        utils.getStaticAssets(options, function(err, assets) {

            expect(localBosco._warn).to.contain("Skipping duplicate file: project1/js/bottom1.js <> project2/js/bottom2dupe.js");
            expect(localBosco._warn).to.contain("Duplicate library with different version: project1/js/jquery-1.11.0-min.js <> project2/js/jquery-1.12.0-min.js");

            expect(assets).to.have.keys('html/top.js.html',
                                    'html/bottom.js.html',
                                    'html/top.css.html',
                                    'project1/js/top1.js',
                                    'project2/js/bottom2.js',
                                    'project2/js/top2.js',
                                    'project2/img/bab.jpg',
                                    'project2/swf/flash.swf',
                                    'project2/css/top2.scss');
            done();

        });

    });

     it('should load static assets in minified cdn mode, deduping where necessary', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }
        var localBosco = boscoMock()
        var utils = StaticUtils(localBosco);
        utils.getStaticAssets(options, function(err, assets) {

            expect(localBosco._warn).to.contain("Skipping duplicate file: project1/js/bottom1.js <> project2/js/bottom2dupe.js");
            expect(localBosco._warn).to.contain("Duplicate library with different version: project1/js/jquery-1.11.0-min.js <> project2/js/jquery-1.12.0-min.js");

            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('html/bottom.js.html');
            expect(assetKeys).to.contain('html/top.js.html');
            expect(assetKeys).to.contain('html/top.css.html');
            expect(assetKeys).to.contain('project2/img/bab.jpg');
            expect(assetKeys).to.contain('project2/html/html1.html');
            expect(assetKeys).to.contain('project2/html/html2.html');
            expect(assetKeys).to.contain('project2/swf/flash.swf');
            expect(assetKeys).to.contain('js/bottom.js.map');
            expect(assetKeys).to.contain('js/bottom.f1fb2d8.js');
            expect(assetKeys).to.contain('js/top.js.map');
            expect(assetKeys).to.contain('js/top.9788b8b.js');
            expect(assetKeys).to.contain('css/top.b1c537b.css');
            expect(assetKeys).to.contain('manifest/bottom.js.txt');
            expect(assetKeys).to.contain('manifest/top.js.txt');
            expect(assetKeys).to.contain('manifest/top.css.txt');

            done();

        });

    });

   it('should load static assets in minified cdn mode, filtering by tag if specified', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('html/top.js.html',
                                      'html/top.css.html',
                                      'js/top.js.map',
                                      'js/top.77917b1.js',
                                      'css/top.b1c537b.css',
                                      'manifest/top.js.txt',
                                      'manifest/top.css.txt' );
            done();

        });

    });

    it('should not parse sass templates when not minifying as this is done in cdn command to allow live reload', function(done) {

        var options = {
            repos: ["project2"],
            minify: false,
            tagFilter: 'top',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('project2/css/top2.scss');
            expect(assets['project2/css/top2.scss'].content.toString()).to.not.contain('#main{width:5em}')
            done();

        });

    });

   it('should parse sass templates when minifying', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(Object.keys(assets)).to.have.contain('css/top.b1c537b.css');
            expect(assets['css/top.b1c537b.css'].content.toString()).to.contain('#main{width:5em}')
            done();

        });

    });

  it('should create a manifest when minified that will have all of the files', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('manifest/top.js.txt');
            expect(assets['manifest/top.js.txt'].content.toString()).to.contain('project1/public/js/top1.js');
            expect(assets['manifest/top.js.txt'].content.toString()).to.contain('project2/public/js/top2.js');
            expect(assets['manifest/top.js.txt'].content.toString()).to.contain('project2/public/js/jquery-1.12.0-min.js');
            done();

        });

    });

    it('manifest should contain all specified html files', function(done) {

          var options = {
              repos: ["project2"],
              minify: true,
              tagFilter: 'upload',
              watchBuilds: false,
              reloadOnly: false
          }

          var utils = StaticUtils(boscoMock());

          utils.getStaticAssets(options, function(err, assets) {

              var manifest = assets['manifest/upload.html.txt'].content.toString();

              expect(assets).to.have.keys('manifest/upload.html.txt');
              expect(manifest).to.contain('project2/public/html/html1.html');
              expect(manifest).to.contain('project2/public/html/html2.html');
              done();

          });

    });

  it('should create a source map when minifying javascript', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {
            expect(assets).to.have.keys('js/top.js.map');
            expect(assets['js/top.77917b1.js'].content.toString()).to.contain('//# sourceMappingURL=top.js.map');
            done();

        });

    });

   it('should create a formatted repo list when requested for cdn mode', function(done) {

        var options = {
            repos: ["project1","project2","project3"],
            minify: true,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticRepos(options, function(err, assets) {

            expect(assets).to.have.keys('formattedRepos');
            done();

        });

    });

});

describe("Bosco Static Asset Handling - Custom Building", function() {

  this.timeout(5000);
  this.slow(5000);

  it('should execute bespoke build commands and use output', function(done) {

        var options = {
            repos: ["project3"],
            minify: true,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('html/compiled.js.html',
                                    'html/compiled.css.html',
                                    'js/compiled.js.map',
                                    'js/compiled.12915d7.js',
                                    'css/compiled.bfbcf06.css',
                                    'manifest/compiled.js.txt',
                                    'manifest/compiled.css.txt');

            done();

        });

    });

  it('should execute bespoke build commands and use output, and execute the watch command in watch mode', function(done) {

        var options = {
            repos: ["project3"],
            minify: true,
            tagFilter: null,
            watchBuilds: true,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('html/compiled.js.html',
                                    'html/compiled.css.html',
                                    'js/compiled.js.map',
                                    'js/compiled.12915d7.js',
                                    'css/compiled.bfbcf06.css',
                                    'manifest/compiled.js.txt',
                                    'manifest/compiled.css.txt');
            done();

        });

    });

it('should execute bespoke build commands and use output, and execute the watch command in watch mode and not minified', function(done) {

        this.timeout(5000);

        var options = {
            repos: ["project3"],
            minify: false,
            tagFilter: null,
            watchBuilds: true,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('html/compiled.js.html',
                                  'html/compiled.css.html',
                                  'project3/js/compiled.js',
                                  'project3/css/compiled.css');
            done();

        });

    });

});

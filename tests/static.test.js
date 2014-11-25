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
            buildNumber: 'local',
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var localBosco = boscoMock()
        var utils = StaticUtils(localBosco);

        utils.getStaticAssets(options, function(err, assets) {

            expect(localBosco._warn).to.contain("Skipping duplicate file: project1/js/bottom1.js <> project2/js/bottom2dupe.js");
            expect(localBosco._warn).to.contain("Duplicate library with different version: project1/js/jquery-1.11.0-min.js <> project2/js/jquery-1.12.0-min.js");

            expect(assets).to.have.keys('project1/local/html/bottom.js.html',
                'project1/local/html/top.js.html',
                'project2/local/html/bottom.js.html',
                'project2/local/html/top.js.html',
                'project2/local/html/top.css.html',
                'project1/js/bottom1.js',
                'project1/js/jquery-1.11.0-min.js',
                'project1/js/top1.js',
                'project2/js/bottom2.js',
                'project2/js/top2.js',
                'project2/css/top2.scss',
                'project2/img/bab.jpg',
                'project2/html/html1.html',
                'project2/html/html2.html',
                'project2/swf/flash.swf');

            done();

        });

    });

     it('should load static assets in minified cdn mode, deduping where necessary', function(done) {

        var options = {
            repos: ["project1","project2"],
            buildNumber: 'local',
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

            expect(assets).to.have.keys('project1/local/html/bottom.js.html',
              'project1/local/html/top.js.html',
              'project1/local/manifest/bottom.js.txt',
              'project1/local/manifest/top.js.txt',
              'project1/local/js/bottom.js.map',
              'project1/local/js/bottom.bcf91bb.js',
              'project1/local/js/top.js.map',
              'project1/local/js/top.71900f7.js');

            expect(assets).to.have.keys('project2/local/html/bottom.js.html',
              'project2/local/html/top.js.html',
              'project2/local/html/top.css.html',
              'project2/local/manifest/bottom.js.txt',
              'project2/local/manifest/top.js.txt',
              'project2/local/manifest/top.css.txt',
              'project2/local/manifest/top.img.txt',
              'project2/local/manifest/upload.html.txt',
              'project2/local/manifest/top.swf.txt',
              'project2/local/js/bottom.js.map',
              'project2/local/js/bottom.73c6205.js',
              'project2/local/js/top.js.map',
              'project2/local/js/top.b9b5b9c.js',
              'project2/local/css/top.b1c537b.css',
              'project2/local/img/bab.jpg',
              'project2/local/swf/flash.swf',
              'project2/local/html/html1.html',
              'project2/local/html/html2.html');

            done();

        });

    });

   it('should load static assets in minified cdn mode, filtering by tag if specified', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('project1/local/html/top.js.html',
                'project2/local/html/top.js.html',
                'project2/local/html/top.css.html',
                'project1/local/manifest/top.js.txt',
                'project2/local/manifest/top.js.txt',
                'project2/local/manifest/top.css.txt',
                'project2/local/manifest/top.img.txt',
                'project2/local/manifest/top.swf.txt',
                'project1/local/js/top.js.map',
                'project1/local/js/top.71900f7.js',
                'project2/local/js/top.js.map',
                'project2/local/js/top.dc0f5f1.js',
                'project2/local/css/top.b1c537b.css',
                'project2/local/img/bab.jpg',
                'project2/local/swf/flash.swf' );

            done();

        });

    });

    it('should not parse sass templates when not minifying as this is done in cdn command to allow live reload', function(done) {

        var options = {
            repos: ["project2"],
            minify: false,
            tagFilter: 'top',
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('project2/css/top2.scss');
            expect(assets['project2/css/top2.scss'].content.toString()).to.not.contain('#main{width:5em}')
            done();

        });

    });

   it('should parse sass templates when minifying', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            expect(Object.keys(assets)).to.contain('project2/local/css/top.b1c537b.css');
            expect(assets['project2/local/css/top.b1c537b.css'].content.toString()).to.contain('#main{width:5em}')
            done();

        });

    });

  it('should create a manifest when minified that will have all of the files', function(done) {

        var options = {
            repos: ["project1","project2"],
            minify: true,
            tagFilter: 'top',
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {

            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('project1/local/manifest/top.js.txt','project2/local/manifest/top.js.txt');
            expect(assets['project1/local/manifest/top.js.txt'].content.toString()).to.contain('project1/public/js/top1.js');
            expect(assets['project2/local/manifest/top.js.txt'].content.toString()).to.contain('project2/public/js/top2.js');
            expect(assets['project2/local/manifest/top.js.txt'].content.toString()).to.contain('project2/public/js/jquery-1.12.0-min.js');
            done();

        });

    });

    it('manifest should contain all specified html files', function(done) {

          var options = {
              repos: ["project2"],
              minify: true,
              tagFilter: 'upload',
              buildNumber: 'local',
              watchBuilds: false,
              reloadOnly: false
          }

          var utils = StaticUtils(boscoMock());

          utils.getStaticAssets(options, function(err, assets) {

              var manifest = assets['project2/local/manifest/upload.html.txt'].content.toString();
              var assetKeys = Object.keys(assets);
              expect(assetKeys).to.contain('project2/local/manifest/upload.html.txt');
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
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {
            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('project1/local/js/top.js.map','project2/local/js/top.js.map');
            expect(assets['project1/local/js/top.71900f7.js'].content.toString()).to.contain('//# sourceMappingURL=top.js.map');
            expect(assets['project2/local/js/top.dc0f5f1.js'].content.toString()).to.contain('//# sourceMappingURL=top.js.map');
            done();

        });

    });

   it('should create a formatted repo list when requested for cdn mode', function(done) {

        var options = {
            repos: ["project1","project2","project3"],
            minify: true,
            tagFilter: null,
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticRepos(options, function(err, assets) {
            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('formattedRepos');
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
            buildNumber: 'local',
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {
            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('project3/local/html/compiled.js.html',
                                    'project3/local/html/compiled.css.html',
                                    'project3/local/js/compiled.js.map',
                                    'project3/local/js/compiled.12915d7.js',
                                    'project3/local/css/compiled.bfbcf06.css',
                                    'project3/local/manifest/compiled.js.txt',
                                    'project3/local/manifest/compiled.css.txt');

            done();

        });

    });

  it('should execute bespoke build commands and use output, and execute the watch command in watch mode', function(done) {

        var options = {
            repos: ["project3"],
            minify: true,
            tagFilter: null,
            buildNumber: 'local',
            watchBuilds: true,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {
            var assetKeys = Object.keys(assets);
            expect(assetKeys).to.contain('project3/local/html/compiled.js.html',
                                    'project3/local/html/compiled.css.html',
                                    'project3/local/js/compiled.js.map',
                                    'project3/local/js/compiled.12915d7.js',
                                    'project3/local/css/compiled.bfbcf06.css',
                                    'project3/local/manifest/compiled.js.txt',
                                    'project3/local/manifest/compiled.css.txt');
            done();

        });

    });

it('should execute bespoke build commands and use output, and execute the watch command in watch mode and not minified', function(done) {

        this.timeout(5000);

        var options = {
            repos: ["project3"],
            minify: false,
            tagFilter: null,
            buildNumber: 'local',
            watchBuilds: true,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock());

        utils.getStaticAssets(options, function(err, assets) {
            var assetKeys = Object.keys(assets);
            expect(assets).to.have.keys('project3/local/html/compiled.js.html',
                                  'project3/local/html/compiled.css.html',
                                  'project3/js/compiled.js',
                                  'project3/css/compiled.css');
            done();

        });

    });

});

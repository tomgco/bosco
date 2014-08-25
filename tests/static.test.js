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
      exists: function(file) {
          return fs.existsSync(file);
      },
      config: {
          get: function(key) {
              return key;
          }
      }
  }

}


describe("Bosco Static Asset Handling", function() {

    this.timeout(5000);
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

            expect(assets).to.have.keys('test/html/top.js.html',
                                    'test/html/bottom.js.html',
                                    'test/html/top.css.html',
                                    'project1/js/top1.js',
                                    'project2/js/bottom2.js',
                                    'project2/js/top2.js',
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

            expect(assets).to.have.keys('test/html/top.js.html',
                                      'test/html/bottom.js.html',
                                      'test/html/top.css.html',
                                      'test/js/top.js.map',
                                      'test/js/top.9788b8bac1.js',
                                      'test/js/bottom.js.map',
                                      'test/js/bottom.8007be235b.js',
                                      'test/css/top.ca7986a9bb.css',
                                      'test/manifest/top.js.txt',
                                      'test/manifest/bottom.js.txt',
                                      'test/manifest/top.css.txt' );
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

            expect(assets).to.have.keys('test/html/top.js.html',
                                      'test/html/top.css.html',
                                      'test/js/top.js.map',
                                      'test/js/top.5892df4693.js',
                                      'test/css/top.ca7986a9bb.css',
                                      'test/manifest/top.js.txt',
                                      'test/manifest/top.css.txt' );
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
            expect(assets['project2/css/top2.scss'].content.toString()).to.not.contain('#main {\n  width: 5em; }\n')
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

            expect(assets).to.have.keys('test/css/top.ca7986a9bb.css');
            expect(assets['test/css/top.ca7986a9bb.css'].content.toString()).to.contain('#main {\n  width: 5em; }\n')
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

            expect(assets).to.have.keys('test/manifest/top.js.txt');
            expect(assets['test/manifest/top.js.txt'].content.toString()).to.contain('project1/public/js/top1.js');
            expect(assets['test/manifest/top.js.txt'].content.toString()).to.contain('project2/public/js/top2.js');
            expect(assets['test/manifest/top.js.txt'].content.toString()).to.contain('project2/public/js/jquery-1.12.0-min.js');            
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

            expect(assets).to.have.keys('test/html/compiled.js.html',
                                    'test/html/compiled.css.html',
                                    'test/js/compiled.js.map',
                                    'test/js/compiled.12915d7076.js',
                                    'test/css/compiled.09414dff4c.css',
                                    'test/manifest/compiled.js.txt',
                                    'test/manifest/compiled.css.txt');

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

            expect(assets).to.have.keys('test/html/compiled.js.html',
                                    'test/html/compiled.css.html',
                                    'test/js/compiled.js.map',
                                    'test/js/compiled.12915d7076.js',
                                    'test/css/compiled.09414dff4c.css',
                                    'test/manifest/compiled.js.txt',
                                    'test/manifest/compiled.css.txt');
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

            expect(assets).to.have.keys('test/html/compiled.js.html',
                                  'test/html/compiled.css.html',
                                  'project3/js/compiled.js',
                                  'project3/css/compiled.css');
            done();

        });

    });

});
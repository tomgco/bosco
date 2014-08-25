'use strict';

var expect = require("expect.js");
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var StaticUtils = require('../src/StaticUtils');

var repos = ["project1","project2"];

var boscoMock = {
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

describe("Bosco Static Asset Handling", function() {


    it('should load static assets in un-minified cdn mode, deduping where necessary', function(done) {
    
        var options = {
            repos: ["project1","project2"], 
            minify: false,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {
            
            expect(assets).to.have.keys('test/html/top.js.html',
                                    'test/html/bottom.js.html',
                                    'test/html/top.css.html',
                                    'project1/js/top1.js',
                                    'project2/js/bottom2.js',
                                    'project2/js/top2.js',
                                    'project2/css/top2.css');
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

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('test/html/top.js.html',
                                      'test/html/bottom.js.html',
                                      'test/html/top.css.html',
                                      'test/js/top.js.map',
                                      'test/js/top.9788b8bac1.js',
                                      'test/js/bottom.js.map',
                                      'test/js/bottom.73c6205470.js',
                                      'test/css/top.309783f163.css',
                                      'test/manifest/top.js.txt',
                                      'test/manifest/bottom.js.txt',
                                      'test/manifest/top.css.txt');
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

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('test/html/top.js.html',
                                      'test/html/top.css.html',
                                      'test/js/top.js.map',
                                      'test/js/top.9788b8bac1.js',
                                      'test/css/top.309783f163.css',
                                      'test/manifest/top.js.txt',
                                      'test/manifest/top.css.txt');
            done();

        });

    });
});

describe("Bosco Static Asset Handling - Custom Building", function() {

  it('should execute bespoke build commands and use output', function(done) {
    
        var options = {
            repos: ["project3"], 
            minify: true,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('test/html/compiled.js.html',
                                      'test/js/compiled.js.map',
                                      'test/js/compiled.12915d7076.js',
                                      'test/manifest/compiled.js.txt');
            done();

        });

    });

  it('should execute bespoke build commands and use output, and execute the watch command in watch mode', function(done) {
    
        this.timeout(5000);

        var options = {
            repos: ["project3"], 
            minify: true,
            tagFilter: null,
            watchBuilds: true,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('test/html/compiled.js.html',
                                      'test/js/compiled.js.map',
                                      'test/js/compiled.12915d7076.js',
                                      'test/manifest/compiled.js.txt');
            done();

        });

    });

});
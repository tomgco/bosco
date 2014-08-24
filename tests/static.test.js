'use strict';

var expect = require("expect.js");
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var StaticUtils = require('../lib/StaticUtils');

var repos = ["project1","project2"];

var boscoMock = {
    log: function() {},
    error: function() {},
    warn: function() {},
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

    before(function(done){
       done();
    });

    it('should load static assets in un-minified cdn mode', function(done) {
    
        var options = {
            repos: repos, 
            minify: false,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('test/html/bottom.js.html',
                                      'test/html/top.js.html',
                                      'test/html/top.css.html',
                                      'project1/js/bottom1.js',
                                      'project1/js/top1.js',
                                      'project2/js/bottom2.js',
                                      'project2/js/top2.js',
                                      'project2/css/top2.css');
            done();

        });

    });

     it('should load static assets in minified cdn mode', function(done) {
    
        var options = {
            repos: repos, 
            minify: true,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {

            expect(assets).to.have.keys('test/html/bottom.js.html',
                                      'test/html/top.js.html',
                                      'test/html/top.css.html',
                                      'test/js/bottom.js.map',
                                      'test/js/bottom.d90e99b141.js',
                                      'test/js/top.js.map',
                                      'test/js/top.9788b8bac1.js',
                                      'test/css/top.309783f163.css',
                                      'test/manifest/bottom.js.txt',
                                      'test/manifest/top.js.txt',
                                      'test/manifest/top.css.txt');
            done();

        });

    });



});
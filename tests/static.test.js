'use strict';

var assert = require("assert");
var async = require('async');
var fs = require('fs');
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
        return true
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

    it('should load static assets in basic cdn mode', function(done) {
    
        var options = {
            repos: repos, 
            minify: false,
            tagFilter: null,
            watchBuilds: false,
            reloadOnly: false
        }

        var utils = StaticUtils(boscoMock);

        utils.getStaticAssets(options, function(err, assets) {
            done();
        });

    });

});
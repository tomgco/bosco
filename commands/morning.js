var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

module.exports = {
	name:'morning',
	description:'Runs clone, pull and then install to get your environment ready for action for the day',
	example:'bosco morning',
	cmd:cmd
}

function cmd(bosco, args) {

	var clone = require('./clone');
	var pull = require('./pull');
	var install = require('./install');

	clone.cmd(bosco, args, function() {
		pull.cmd(bosco, args, function() {
			install.cmd(bosco, args);
		});
	});
}


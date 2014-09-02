var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

module.exports = {
	name:'setup',
	description:'Runs clone and then install to get your environment ready for action.',
	example:'bosco setup',
	cmd:cmd
}

function cmd(bosco, args) {

	var clone = require('./clone');
	var install = require('./install');

	clone.cmd(bosco, args, function(err) {
		install.cmd(bosco, args);
	});
}


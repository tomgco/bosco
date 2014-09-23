var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var moment = require('moment');
var green = '\u001b[42m \u001b[0m';
var red = '\u001b[41m \u001b[0m';

module.exports = {
	name:'morning',
	description:'Runs clone, pull, installs and provides a summary of changes since your last morning command to get you ready for action for the day',
	example:'bosco morning',
	cmd:cmd
}

function cmd(bosco, args) {

	var clone = require('./clone');
	var pull = require('./pull');
	var install = require('./install');
	var activity = require('./activity');

	var lastMorningRunConfigKey = 'events:last-morning-run';

	var executeClone = function(next) {
		clone.cmd(bosco, args, next);
	};

	var executePull = function(next) {
		pull.cmd(bosco, args, next);
	};

	var executeInstall = function(next) {
		install.cmd(bosco, args, next);
	};

	var showActivitySummary = function(next) {
		args.since = bosco.config.get(lastMorningRunConfigKey); // If it is not set it will default to some value on the activity command

		activity.cmd(bosco, args, next);
	};

	var setConfigKeyForLastMorningRun = function(next) {
		bosco.config.set(lastMorningRunConfigKey, moment().format());
		bosco.config.save(next);
	};

	async.series([executeClone, executePull, executeInstall, showActivitySummary, setConfigKeyForLastMorningRun], function(err){
		bosco.log('Morning completed');
	});
}


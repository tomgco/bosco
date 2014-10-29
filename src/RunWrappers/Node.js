/**
 * Wrapper to manage services via PM2
 */
var _ = require('lodash');
var path = require('path');
var pm2 = require('pm2');
require('colors');

function Runner() {

}

Runner.prototype.init = function(bosco, next) {
	this.bosco = bosco;
	pm2.connect(next);
}

Runner.prototype.disconnect = function(next) {
    pm2.disconnect(next);
}

/**
 * List running services
 */
Runner.prototype.listRunning = function(detailed, next) {
	pm2.list(function(err, list) {
		var filteredList = _.filter(list, function(pm2Process){ return pm2Process.pm2_env.status === 'online' })

		if(!detailed) return next(err, _.pluck(filteredList,'name'));
		next(err, filteredList);
	});
}

/**
 * List services that have been created but are not running
 */
Runner.prototype.listNotRunning = function(detailed, next) {
	pm2.list(function(err, list) {
		var filteredList = _.filter(list, function(pm2Process){ return pm2Process.pm2_env.status !== 'online' })

		if(!detailed) return next(err, _.pluck(filteredList,'name'));
		next(err, filteredList);
	});
}

/**
 * Start a specific service
 * options = {cmd, cwd, name}
 */
Runner.prototype.start = function(options, next) {

	var self = this;
	// Remove node from the start script as not req'd for PM2
	var startCmd = options.service.start, startArr, start, ext;

	if(startCmd.split(' ')[0] == 'node') {
		startArr = startCmd.split(' ');
		startArr.shift();
		start = startArr.join(' ');

		ext = path.extname(startCmd);

		if(!path.extname(start)) {
			ext = '.js';
			start = start + '.js';
		}
	} else {
		start = startCmd;
	}

	var executeCommand = false;

	if (ext != '.js') {
		executeCommand = true;
	}

	// Node 0.10.x has a problem with cluster mode
	if (process.version.match(/0.10/)) {
		executeCommand = true;
	}

	if(!self.bosco.exists(options.cwd + '/' + start)) {
		self.bosco.warn('Can\'t start ' + options.name.red + ', as I can\'t find script: ' + start.red);
		return next();
	}
    self.bosco.log('Starting ' + options.name + ' ...');
	pm2.start(start, { name: options.name, cwd: options.cwd, watch: options.watch, executeCommand: executeCommand }, next);
}

/**
 * List running services
 */
Runner.prototype.stop = function(options, next) {
    var self = this;
	self.bosco.log('Stopping ' + options.name);
	pm2.stop(options.name, function(err) {
        if(err) return next(err);
 		pm2.delete(options.name, function(err) {
		  next(err);
		});
	});
}

module.exports = new Runner();

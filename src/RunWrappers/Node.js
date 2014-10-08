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

/**
 * List running services
 */
Runner.prototype.list = function(detailed, next) {
	pm2.list(function(err, list) {
		if(!detailed) return next(err, _.pluck(list,'name'));
		next(err, list);
	});
}

/**
 * Start a specific service
 * options = {cmd, cwd, name}
 */
Runner.prototype.start = function(options, next) {

	var self = this;
	// Remove node from the start script as not req'd for PM2
	var startCmd = options.service.start, startArr, start;
	if(startCmd.split(' ')[0] == 'node') {
		 startArr = startCmd.split(' ');
		 startArr.shift();
		 start = startArr.join(' ');
	}

	var ext = path.extname(startCmd);
	if(!path.extname(start)) {
		ext = '.js';
		start = start + '.js';
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

	pm2.start(start, { name: options.name, cwd: options.cwd, watch: options.watch, executeCommand: executeCommand }, next);
}

/**
 * List running services
 */
Runner.prototype.stop = function(options, next) {
	this.bosco.log('Stopping ' + options.name);
	pm2.stop(options.name, function(err) {
        if(err) return next(err);
 		pm2.delete(options.name, function(err) {
		  next(err);
		});
	});
}

module.exports = new Runner();

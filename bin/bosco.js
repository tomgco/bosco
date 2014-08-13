#!/usr/bin/env node

/**
 * Bosco command line tool
 */

var program = require('commander');
var Bosco = require('../index');
var _ = require('lodash');

program
  .version('0.0.1')
  .usage('[options] <command>')
  .option('-a, --app [app]', 'Use specific application')
  .option('-c, --configFile [file]', 'Use specific config file')
  .parse(process.argv);

var options = {
	app: program.app,
	configFile: program.configFile,
	args: program.args
};

var bosco = new Bosco(options);
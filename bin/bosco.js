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
  .option('-c, --configFile [file]', 'Use specific config file')
  .option('-e, --environment [environment]', 'Set environment to use')
  .option('-b, --build [build]', 'Set build identifier to use')
  .option('-n, --noprompt', 'Do not prompt for confirmation')
  .parse(process.argv);


var options = {
	configFile: program.configFile,
	noprompt: program.noprompt,
  build: program.build,
	environment: program.environment || "local",
	args: program.args
};

var bosco = new Bosco(options);
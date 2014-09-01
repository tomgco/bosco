#!/usr/bin/env node

/**
 * Bosco command line tool
 */

var program = require('commander');
var Bosco = require('../index');
var _ = require('lodash');
var pkg = require('../package.json');

program
  .version(pkg.version)
  .usage('[options] <command>')
  .option('-c, --configFile [file]', 'Use specific config file')
  .option('-e, --environment [environment]', 'Set environment to use')
  .option('-b, --build [build]', 'Set build identifier to use')
  .option('-r, --repo [pattern]', 'Use a specific repository (parsed as regexp)')
  .option('-n, --noprompt', 'Do not prompt for confirmation')
  .option('-f, --force', 'Force over ride on publish even if no changes')
  .parse(process.argv);


var options = {
	configFile: program.configFile,
	noprompt: program.noprompt,
  build: program.build || 'default',
	environment: program.environment || "local",
  repo: program.repo || ".*",
	args: program.args,
  force: program.force,
  program: program,
  version: pkg.version
};

var bosco = new Bosco(options);
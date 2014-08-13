/**
 * Core bosco libraries
 */

var events = require('events');
var _ = require('lodash');
var util = require('util');
var fs = require('fs');
var path = require('path');
var progress = require('progress');
var Table = require('cli-table');
var prompt = require('prompt');
prompt.message = "Bosco".green;

function Bosco(options) {

 var self = this;

 self._defaults = {
 	_defaultConfig: [__dirname,'defaults/bosco.json'].join("/"),
 	configFile:"./bosco.json"
 }

 self.options = _.defaults(options, self._defaults);
 self.config = require('nconf');
 self.prompt = prompt;
 self.progress = progress;

 self._init(function(err) {
 	if(err) return;

	var quotes, quotePath = self.config.get("quotes") || './quotes.json';
	try {
		quotes = require(quotePath);	
	} catch(ex) {
		console.log("Failed to load quotes: " + quotePath);
	} 
	if(quotes) self.log(quotes[Math.floor(Math.random() * quotes.length)].blue);

 	self.log("Initialised using [" + self.options.configFile.magenta + "]");
 	self._cmd();

 });

 events.EventEmitter.call(this);

};

util.inherits(Bosco, events.EventEmitter);

module.exports = Bosco;

Bosco.prototype.warn = function(msg) {
	console.log("Bosco".yellow + ": " + msg);
}

Bosco.prototype.log = function(msg) {
	console.log("Bosco".cyan + ": " + msg);
}

Bosco.prototype.error = function(msg) {
	console.log("Bosco".red + ": " + msg);
}

Bosco.prototype.exists = function(path) {
	return fs.existsSync(path);
}

Bosco.prototype._init = function(next) {

  var self = this,
  	  configFile = self.options.configFile;

  var loadConfig = function() {
  	self.config.env()
	  	       .file({ file: self.options.configFile });
  }

  self._checkConfig(function(err, initialise) {

  	  if(err) return next(err);

	  loadConfig();

  	  if(initialise) {
  	  	self._initialiseConfig(function(err) {
  	  		if(err) return;
  	  		next();
  	  	});
  	  } else {
  	  	next();
  	  }
	
  });
  
}

Bosco.prototype._checkConfig = function(next) {

  var self = this,
  	  defaultConfig = self.options._defaultConfig;
  	  configFile = self.options.configFile;

  if(!self.exists(configFile)) {
  	  
  	 prompt.start();

  	 prompt.get({
	    properties: {
	      confirm: {
	        description: "Do you want to create a new configuration file in the current folder (y/N)?".white
	      }
	    }
	  }, function (err, result) {

	  	if(result.confirm == 'Y' || result.confirm == 'y') {
  	 		var content = fs.readFileSync(defaultConfig);
  	 		fs.writeFileSync(configFile, content);
  	 		next(null, true);
  	 	} else {
  	 		next({message:'Did not confirm'});
  	 	}
  	 });

  } else {
  	next();
  }

}

Bosco.prototype._initialiseConfig = function(next) {

	var self = this;
	prompt.start();

  	prompt.get({
	    properties: {
	      github: {
	        description: "Enter the name of the github organization you want to use?".white
	      },
	      auth: {
	        description: "Enter the auth token that allows read access to the organization above and its private repos?".white
	      },
	      team: {
	        description: "Enter the team name that will be used to filter the repository list (optional - defaults to Owners)?".white
	      }
	    }
	  }, function (err, result) {
	  	self.config.set('github:organization',result.github);
	  	self.config.set('github:authToken',result.auth);
	  	self.config.set('github:team',result.team || "Owners");
	  	self.config.set('github:ignoredRepos',[]);
	  	self.config.save(next);
  	 });
};

Bosco.prototype._cmd = function() {	
	var self = this,
		commands = self.options.args,
		command = commands.shift(),
		commandModule = './commands/' + command + '.js';

	if(self.exists(commandModule)) {
		require(commandModule).cmd(self, commands);
	} else {
		self._commands();
	}
}

Bosco.prototype._commands = function() {

	var self = this, cmdPath = [__dirname,'commands'].join("/");

	var table = new Table({
	    head: ['Name', 'Description','Example']
	  , colWidths: [10, 80, 80]
	});

	var showCommand = function(cmd) {
		table.push([cmd.name, cmd.description || "",cmd.example || ""]);
	}
	
	console.log("\n");
	self.warn("Hey, to use bosco, you need to enter one of the following commands:")

	fs.readdir(cmdPath, function (err, files) {
	    if (err) throw err;
	    files.map(function (file) {
	        return path.join(cmdPath, file);
	    }).filter(function (file) {
	        return fs.statSync(file).isFile();
	    }).forEach(function (file) {
	        showCommand(require(file))
	    });
	    console.log(table.toString());
	    console.log("\n");
	});

}

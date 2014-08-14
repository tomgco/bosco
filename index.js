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
var async = require('async');
var mkdirp = require('mkdirp');
var knox = require('knox');

prompt.message = "Bosco".green;

function Bosco(options) {

 var self = this;

 self._defaults = {
 	_defaultConfig: [__dirname,'defaults/bosco.json'].join("/"),
 	configPath:"./.bosco/",
 	configFile:"./.bosco/bosco.json",
 	environment: (process.env.NODE_ENV || "development"),
 	envConfigFile:"./.bosco/" + (process.env.NODE_ENV || "development") + ".json"
 }

 self.options = _.defaults(options, self._defaults);
 self.config = require('nconf');
 self.prompt = prompt;
 self.progress = progress;

 console.log("\r"); 

 self._init(function(err) {
 	if(err) return;

	var quotes, quotePath = self.config.get("quotes") || './quotes.json';
	try {
		quotes = require(quotePath);	
	} catch(ex) {
		console.log("Failed to load quotes: " + quotePath);
	} 
	if(quotes) {
		self.log(quotes[Math.floor(Math.random() * quotes.length)].blue);
	}

	var aws = self.config.get('aws');
	if(aws) {
		self.knox = knox.createClient({
		  key: aws.key,
		  secret: aws.secret,
		  bucket: aws.bucket,
		  region: aws.region
		});
	}

 	self.log("Initialised using [" + self.options.configFile.magenta + "]");
 	self._cmd();

 	console.log("\r"); 

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
	  	       .file({ file: self.options.configFile })
	  	       .file('environment',{ file: self.options.envConfigFile });
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
  	  	if(!self.config.get('github:organization')) {
  	  		self.error("It looks like you are in a micro service folder or something is wrong with your config?\n");
  	  		next("error");
  	  	} else {
  	  		next();	
  	  	}  	  	
  	  }
	
  });
  
}

Bosco.prototype._checkConfig = function(next) {

  var self = this,
  	  defaultConfig = self.options._defaultConfig,
  	  configPath = self.options.configPath,
  	  configFile = self.options.configFile;

  var checkConfigPath = function(cb) {
	  if(!self.exists(configPath)) {
	  	mkdirp(configPath,cb);
	  } else {
	  	cb();
	  };
  }

  var checkConfig = function(cb) {
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
	  	 		cb(null, true);
	  	 	} else {
	  	 		cb({message:'Did not confirm'});
	  	 	}
	  	 });
	  } else {
	  	cb();
	  }
	} 

	async.series([checkConfigPath,checkConfig], function(err, result) {
		next(err, result[1]);
	});

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
	        description: "Enter the auth token (see: https://github.com/blog/1509-personal-api-tokens)?".white
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
	  	console.log("\r");
	  	self.config.save(next);
  	 });
};

Bosco.prototype._cmd = function() {	
	var self = this,
		commands = self.options.args,
		command = commands.shift(),
		commandModule = [__dirname,"/","commands","/",command,'.js'].join("");

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
	
	console.log("\r");
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
	    console.log("\r");
	});

}

Bosco.prototype.getOrg = function() {
	return this.config.get('github:organization');
}

Bosco.prototype.getOrgPath = function() {
	return [__dirname,this.getOrg()].join("/");
}

Bosco.prototype.getRepoPath = function(repo) {
	return [this.getOrgPath(),repo].join("/");
}

Bosco.prototype.getRepoUrl = function(repo) {
	return ['git@github.com:',this.getOrg(),"/",repo,'.git'].join(""); 
}


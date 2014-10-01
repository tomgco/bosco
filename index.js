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
var request = require('request');
var colors = require('colors');
var dateformat = require('dateformat');
var sf = require('sf');

prompt.message = "Bosco".green;

Bosco.getGlobalCommandFolder = [__dirname,"/","commands","/"].join('');
Bosco.getLocalCommandFolder = [path.resolve("."),"/","commands","/"].join('');

function Bosco(options) {

 var self = this;

 self._defaults = {
 	_defaultConfig: [__dirname,'config/bosco.json'].join("/"),
 	configPath:"./.bosco/",
 	configFile:"./.bosco/bosco.json"
 }

 self.options = _.defaults(options, self._defaults);
 self.options.envConfigFile = "./.bosco/" + options.environment + ".json";
 self.options.defaultsConfigFile = "./.bosco/defaults.json";
 self.options.cpus = require('os').cpus().length;

 self.config = require('nconf');
 self.prompt = prompt;
 self.progress = progress;

 self._init(function(err) {

 	self._checkVersion();

 	if(err) return console.log(err);

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
	if(aws && aws.key) {
		self.knox = knox.createClient({
		  key: aws.key,
		  secret: aws.secret,
		  bucket: aws.bucket,
		  region: aws.region
		});
	}

	self.staticUtils = require('./src/StaticUtils')(self);

 	self.log("Initialised using [" + self.options.configFile.magenta + "] in environment [" + self.options.environment.green + "]");
 	self._cmd();

 });

 events.EventEmitter.call(this);

};

util.inherits(Bosco, events.EventEmitter);

module.exports = Bosco;

Bosco.prototype._init = function(next) {

  var self = this,
  	  configFile = self.options.configFile;

  var loadConfig = function() {
  	self.config.env()
	  	 .file({ file: self.options.configFile })
	  	 .file('environment',{ file: self.options.envConfigFile })
	  	 .file('defaults',{ file: self.options.defaultsConfigFile });
  }

  self._checkConfig(function(err, initialise) {

  	  if(err) return;

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
		  	if(!result) return cb({message:'Did not confirm'});
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
	      githubUser: {
	        description: "Enter your github user name:".white
	      },
	      github: {
	        description: "Enter the name of the github organization you want to use:".white
	      },
	      auth: {
	        description: "Enter the auth token (see: https://github.com/blog/1509-personal-api-tokens):".white
	      },
	      team: {
	        description: "Enter the team name that will be used to filter the repository list (optional - defaults to Owners):".white
	      }
	    }
	  }, function (err, result) {
	  	self.config.set('github:user',result.githubUser);
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
		commandModule = [Bosco.getGlobalCommandFolder, command, '.js'].join(""),
		localCommandModule = [Bosco.getLocalCommandFolder, command, '.js'].join("");

	if(self.exists(commandModule)) {
		require(commandModule).cmd(self, commands);
	} else {
		if(self.exists(localCommandModule)) {
			require(localCommandModule).cmd(self, commands);
		} else {
			if(self.options.shellCommands) {
				self._shellCommands();
			} else {
				self._commands();
			}

		}
	}
}

Bosco.prototype._shellCommands = function() {

	var self = this, cmdPath = [__dirname,'commands'].join("/"), localPath = path.join(path.resolve("."),"commands");

	var showCommands = function(cPath, files, next) {
		var showCommand = function(cmd) {
			return(cmd.name);
		}
		var cmdString = "";
	    files.forEach(function (file) {
	        cmdString += file.replace(".js","") + " ";
	    });
	    next(null, cmdString.split(" "));
	}

	async.series([
		function(next) {
			fs.readdir(cmdPath, function(err, files) {
				showCommands(cmdPath, files, next)
			})
		},
		function(next) {
			fs.readdir(localPath, function(err, files) {
				if(!files || files.length == 0) return next();
				showCommands(localPath, files, next)
			})
		}],
		function(err, files) {
			files = _.uniq(_.flatten(files));
			console.log("Available commands: " + files.join(" "));
			process.exit(0);
		});
}

Bosco.prototype._commands = function() {

	var self = this, cmdPath = [__dirname,'commands'].join("/"), localPath = path.join(path.resolve("."),"commands");

	var showTable = function(tableName, cPath, files, next) {

		var table = new Table({
		    head: [tableName,'Example']
		  , colWidths: [12, 60]
		});

		var showCommand = function(cmd) {
			table.push([cmd.name, cmd.example || ""]);
		}

	    files.map(function (file) {
	        return path.join(cPath, file);
	    }).filter(function (file) {
	        return fs.statSync(file).isFile();
	    }).forEach(function (file) {
	        showCommand(require(file))
	    });
	    console.log(table.toString());
	    console.log("\r");
	    next();
	}

	console.log("\r");
	self.warn("Hey, to use bosco, you need to enter one of the following commands:")

	async.series([
		function(next) {
			fs.readdir(cmdPath, function(err, files) {
				showTable("Core", cmdPath, files, next)
			})
		},
		function(next) {
			fs.readdir(localPath, function(err, files) {
				if(!files || files.length == 0) return next();
				showTable("Local", localPath, files, next)
			})
		},
		function(next) {
			var wait = function() {
				if(self._checkingVersion) {
					setTimeout(wait, 100);
				} else {
					next();
				}
			}
			wait();
		},
		function(next) {
		    console.log("You can also specify these parameters:")
		    console.log(self.options.program.help());
		}],
		function(err) {

		});


}

Bosco.prototype._checkVersion = function() {
	// Check the version in the background
	var self = this;
	self._checkingVersion = true;
	var npmUrl = "http://registry.npmjs.org/bosco";
	request({url:npmUrl,timeout:1000}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var jsonBody = JSON.parse(body);
			var version = jsonBody['dist-tags'].latest;
			if(self.options.version !== version) {
				self.error("There is a newer version (Remote: " + version.green + " <> Local: " + self.options.version.yellow + ") of Bosco available, you should upgrade!");
				console.log("\r");
			}
		}
		self._checkingVersion = false;
	});
}

Bosco.prototype.getOrg = function() {
	return this.config.get('github:organization');
}

Bosco.prototype.getOrgPath = function() {
	return [path.resolve("."),this.getOrg()].join("/");
}

Bosco.prototype.getRepoPath = function(repo) {
	return [this.getOrgPath(),repo].join("/");
}

Bosco.prototype.getRepoUrl = function(repo) {
	return ['git@github.com:',this.getOrg(),"/",repo,'.git'].join("");
}

Bosco.prototype.warn = function(msg, args) {
    this._log("Bosco".yellow, msg, args);
}

Bosco.prototype.log = function(msg, args) {
    this._log("Bosco".cyan, msg, args);
}

Bosco.prototype.error = function(msg, args) {
	this._log("Bosco".red, msg, args);
}

Bosco.prototype._log = function(identifier, msg, args) {
    var parts = {
        identifier: identifier,
        time: new Date(),
        message: args ? sf(msg, args) : msg
    };
    console.log(sf('[{time:hh:mm:ss}] {identifier}: {message}', parts));
}

Bosco.prototype.exists = function(path) {
	return fs.existsSync(path);
}
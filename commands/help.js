
var prettyjson = require('prettyjson');
var path = require('path');
var fs = require('fs');

module.exports = {
	name:'help',
	description:'Shows help about Bosco',
	example:'bosco help <command>',	
	cmd:cmd
}

function cmd(bosco, args) {

	var cmdName = args.shift();
	if(!cmdName) return bosco.error("You need to provide a command name. e.g: " + module.exports.example);

	var cmdPath = path.join(__dirname,'commands',cmdName + '.js'), 
		localPath = path.join(path.resolve("."),"commands",cmdName + '.js'),
		helpPath = path.join(__dirname,'help',cmdName + '.txt'),
		localHelpPath = path.join(path.resolve("."),'help',cmdName + '.txt');

	var printHelp = function(module) {
		var m = require(module);
		var o = {
			name: m.name,
			description: m.description,
			example: m.example
		}
		
		console.log("");
		console.log(prettyjson.render(o, {noColor: false}));
		console.log("");

		if(bosco.exists(helpPath)) return console.log(fs.readFileSync(helpPath).toString());
		if(bosco.exists(localHelpPath)) return console.log(fs.readFileSync(localHelpPath).toString());		

	}

	if(bosco.exists(cmdPath)) return printHelp(cmdPath);
	if(bosco.exists(localPath)) return printHelp(localPath);

}
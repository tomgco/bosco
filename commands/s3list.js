require('colors');

module.exports = {
	name:'s3list',
	description:'Lists all of the S3 pushes you have done from this configuration',
	example:'bosco s3list',
	cmd:cmd
}

var tag = "", noprompt = false;

function cmd(bosco, args) {
	
	if(!bosco.knox) bosco.error("You don't appear to have any S3 config for this environment?");
	var pushed = bosco.config.get('S3:published') || [];	

	bosco.log("S3 Pushed Assets for this " + bosco.options.environment.blue)
	pushed.forEach(function(push) {
		bosco.log(push.green);
	});

}
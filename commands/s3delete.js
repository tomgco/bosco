
var _ = require('lodash');
	require('colors');

module.exports = {
	name:'s3delete',
	description:'Deletes a published asset set from S3 - must be one you have published previously',
	example:'bosco s3delete <environmment>/<build>',
	cmd:cmd
}

var tag = "", noprompt = false;

function cmd(bosco, args) {
	
	if(!bosco.knox) bosco.error("You don't appear to have any S3 config for this environment?");
	var pushed = bosco.config.get('S3:published') || [];
	var toDelete = args[0] || "Not specified"

	if(!toDelete || !_.contains(pushed, toDelete)) {
		return bosco.error("Unable to delete:" + toDelete.blue + " as it is not in your push list.")	
	}

	bosco.knox.list({ prefix: bosco.options.environment + '/' + toDelete }, function(err, data) {
		
		var files = _.pluck(data.Contents, 'Key');
		if(files.length == 0) return bosco.error("There doesn't appear to be any files matching that push.")

		confirm("Are you sure you want to delete ".white + (files.length+"").green + " files in push " + toDelete.green + "?", function(err, confirmed) {

			if(err || !confirmed) return;
			bosco.knox.deleteMultiple(files, function(err, res) {
				if(err) return bosco.error(err.message);
				if(res.statusCode == '200') {			
					bosco.log("Completed deleting " + toDelete.blue);				
					pushed = _.without(pushed, toDelete);
					var envConfig = bosco.config.stores.environment;	
					envConfig.store.S3 = {published: pushed};				
					bosco.config.save();					
				};
			});

		});
		

	});

	var confirm = function(message, next) {
		 bosco.prompt.start();
	  	 bosco.prompt.get({
		    properties: {
		      confirm: {
		        description: message
		      }
		    }
		  }, function (err, result) {
		  	if(!result) return next({message:'Did not confirm'});
		  	if(result.confirm == 'Y' || result.confirm == 'y') {
	  	 		next(null, true);
	  	 	} else {
	  	 		next(null, false);
	  	 	}
	  	 });
	}

	
}
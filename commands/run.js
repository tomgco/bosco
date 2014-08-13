module.exports = {
	name:'run',
	description:'Runs all of the microservices (or subset based on tag)',
	example:'bosco run <tag>',
	cmd:cmd
}

function cmd(bosco, args) {
	
	// Loop through each MS
	// Build list of Files + Tags from bosco.json files
	// Using this list compile a set of compiled assets
	// Push somewhere or serve
	bosco.log("Run each mircoservice " + args);

}
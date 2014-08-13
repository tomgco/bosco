module.exports = {
	name:'face',
	description:'Compiles all of the front end assets for each microservice',
	example:'bosco face',
	cmd:cmd
}

function cmd(bosco, args) {
	
	// Loop through each MS
	// Build list of Files + Tags from bosco.json files
	// Using this list compile a set of compiled assets
	// Push somewhere or serve
	bosco.log("Compile front end assets " + args);

}
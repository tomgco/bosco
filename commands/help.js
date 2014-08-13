module.exports = {
	name:'help',
	description:'Shows help about Bosco',
	example:'bosco help',
	cmd:cmd
}

function cmd(bosco, args) {
	bosco.log("SHOW HELP " + args);
}
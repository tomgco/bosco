var github = require('octonode');
var _ = require('lodash');

module.exports = {
    name:'action',
    description:'A command to show recent activity for all members of your org',
    example:'bosco action',
    cmd:cmd
}

function cmd(bosco) {
  getActivity(bosco);
}

function getActivity(bosco) {

  var client = github.client(bosco.config.get('github:authToken'));

  client.get('/orgs/tes/members', {}, function (err, status, body) {

    if(err) { return bosco.error('Unable to access github with given authKey: ' + err.message); }

    _.each(body, function(event) {
        console.dir(event);
        showUser(bosco, event);
    });

  });

}

function showUser(bosco, user) {

  var client = github.client(bosco.config.get('github:authToken'));

  client.get('/users/' + user + '/events', {}, function (err, status, body) {

    if(err) { return bosco.error('Unable to access github with given authKey: ' + err.message); }

    _.each(body, function(event) {
        var data = [user, event.type, event.repo.name, event.created_at];
        console.dir(data.join(', '));
    });

  });

}

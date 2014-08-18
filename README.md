# Bosco

Bosco is an attempt to build a utility knife to help manage the complexity that using microservices, which results in a large number of code repositories, brings with it.  Inspired by the Github 'setup', e.g. can a developer run one simple command and get up and running?

## Get Started

```
npm install bosco -g
bosco fly
```

Run this command in a folder where you want all of your projects to live.  It will prompt you for some information, and then save this configuration in this based folder, in future always run bosco from here.

## Configuration

It will ask initially for:

- Github Organization:  The organization it will query for repos, e.g. TSLEducation.
- Github Auth Key:  A key that gives read access to the repositories in the organization (you can set this up here: https://github.com/blog/1509-personal-api-tokens).
- Github Team:  This is the team that it will query to get the repository list.  If you don't enter it, it will default to Owners.

This is then saved in a configuration file, default is in .bosco/bosco.json, so all subsequent commands use it.

```
{
  "github": {
    "organization": "TSLEducation",
    "authToken": "2266b8xxxxxxxxxxxxxxxxxxxxxa84a5f9",
    "team": "southampton-buildings",
    "repos": [
      "infra-ansible-configuration",
      "infra-aws",
      "infra-bootstrap",
      "infra-cabot",
      "infra-defcon-agent",
      "infra-dns",
      "infra-dockerfiles"
    ]
  }
}
```

Bosco will also include any configuration in a file in the .bosco folder with the same environment as NODE_ENV.  This allows you to manage things like AWS keys for publication of assets into different environments.

## Commands

### Fly

The default command, this sets you up.

```
bosco fly
```

This will clone all the repositories in your team, and then run npm install on all of them.  If the repository already exists locally it will skip it.  To have it update the repository with changes, just add 'pull' to the command, and it will issue a 'git pull --rebase' on all the projects before npm install.

```
bosco fly pull
```

### S3 Push

This will create bundles for front end assets (JS, CSS, Templates).

```
bosco s3push <tagname optional>
```

This command requires that you have configured your AWS details for S3.  Best to put these into your .bosco folder in a per environment config, e.g. .bosco/development.json.

```
{
	"aws":{
		"key": "XXXXXX",
        "secret": "XXXXXX",
        "bucket": "bucket-name",
        "region": "eu-west-1",
        "cdn":"https://dudu89lpwit3y.cloudfront.net"
	}
}

```

To then access the html fragments for PC, it follows a simple convention:

- cdn/environment/tag.type.html

For example:

- [https://dudu89lpwit3y.cloudfront.net/development/html/bottom.js.html](https://dudu89lpwit3y.cloudfront.net/development/html/bottom.js.html)

This would contain a fragment that has script tag for all of the minified JS tagged in the bottom group.

### CDN

This will aggregate and serve all of the static assets (those compiled by Face) on a single pseudo CDN url.  

```
bosco cdn <minify>
```

If passed the minify parameter it will minify the JS, but serve locally as above.

## Service Configuration

### bosco-service.json

If services want to take part in the static asset part, they need a bosco-service.json config file.

e.g.

```
{
    "assets": {
        "basePath": "/src/public",
        "js": {
            "bottom": [
                "js/lib/base64.min.js",
                "js/lib/bind.shim.min.js",
                "js/lib/cookies.min.js",
                "js/lib/lean-modal.min.js",
                "js/report-review.js",
                "js/resources.js"
            ],
            "top": [
                "js/event-tracking.js"
            ]
        },
        "css": {}
    }
}
```

To then access the html fragments for PC, it follows a simple convention:

- http://localhost:7334/html/tag.type.html

For example:

- [http://localhost:7334/html/bottom.js.html](http://localhost:7334/html/bottom.js.html)

This would contain a fragment that has script tags for all of the JS tagged in the bottom group.




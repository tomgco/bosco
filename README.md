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

```json
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

```json
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

## Manifest Files

To ensure that we always know what was in a specific release, the minification process creates a manifest file 
for each bundle that includes each file, along with the last commit that was made to that file.

Before you push, it will do a diff between the last manifest file created, and the one for the bundle you are about to push, and ask you to confirm that all of the files changed are ones that you expected to be changed.  e.g. it will try to avoid you pushing someone elses change unexpectedly.

```
service-hub-beta/js/lib/html5shiv-min.js, Last commit: 09b61e7 refactor
service-hub-beta/js/lib/jquery-1.11.0-min.js, Last commit: 09b61e7 refactor
service-hub-beta/js/lib/jquery-mobile-1.4.3-min.js, Last commit: 09b61e7 refactor
service-hub-beta/js/lib/modernizr-2.7.1-min.js, Last commit: 09b61e7 refactor
service-hub-beta/js/dom.js, Last commit: 09b61e7 refactor
service-hub-beta/js/measure.js, Last commit: 09b61e7 refactor
service-hub-beta/js/page.js, Last commit: 2353274 @doodlemoonch @csabapalfi fix broken browse section height
service-hub-beta/js/resource.js, Last commit: 09b61e7 refactor
service-hub-beta/js/sequence.js, Last commit: 09b61e7 refactor
service-hub-beta/js/upload.js, Last commit: 09b61e7 refactor
service-resource/js/lib/base64.min.js, Last commit: 29bba10 @antony @tepafoo Moved own resource logic to front-end
service-resource/js/lib/bind.shim.min.js, Last commit: e1b212b @antony User cannot review their own resource.
service-resource/js/lib/cookies.min.js, Last commit: 29bba10 @antony @tepafoo Moved own resource logic to front-end
service-resource/js/lib/lean-modal.min.js, Last commit: 8ba20d1 @antony Fire a modal when reporting a review
service-resource/js/report-review.js, Last commit: e0c5af0 @antony @carolineBda Feedback / Report review form
service-resource/js/resources.js, Last commit: bf28fc9 @cressie176 fixing server side use of authentication state
```

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

```json
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
When using the CDN mode, you can then access the html fragments for PC, it follows a simple convention:

- http://localhost:7334/html/tag.type.html

For example:

- [http://localhost:7334/html/bottom.js.html](http://localhost:7334/html/bottom.js.html)

This would contain a fragment that has script tags for all of the JS tagged in the bottom group.

## Using project specific build tools

Some projects will want (or need) something more sophisticated than a simple concatenation / minification step for assets.  To support this, Bosco allows you to define a build configuration on a per project basis in the bosco-service.json file.

For example, a project that uses Gulp to create assets as well as watch for change, can use a configuration like that below in the bosco-service.json:

```json
{
    "assets": {
        "basePath":"/dist",
        "build":{
            "command":"gulp build",            
            "output":{
                "js": {
                    "upload": [
                        "js/tsl-uploader.js"
                    ]
                },
                "css": {
                     "upload": [
                        "css/tsl-uploader.css"
                    ]   
                },
                "images": {
                    "upload" :[
                        "img"
                    ]
                }
            },
            "watch":{
                "command":"gulp build --watch",
                "finished":"Finished 'build'"
            }
        }
    }
}
```

In this mode, instead of directly defining the JS and CSS assets, simply define a abuild configuration that includes the command to run, the files created as a result of the build step and optionally a watch command that will allow bosco to understand how to put the project into watch mode when using 'bosco cdn'.

## Duplicate Files and Libraries

Bosco will attempt to detect duplicate files (via a checksum), as well as duplicate libraries (e.g. multiple versions of jQuery).  If it spots a duplicate, it will not add it to a minified bundle after warning you that it found it.  Because of this the first version of a library it finds will 'win'. 

It is strongly recommended that you pull all 'core' libraries like jQuery into a central single project to avoid duplication, but Bosco will try and help you if you don't.

Note that if you use the external build option then the files inside this project don't get included in the duplicate check.




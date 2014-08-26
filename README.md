# Bosco

[![Build Status](https://travis-ci.org/TSLEducation/bosco.svg?branch=master)](https://travis-ci.org/TSLEducation/bosco)  [![Coverage Status](https://img.shields.io/coveralls/TSLEducation/bosco.svg)](https://coveralls.io/r/TSLEducation/bosco?branch=master)

Bosco is a utility knife to help manage the complexity that using microservices, which naturally results in a large number of code repositories, brings with it.  Inspired by the Github 'setup', e.g. can a developer run one simple command and get up and running?

## Get Started

```
npm install bosco -g
bosco fly
```

Run this command in a folder where you want all of your projects to live.  It will prompt you for some information, and then save this configuration in this based folder, in future always run bosco from here.

## Configuration

It will ask initially for:

|Configuration|Description|
|--------------|-----------|
|Github name|Your username|
|Github Organization|The organization it will query for repos, e.g. TSLEducation.|
|Github Auth Key|A key that gives read access to the repositories in the organization (you can set this up here: https://github.com/blog/1509-personal-api-tokens).|
|Github Team|This is the team that it will query to get the repository list.  If you don't enter it, it will default to Owners|

This is then saved in a configuration file locally on disk, default is in .bosco/bosco.json, so all subsequent commands use it.|

```json
{
  "progress":"bar",
  "github": {
    "organization": "TSLEducation",
    "authToken": "2266b8xxxxxxxxxxxxxxxxxxxxxa84a5f9",
    "team": "southampton-buildings",
    "user": "cliftonc"
  }
}
```

Bosco will also include any configuration in a file in the .bosco folder with the environment specified via the -e parameter.  This allows you to manage things like AWS keys for publication of assets into different environments.

One additional configuration parameter in this file is 'progress' - change it to "verbose" if you would prefer to see all of the output from the commands vs progress bars.

## Command List

Commands in Bosco are defined via specific command files within the 'commands' folder: [https://github.com/TSLEducation/bosco/tree/master/commands](commands).

To get a list of installed commands in your installation just type 'bosco':

```
┌──────────┬────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────┐
│ Name     │ Description                                                                    │ Example                                                                        │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ cdn      │ Aggregates all the static assets across all microservices and serves them via… │ bosco cdn minify                                                               │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ fly      │ Initialises your entire working environment in one step                        │ bosco fly <pull> <install>                                                     │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ help     │ Shows help about Bosco                                                         │ bosco help                                                                     │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ run      │ Runs all of the microservices (or subset based on tag)                         │ bosco run <tag>                                                                │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ s3delete │ Deletes a published asset set from S3 - must be one you have published previo… │ bosco s3delete <environmment>/<build>                                          │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ s3list   │ Lists all of the S3 pushes you have done from this configuration               │ bosco s3list                                                                   │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ s3push   │ Builds all of the front end assets for each microservice and pushes them to S… │ bosco s3push | bosco s3push top                                                │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ stash    │ Stashes any local changes across all repos                                     │ bosco stash                                                                    │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ status   │ Checks git status across all services                                          │ bosco status                                                                   │
├──────────┼────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
│ upstream │ Runs a git fetch and tells you what has changed upstream for all your repos    │ bosco upstream                                                                 │
└──────────┴────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────┘
```

## Parameters

You can use a number of parameters to control the behaviour of Bosco.  Parameters are configuration options that can be used across commands.

|parameter|description|example|default|
|---------|-----------|-------|--------|
|-e, --environment|Environment name|bosco -e development s3push|local|
|-b, --build|Build number or tag|bosco -e production -b 66 s3push|default|
|-c, --configFile|Config file|bosco -c config.json fly|.bosco/bosco.json|
|-n, --noprompt|Do not prompt for confirmation|bosco -e staging -b 67 -n s3push|false|
|-f, --force|Force over ride of any files|bosco -e production -b 66 -f s3push|false|

## Commands

### Fly

The default command, this sets you up.

```
bosco fly <pull> <install>
```

This will clone all the repositories in your team, and then run npm install on all of them.  If the repository already exists locally it will skip it.  

To have it update the repository with changes, just add 'pull' to the command, and it will issue a 'git pull --rebase' on all the projects.

To have it run 'npm install' against all repos, just add 'install'.

```
bosco fly pull install
```


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
When using the CDN mode (see [cdn command](#cdn) below, you can then access the html fragments for PC, it follows a simple convention:

- http://localhost:7334/<environment>/<build>/html/tag.type.html

For example:

- [http://localhost:7334/local/default/html/bottom.js.html](http://localhost:7334/local/default/html/bottom.js.html)

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
                "ready":"Finished 'build'"
            }
        }
    }
}
```

In this mode, instead of directly defining the JS and CSS assets, simply define a abuild configuration that includes the command to run, the files created as a result of the build step and optionally a watch command that will allow bosco to understand how to put the project into watch mode when using 'bosco cdn'.

### CDN

This will aggregate and serve all of the static assets (those defined within bosco-service.json files within each project) on a single pseudo CDN url.  

```
bosco cdn <minify>
```

If passed the minify parameter it will minify the JS, but serve locally as above.

### S3 Push

This will create bundles for front end assets (JS, CSS, Templates).

```
bosco s3push -e <environment> -b <buildname> <tagname>
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

```
<cdn>/<environment>/<build>/<type>/<tag>.<fragmentType>.<js|css|html|map|txt>
```

For example:

- [https://dudu89lpwit3y.cloudfront.net/development/cliftonc/html/bottom.js.html](https://dudu89lpwit3y.cloudfront.net/development/cliftonc/html/bottom.js.html)

This would contain a fragment that has script tag for all of the minified JS tagged in the bottom group.

It is recommended that you also add a temporary (or permanent) build tag via the -b parameter, e.g.

```
bosco s3push -e development -b mybuild21 <tagname optional>
```

- [https://dudu89lpwit3y.cloudfront.net/development/mybuild21/html/bottom.js.html](https://dudu89lpwit3y.cloudfront.net/development/mybuild21/html/bottom.js.html)

### Managing Pushes to S3

Every time you do a push to S3 Bosco will keep track of it in a per environment configuration file, allowing you to clean up after yourself via two additional s3 commands:

```
bosco -e development s3list
```

This will list the current builds you have pushed to S3.

```
bosco -e development s3delete mybuild21
```

This will delete a specific build from an environment.  Note that the build name is not supplied by the -b parameter in this instance.

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

## Duplicate Files and Libraries

Bosco will attempt to detect duplicate files (via a checksum), as well as duplicate libraries (e.g. multiple versions of jQuery).  If it spots a duplicate, it will not add it to a minified bundle after warning you that it found it.  Because of this the first version of a library it finds will 'win'. 

It is strongly recommended that you pull all 'core' libraries like jQuery into a central single project to avoid duplication, but Bosco will try and help you if you don't.

Note that if you use the external build option then the files inside this project don't get included in the duplicate check.




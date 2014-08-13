# Bosco

Bosco is an attempt to build a utility knife to help manage the complexity that using microservices, which results in a large number of code repositories, brings with it.  Inspired by the Github 'setup', e.g. can a developer run one simple command and get up and running?

## Get Started

'''
npm install bosco -g
bosco go
'''

Run this command in a folder where you want all of your projects to live.  It will prompt you for some information, and then save this configuration in this based folder, in future always run bosco from here.

## Configuration

It will ask initially for:

Github Organization:  The organization it will query for repos, e.g. TSLEducation.
Github Auth Key:  A key that gives read access to the repositories in the organization (you can set this up here: https://github.com/blog/1509-personal-api-tokens).
Github Team:  This is the team that it will query to get the repository list.  If you don't enter it, it will default to Owners.

This is then saved in your configuration file, so all subsequent commands use it.

## Commands

### GO

The default command, this sets you up.

```
bosco go
```

This will clone all the repositories in your team, and then run npm install on all of them.  If the repository already exists locally it will skip it.  To have it update the repository with changes, just add 'pull' to the command, and it will issue a 'git pull --rebase' on all the projects before npm install.

```
bosco go pull
```




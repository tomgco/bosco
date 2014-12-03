bosco-audit(3) -- Run 'bosco audit' across all repositories in your Github team.
==============================================

## SYNOPSIS

    bosco audit
    bosco audit -r <repoPattern>

## DESCRIPTION

This command is used to audit every node.js project in bosco. Bosco auditi
currently uses the node security projects module `nsp` to check against a list
of known vulnrabilities.


## COMMAND LINE OPTIONS

### -r, --repo

* Default: .\*
* Type: String

This sets a regex string to use to filter the repostory list.

# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets) to track version bumps and changelogs.

## Workflow

1. Make code changes
2. Run `npx changeset` to create a changeset describing your changes
3. Commit the changeset file with your PR
4. At release time, `npx changeset version` consumes changesets and bumps versions
5. `npx changeset publish` publishes to npm

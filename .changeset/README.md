# Changesets

Versioning goes through [changesets](https://github.com/changesets/changesets), rather than editing
the version in package.json and letting a push to master publish whatever it finds there. The bump
and the publish are one step, so a release that fails partway leaves no version burned and nothing
tagged.

Any change that should reach a user needs a changeset. Run:

```
npm run changeset
```

pick the bump type, and commit the generated markdown file alongside your change. A pull request with
no changeset publishes nothing, which is right for documentation, CI and dependency-only changes.

On master, the release workflow opens a "Version packages" pull request that applies every pending
changeset to the version and the changelog. Merging that pull request is what publishes to npm.

The package exports `.`, `./node` and `./generate`, each as CommonJS and ES modules, so a change to
what any of them exports is a breaking change.

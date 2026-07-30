# Contributing

:+1::tada: First off, thanks for taking the time to contribute! :tada::+1:

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

Please note we have a code of conduct, please follow it in all your interactions with the project.

## Pull Request Process

1. Open a issue first or pickup a existing issue, to not start working on improvement that we may judge out of scope for this project

2. Ensure to run linter and ensure the result of your changes can be build without errors

```
npm run lint:fix

npm run build
```

3. Document the new features, or functionality in README.md

4. Increase the version numbers in package.json to the new version that this Pull Request would represent. The versioning scheme we use is [SemVer](http://semver.org/).

## Continuous Integration

Every push and pull request against `main` and `dev` runs `.github/workflows/test.yml`:

- **Lint, format & build** — `npm run format:check`, `npm run lint`, `npm run build`
- **Plugin tests** — `npm run compile` and `npm test` on Node 22 and 24 (Hardhat 3 requires Node >= 22.13.0)
- **Package smoke test** — `npm pack`, then installs the tarball into a clean consumer project and imports the plugin to catch broken `dist/` output or a bad `files`/`exports` config

You can reproduce all of it locally with `npm run format:check && npm run lint && npm run build && npm test`.

### TypeScript 6 / 7 side-by-side

`tsc` runs TypeScript 7, but `typescript-eslint` does not support the TS 7 API yet, so
`package.json` uses the [officially documented aliases](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/):

```json
"@typescript/native": "npm:typescript@^7.0.2",
"typescript": "npm:@typescript/typescript6@^6.0.2"
```

`typescript` resolves to the TS 6 API that ESLint needs, while `npx tsc` still runs TS 7.
Please keep both entries in place until `typescript-eslint` ships TS 7 support
([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).

## Releasing

Publishing is automated by `.github/workflows/publish.yml` and requires an `NPM_TOKEN` repository secret.

1. Bump `version` in `package.json` and merge that change into `main`.
2. Create a GitHub Release whose tag matches the version (`v0.2.0` or `0.2.0`).
3. The workflow re-runs format, lint, build, compile and tests, verifies the tag matches
   `package.json`, then publishes to npm with `--provenance --access public`.

A mismatched tag fails the run before anything is published. You can also trigger the workflow
manually via **Run workflow**; it defaults to a dry run that packs and validates without publishing.

## Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we as
contributors and maintainers pledge to making participation in our project and
our community a harassment-free experience for everyone, regardless of age, body
size, disability, ethnicity, gender identity and expression, level of experience,
nationality, personal appearance, race, religion, or sexual identity and
orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment
include:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior by participants include:

* The use of sexualized language or imagery and unwelcome sexual attention or
advances
* Trolling, insulting/derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or electronic
  address, without explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

### Our Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable
behavior and are expected to take appropriate and fair corrective action in
response to any instances of unacceptable behavior.

Project maintainers have the right and responsibility to remove, edit, or
reject comments, commits, code, wiki edits, issues, and other contributions
that are not aligned to this Code of Conduct, or to ban temporarily or
permanently any contributor for other behaviors that they deem inappropriate,
threatening, offensive, or harmful.

### Scope

This Code of Conduct applies both within project spaces and in public spaces
when an individual is representing the project or its community. Examples of
representing a project or community include using an official project e-mail
address, posting via an official social media account, or acting as an appointed
representative at an online or offline event. Representation of a project may be
further defined and clarified by project maintainers.

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported by contacting the project team at [INSERT EMAIL ADDRESS]. All
complaints will be reviewed and investigated and will result in a response that
is deemed necessary and appropriate to the circumstances. The project team is
obligated to maintain confidentiality with regard to the reporter of an incident.
Further details of specific enforcement policies may be posted separately.

Project maintainers who do not follow or enforce the Code of Conduct in good
faith may face temporary or permanent repercussions as determined by other
members of the project's leadership.

### Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 1.4,
available at [http://contributor-covenant.org/version/1/4][version]

[homepage]: http://contributor-covenant.org
[version]: http://contributor-covenant.org/version/1/4/
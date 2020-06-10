# JvM Contentful Migrations

## Getting started

### Install

```bash
npm i @jungvonmatt/contentful-migrations
```

#### Prerequisites

This package is hosted in the github registry.
This means you need to [configure npm for use with GitHub Packages](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages)

The global _.npmrc_ file should something look like this:

```
//registry.npmjs.org/:_authToken=GITHUB_TOKEN
//npm.pkg.github.com/:_authToken=NPM_TOKEN

registry=https://registry.npmjs.org/
@jungvonmatt:registry=https://npm.pkg.github.com/
```

#### Usage with github actions

There are two steps required to use this package with github actions:

1. [Create a TOKEN](https://github.com/settings/tokens) and add it as secret to the project (repo/packages read/write access) because the default GITHUB_TOKEN [can't install packages from private repositories](https://help.github.com/pt/packages/using-github-packages-with-your-projects-ecosystem/using-github-packages-with-github-actions#installing-a-package-using-an-action)
2. Add the github registry url to the `actions/setup-node@v1` configuration and the generated token to the install command.

The yaml file should look something like this:

```
  ...

  - name: Clone repository
    uses: actions/checkout@v1
  - name: Use Node.js
    uses: actions/setup-node@v1
    with:
      node-version: '10'
      always-auth: true
      registry-url: https://npm.pkg.github.com
      scope: '@jungvonmatt'
  - name: Install npm dependencies
    run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{secrets.GH_PACKAGES_TOKEN}}

   ...
```

## Commands

### help

```bash
npx migrations help [command]
```

### init

```bash
npx migrations init
```

Initializes migrations and stores the config values in the `package.json` or the `.migrationsrc` file.

#### Configuration values

| Name               | Default        | Description                                                                                                                                 |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| accessToken        | `undefined`    | Contentful Management Token. Just run `npx contentful login` and you're done.                                                               |
| spaceId            | `undefined`    | Contentful Space id                                                                                                                         |
| defaultEnvironment | 'master'       | Contentful Space environment. Acts as default if there is no environment named after the current git branch or the passed env doesn't exist |
| contentTypeId      | 'config'       | Id of a content model holding global config values (Required for storing the migration version)                                             |
| fieldId            | 'migration'    | Id of the field where the migration version is stored                                                                                       |
| directory          | './migrations' | Directory where the migration files are stored                                                                                              |

### generate

Generate an empty migration script.
This command will also add an initial migration to add the contentType and the field if they not already exist.

```bash
npx migrations generate
```

### fetch

Generate a migration script based on passed content-type.
This command will also add an initial migration to add the contentType and the field if they not already exist.

```bash
npx migrations fetch -c <my-content-type>
```

### migrate

Runs all "new" migrations on the current environment or the environment specified by the `-e` param

```bash
npx migrations migrate
```

### content

Transfer content from one contentful environment to another.<br/>
This command will not overwrite existing content unless you say so.

##### Optional Arguments

`--diff`: Manually choose skip/overwrite for every conflicting content.<br/>
`--force`: No manual diffing. Overwrites all conflicting entries/assets.

```bash
npx migrations content --source-env <environment>  --dest-env <environment>  --content-type <content-type>
```

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/jungvonmatt/contentful-migrations/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

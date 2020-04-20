# JvM Contentful Migrations

## Getting started

### Prerequisites

This package is hosted in the github registry.
This means you need to [configure npm for use with GitHub Packages](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages)

The global _.npmrc_ file should something look like this:

```
//registry.npmjs.org/:_authToken=GITHUB_TOKEN
//npm.pkg.github.com/:_authToken=NPM_TOKEN

registry=https://registry.npmjs.org/
@jungvonmatt:registry=https://npm.pkg.github.com/
```

### Install

```bash
npm i @jungvonmatt/contentful-migrations
```

## Commands

### help

### init

```bash
npx @jungvonmatt/contentful-migrations init
```

Initializes migrations and stores the config values in the `package.json` or the `.migrationsrc` file.

#### Configuration values

| Name          | Default        | Description                                                                                                                |
| ------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| accessToken   | `undefined`    | Contentful Management Token. Just run `npx contentful login` and you're done.                                              |
| spaceId       | `undefined`    | Contentful Space id                                                                                                        |
| environment   | Git Branch     | Contentful Space environment. Leave empty to always run migrations on the environment which matches the current Git Branch |
| contentTypeId | 'config'       | Id of a content model holding global config values (Required for storing the migration version)                            |
| fieldId       | 'migration'    | Id of the field where the migration version is stored                                                                      |
| directory     | './migrations' | Directory where the migration files are stored                                                                             |

### generate

Generate an empty migration script.
This command will also add an initial migration to add the contentType and the field if they not already exist

```bash
npx @jungvonmatt/contentful-migrations generate
```

### migrate

Runs all "new" migrations on the current environment

```bash
npx @jungvonmatt/contentful-migrations migrate
```

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/jungvonmatt/contentful-migrations/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

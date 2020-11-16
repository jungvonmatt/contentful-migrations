# JvM Contentful Migrations

## Getting started

### Install

```bash
npm i @jungvonmatt/contentful-migrations
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

```bash
npx migrations content --source-env <environment>  --dest-env <environment>
```

##### Optional Arguments

`--content-type`: Limit to specific content-type and it's dependencies.<br/>
`--diff`: Manually choose skip/overwrite for every conflicting content.<br/>
`--force`: No manual diffing. Overwrites all conflicting entries/assets.<br/>
`--verbose`: Show tree of entries/assets which should be migrated.

![Diff example](https://raw.githubusercontent.com/jungvonmatt/contentful-migrations/master/diff.jpg)

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/jungvonmatt/contentful-migrations/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

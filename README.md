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

**Use this command if you want to switch from managing migrations in contentful with a single Tag to the recommended approach using a dedicated content type for migrations**

#### Configuration values

| Name               | Default        | Description                                                                                                                                 |
| ------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| accessToken        | `undefined`    | Contentful Management Token. Just run `npx contentful login` and you're done.                                                               |
| spaceId            | `undefined`    | Contentful Space id                                                                                                                         |
| defaultEnvironment | `'master'`       | Contentful Space environment. Acts as default if there is no environment named after the current git branch or the passed env doesn't exist |
| strategy           | `undefined`             | We need to keep a hint to the executed migrations inside contentful. You can choose between **Content-model** and **Tag**. <br/><br/>**Content-model** will add a new content-model to your contentful environment and stores the state of every migration as content entry (recommended approach) <br/>**Tag** Will only store the latest version inside a tag. You need to preserve the right order yourself. When you add a new migration with an older version number it will not be executed. |
| fieldId            | `'migration'`    | Id of the tag where the migration version is stored                                                                                         |
| contentTypeId      | `'contentful-migrations'`    | Id of the migration content-type                                                                                                |
| directory          | `'./migrations'` | Directory where the migration files are stored                                                                                              |

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

### execute

Execute a single migration with the execute command.

```bash
npx migrations execute <path/to/migration.js>
```

### version

Sometimes you may need to manually mark a migration as migrated or not. You can use the version command for this.
Use caution when using the version command. If you delete a version from the table and then run the migrate command, that migration version will be executed again.

*This command is only available when using the Content-model strategy*

```bash
# Add a migration entry to contentful
npx migrations version <path/to/migration.js> --add


# Delete a migration entry from contentful
npx migrations version <path/to/migration.js> --delete
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

### doc

Generate simple markdown docs for the content-types

```bash
npx migrations doc -e <environment> -p <path/to/docs>
```

##### Optional Arguments

`--template`: Use a custom template for docs. `.js` with default export or `.mustache` is allowed<br/>
`--extension`: Use a custom file extension (default is `.md`)<br/>

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/jungvonmatt/contentful-migrations/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

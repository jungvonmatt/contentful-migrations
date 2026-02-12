# JvM Contentful Migrations

[![Build Status][ci-image]][ci-url] [![NPM Version][npm-image]][npm-url] [![Sonarcloud Status][sonarcloud-image]][sonarcloud-url]

JvM Contentful Migrations offers additional functionality on top of the existing migration functionality of the [Contentful CLI](https://github.com/contentful/contentful-cli). It makes it easy and safe to deploy changes to your content model in a way that can be reviewed and tested before being deployed to production. With migrations you can do almost everything with your content and your content model. See the [official documentation](https://github.com/contentful/contentful-migration) for more information.

## Getting started

### Install

```bash
# pnpm
pnpm add @jungvonmatt/contentful-migrations

# npm
npm i @jungvonmatt/contentful-migrations

# yarn
yarn add @jungvonmatt/contentful-migrations
```

### Initialize

After installation we only need a few bits of information to get you started. To help you configure `contentful-migrations` just run the `init` command.

```bash
npx migrations init
```

This initializes migrations and stores the config values in the `package.json` or the `.migrationsrc` file.

**You can also use this command if you want to switch from managing migrations in Contentful with a single Tag to the recommended approach using a dedicated Content type for migrations**

#### Configuration files

We use [`@jungvonmatt/contentful-config`](https://github.com/jungvonmatt/contentful-ssg/tree/main/packages/contentful-config) (built on [`@jungvonmatt/config-loader`](https://github.com/jungvonmatt/config-loader) and [`c12`](https://github.com/unjs/c12)) which provides extensive configuration loading capabilities from multiple sources.

**Supported configuration locations (in order of priority):**
- Configuration overrides passed via command line arguments
- User-specified config file (via `--config` option)
- `migrations.config.{js,ts,mjs,cjs,mts,cts}`
- `.config/migrations.{js,ts,mjs,cjs,mts,cts,json,jsonc,json5,yaml,yml,toml}`
- `.migrationsrc.{js,ts,mjs,cjs,mts,cts,json,jsonc,json5,yaml,yml,toml}`
- `.migrationsrc`
- `package.json` (in a `migrations` property)
- Environment variables (with `CONTENTFUL_MIGRATIONS_CONFIG_*` prefix)
- `.env` files (`.env.{NODE_ENV}`, `.env`)
- Default configuration

**Extending configurations:**
You can extend configurations from other files or remote sources using the `extends` property:
```js
// migrations.config.js
export default {
  extends: ['./base.config.js', 'github:user/repo'],
  // your config...
}
```

**Environment-specific configuration:**
```js
// migrations.config.js
export default {
  spaceId: 'default-space',
  $development: { spaceId: 'dev-space' },
  $production: { spaceId: 'prod-space' }
}
```

You can specify any config file path using the `--config <path/to/config>` command line argument. Multiple config files can be used for different environments or spaces in your project.

#### Configuration values

All configuration values can also be set via environment variables

| Name                   | Environment Variable                       | Default                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| managementToken        | `CONTENTFUL_MANAGEMENT_TOKEN`              | `undefined`               | Contentful Management Token. Just run `npx contentful login` and you're done.                                                                                                                                                                                                                                                                                                                                                                                                           |
| -accessToken-          |                                            | `undefined`               | Not supported anymore. Please use `managementToken` instead.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| spaceId                | `CONTENTFUL_SPACE_ID`                      | `undefined`               | Contentful Space id. Will fallback to `process.env.CONTENTFUL_SPACE_ID` if not set.                                                                                                                                                                                                                                                                                                                                                                                                     |
| environmentId          | `CONTENTFUL_ENVIRONMENT_ID`                | `undefined`               | Contentful Environment id. Will fallback to `process.env.CONTENTFUL_ENVIRONMENT_ID` if not set.<br/>If neither `environmentId` nor `CONTENTFUL_ENVIRONMENT_ID` is available we search for environment whose id matches the current git branch                                                                                                                                                                                                                                           |
| host                   | `CONTENTFUL_HOST`                          | `undefined`               | Allows configuring the Contentful CLI for EU usage. Will fallback to the global contentful config in your `.contentfulrc.json`                                                                                                                                                                                                                                                                                                                                                          |
| requestBatchSize       | `CONTENTFUL_MIGRATIONS_REQUEST_BATCH_SIZE` | `undefined`               | The batch size used for loading data from contentful. Contentful uses a default of 100. Use a smaller value when you get `Response size too big` errors (for example caused by very large rich text fields). Be aware that contentful migrations might hide the response size error and only print `The provided space does not exist or you do not have access`                                                                                                                        |
| storage                | `CONTENTFUL_MIGRATIONS_STORAGE`            | `undefined`               | We need to keep a hint to the executed migrations inside Contentful. You can choose between **content\* and **tag**. <br/><br/>**Content** will add a new content type to your Contentful environment and stores the state of every migration as content entry (recommended approach) <br/>**tag\*\* Will only store the latest version inside a tag. You need to preserve the right order yourself. When you add a new migration with an older version number it will not be executed. |
| fieldId                | `'CONTENTFUL_MIGRATIONS_FIELD_ID'`         | `'migration'`             | Id of the tag where the migration version is stored (only used with storage `tag`)                                                                                                                                                                                                                                                                                                                                                                                                      |
| migrationContentTypeId | `CONTENTFUL_MIGRATIONS_CONTENT_TYPE_ID`    | `'contentful-migrations'` | Id of the migration content-type (only used with storage `content`)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| directory              | `CONTENTFUL_MIGRATIONS_DIRECTORY`          | `'./migrations'`          | Directory where the migration files are stored                                                                                                                                                                                                                                                                                                                                                                                                                                          |

<br/>
<br/>

## Showing help

Whenever you get stuck, you can output the help to your terminal:

```bash
npx migrations help

# Help for a specific command
npx migrations help <command>
```

## Handling contentful environments

It is recommended that you develop and test your migrations in a separate environment before executing them on production content. You can handle environments using the `environment` command:

```bash
# Add a new environment and activate it for API usage
npx migrations environment <environment-id> --create [--source-environment-id <source-environment-id>]

# Remove an environment
npx migrations environment <environment-id> --remove [--source-environment-id <source-environment-id>]

# Reset an environment
npx migrations environment <environment-id> --reset [--source-environment-id <source-environment-id>]
```

## Generating blank migrations

To generate a blank migration you can use the `generate` command:

```bash
npx migrations generate
```

## Generate a migration from an existing content-type

Sometimes you may not want to start a migration from scratch. You can create a new Content type in the [contentful web app](https://www.contentful.com/help/content-modelling-basics/) and import it using the `fetch` command.

_When you want to use the contentful web app to configure your content types you should do so in a separate environment because the migration will fail if the content-type is already present at the time you run the migration script_

```bash
# Generate migration scripts for all content types from the current environment
npx migrations fetch

# Generate migration scripts only for specific content types from the current environment
npx migrations fetch -c <content-type> -c <another-content-type>

# Generate migration script for single content type from a custom environment
npx migrations fetch -c <content-type> -e <environment-id>
```

## Executing multiple migrations

You can execute all "new" migrations using the `migrate` command.

```bash
# Run all 'new' migrations in the current environment
npx migrations migrate

# Run all 'new' migrations in a custom environment
npx migrations migrate -e <environment-id>
```

## Executing single migrations

You may want to just execute a single migration. You can do this with the execute command:

```bash
# Execute single migration in the current environment
npx migrations execute <path/to/migration.js>

# Execute single migration in a custom environment
npx migrations execute <path/to/migration.js> -e <environment-id>
```

## Managing the migration versions stored in contentful

Sometimes you may need to manually mark a migration as migrated or not. You can use the `version` command for this.
_Use caution when using the version command. If you delete a version from the table and then run the migrate command, that migration version will be executed again._

**This command is only available when using the content storage**

```bash
# Add a migration entry to Contentful
npx migrations version <path/to/migration.js> --add

# Delete a migration entry from Contentful
npx migrations version <path/to/migration.js> --remove

# Add a migration entry to Contentful in a custom environment
npx migrations version <path/to/migration.js> --add -e <environment-id>

# Delete a migration entry from Contentful in a custom environment
npx migrations version <path/to/migration.js> --remove -e <environment-id>
```

## Migrating content between environments

In some workflows it may be required to create and test content in a dedicated environment and 'copy' it after an approval process to your production environment.
You can do this using the `content` command.

```bash
# Transfer content from one Contentful environment to another.
# This command will not overwrite existing content unless you say so.
npx migrations content --source-environment-id <environment>  --dest-environment-id <environment>
```

##### Optional Arguments

`--content-type`: Limit to specific content-type and it's dependencies.<br/>
`--diff`: Manually choose skip/overwrite for every conflicting content.<br/>
`--force`: No manual diffing. Overwrites all conflicting entries/assets.<br/>
`--verbose`: Show tree of entries/assets which should be migrated.

![Diff example](https://raw.githubusercontent.com/jungvonmatt/contentful-migrations/master/diff.jpg)

## Generating documentation for your content types

You may want to have some markdown documentation for your content-types. With the `doc` command you can auto-generate the documentation. You can use the default template or you can specify a custom template using either a Javascript file or a mustache template.

```bash
npx migrations doc -e <environment> -p <path/to/docs>
```

##### Optional Arguments

`--template`: Use a custom template for docs. `.js` with default export or `.mustache` is allowed<br/>
`--extension`: Use a custom file extension (default is `.md`)<br/>

## Migration helpers

We provide you with a few smaller migration helpers. There aren't many at the moment, but there may be more in the future.

To use the helpers you just need to wrap your migration with the provided `withHelpers` function which makes the helpers available as 3rd parameter
in your migration function:

```js
const { withHelpers } = require('@jungvonmatt/contentful-migrations');

module.exports = withHelpers(async (migration, context, helpers) => {
  // Get all locales
  await helpers.locale.getLocales();
  // Get default locale
  await helpers.locale.getDefaultLocale();

  // Add or remove values from "linkContentType" validations without knowing all the other elements in the array
  await helpers.validation.addLinkContentTypeValues('contentTypeId', 'fieldId', ['some-content-type']);
  await helpers.validation.removeLinkContentTypeValues('contentTypeId', 'fieldId', ['some-content-type']);
  await helpers.validation.modifyLinkContentTypeValues('contentTypeId', 'fieldId', (existing) => {
    const result = existing.filter((contentType) => !contentType.startsWith('a-')); // remove some by prefix
    result.push('t-test'); // and add one
    return result; // possible duplicate values are removed afterwards
  });

  // Add or remove values from "in" validations without knowing all the other elements in the array
  await helpers.validation.addInValues('contentTypeId', 'fieldId', ['value']); // add at the end
  await helpers.validation.addInValues('contentTypeId', 'fieldId', ['value'], { mode: 'sorted' }); // add and sort
  await helpers.validation.removeInValues('contentTypeId', 'fieldId', ['value']);
  await helpers.validation.modifyInValues('contentTypeId', 'fieldId', (existing) => {
    const result = existing.filter((value) => value.startsWith('prefix')); // keep values with prefix
    result.push('other'); // and add one
    return result; // possible duplicate values are removed afterwards
  });

  // Add or remove enabled marks for a rich text field without knowing all the active marks
  // See: https://github.com/contentful/rich-text/blob/master/packages/rich-text-types/src/marks.ts
  await helpers.validation.richText.addEnabledMarksValues('contentTypeId', 'fieldId', ['bold']);
  await helpers.validation.richText.removeEnabledMarksValues('contentTypeId', 'fieldId', ['underline']);
  await helpers.validation.richText.modifyEnabledMarksValues('contentTypeId', 'fieldId', (existing) => {
    const result = existing.filter((value) => value !== 'code'); // keep values with prefix
    result.push('italic'); // and add one
    return result; // possible duplicate values are removed afterwards
  });

  // Add or remove enabled node types for a rich text field without knowing all the active node types
  // See https://github.com/contentful/rich-text/blob/master/packages/rich-text-types/src/blocks.ts
  // and https://github.com/contentful/rich-text/blob/master/packages/rich-text-types/src/inlines.ts
  await helpers.validation.richText.addEnabledNodeTypeValues('contentTypeId', 'fieldId', ['blockquote']);
  await helpers.validation.richText.removeEnabledNodeTypeValues('contentTypeId', 'fieldId', ['hyperlink']);
  await helpers.validation.richText.modifyEnabledNodeTypeValues('contentTypeId', 'fieldId', (existing) => {
    const result = existing.filter((value) => !value.startsWith('heading-')); // filter out headings like 'heading-1'
    result.push('quote'); // and add one
    return result; // possible duplicate values are removed afterwards
  });

  // Add or remove embedded or linked content types for a rich text field without knowing all the allowed content types
  // The possible node types are 'entry-hyperlink', 'embedded-entry-block' and 'embedded-entry-inline'.
  await helpers.validation.richText.addNodeContentTypeValues('contentTypeId', 'fieldId', 'embedded-entry-block', ['a-content-type']);
  await helpers.validation.richText.removeNodeContentTypeValues('contentTypeId', 'fieldId', 'embedded-entry-inline', ['a-content-type']);
  await helpers.validation.richText.modifyNodeContentTypeValues('contentTypeId', 'fieldId', 'entry-hyperlink', (existing) => {
    const result = existing.filter((value) => value.startsWith('t-')); // filter out content types that not start with 't-'
    result.push('t-article'); // and add one
    return result; // possible duplicate values are removed afterwards
  });

});
```

## Can I contribute?

Of course. We appreciate all of our [contributors](https://github.com/jungvonmatt/contentful-migrations/graphs/contributors) and
welcome contributions to improve the project further. If you're uncertain whether an addition should be made, feel
free to open up an issue and we can discuss it.

## Contributors

<a href="https://github.com/jungvonmatt/contentful-migrations/graphs/contributors">
  <img alt="Contributor profile pictures" src="https://contrib.rocks/image?repo=jungvonmatt/contentful-migrations" />
</a>

[npm-url]: https://www.npmjs.com/package/@jungvonmatt/contentful-migrations
[npm-image]: https://img.shields.io/npm/v/@jungvonmatt/contentful-migrations.svg
[sonarcloud-url]: https://sonarcloud.io/dashboard?id=jungvonmatt_contentful-migrations
[sonarcloud-image]: https://sonarcloud.io/api/project_badges/measure?project=jungvonmatt_contentful-migrations&metric=alert_status
[ci-url]: https://github.com/jungvonmatt/contentful-migrations/actions?workflow=Tests
[ci-image]: https://github.com/jungvonmatt/contentful-migrations/workflows/Tests/badge.svg

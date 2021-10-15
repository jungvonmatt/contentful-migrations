const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const { stripIndent } = require('common-tags');
const contentfulImport = require('contentful-import');
const runMigration = require('contentful-migration/built/bin/cli').runMigration;
const {
  getContentTypes,
  generateMigrationScript,
} = require('contentful-cli/lib/cmds/space_cmds/generate_cmds/migration');
const globby = require('globby');
const chalk = require('chalk');
const { diff } = require('./diff');
const { getEnvironment, getContent, getContentId, getLinkedAssets, getLinkedEntries } = require('./contentful');

const { buildTree } = require('./tree');
const { STRATEGY_TAG, STRATEGY_CONTENT } = require('./config');

const STATE_SUCCESS = 'success';
const STATE_FAILURE = 'failure';

const initializeContentModel = async (config) => {
  const { contentTypeId } = config;
  const client = await getEnvironment(config);
  const { items: contentTypes } = await client.getContentTypes();

  const exists = (contentTypes || []).some((contentType) => contentType.sys.id === contentTypeId);

  if (!exists) {
    console.log(`\nCreating content-type: ${chalk.green(contentTypeId)}`);
    const contentType = await client.createContentTypeWithId(contentTypeId, {
      name: 'Migrations',
      description: 'Internal data model holding references to all migrations',
      displayField: 'version',
      fields: [
        {
          id: 'version',
          name: 'Version',
          type: 'Symbol',
          localized: false,
          required: true,
          validations: [],
          disabled: false,
          omitted: false,
        },
        {
          id: 'name',
          name: 'Name',
          type: 'Symbol',
          localized: false,
          required: false,
          validations: [],
          disabled: false,
          omitted: false,
        },
        {
          id: 'state',
          name: 'State',
          type: 'Symbol',
          localized: false,
          required: false,
          validations: [
            {
              in: [STATE_SUCCESS, STATE_FAILURE],
            },
          ],
          disabled: false,
          omitted: false,
        },
        {
          id: 'message',
          name: 'Message',
          type: 'Text',
          localized: false,
          required: false,
          validations: [],
          disabled: false,
          omitted: false,
        },
      ],
    });
    await contentType.publish();

    const editorInterface = await client.getEditorInterfaceForContentType(contentTypeId);
    if (editorInterface) {
      const messageIndex = editorInterface.controls.findIndex((value) => value.fieldId === 'message');
      editorInterface.controls[messageIndex] = {
        ...editorInterface.controls[messageIndex],
        widgetNamespace: 'builtin',
        widgetId: 'multipleLine',
      };

      const stateIndex = editorInterface.controls.findIndex((value) => value.fieldId === 'state');
      editorInterface.controls[stateIndex] = {
        ...editorInterface.controls[stateIndex],
        widgetNamespace: 'builtin',
        widgetId: 'radio',
      };

      await editorInterface.update();
    }
  }
};

const addMigrationEntry = async (data, config) => {
  const { version, name, state, message } = data;

  let { defaultLocale, contentTypeId } = config;
  if (!defaultLocale) {
    defaultLocale = await getDefaultLocale(config);
  }

  const client = await getEnvironment(config);

  let entry;
  try {
    entry = await client.getEntry(version);
  } catch {}

  if (!entry) {
    entry = await client.createEntryWithId(contentTypeId, version, {
      fields: {
        version: {
          [defaultLocale]: version,
        },
        name: {
          [defaultLocale]: name,
        },
        state: {
          [defaultLocale]: state,
        },
        message: {
          [defaultLocale]: message || '',
        },
      },
    });
  } else {
    entry.fields.name = { [defaultLocale]: name };
    entry.fields.state = { [defaultLocale]: state };
    entry.fields.message = { [defaultLocale]: message || '' };
    await entry.update();
  }
};

const versionAdd = async (file, config) => {
  const { strategy } = config || {};
  if (strategy === STRATEGY_TAG) {
    throw new Error('The version command is not available for the "tag" strategy');
  }

  const name = path.basename(file);
  const [, version] = /^(\d+)-/.exec(name);

  console.log(`\nAdding migration ${chalk.green(version)} ...`);
  await addMigrationEntry({ version, name, state: STATE_SUCCESS, message: 'Manually added' }, config);
};

const versionDelete = async (file, config) => {
  const { strategy } = config || {};
  if (strategy === STRATEGY_TAG) {
    throw new Error('The version command is not available for the "tag" strategy');
  }

  const name = path.basename(file);
  const [, version] = /^(\d+)-/.exec(name);

  const client = await getEnvironment(config);

  const entry = await client.getEntry(version);
  await entry.delete();
};

const getMigrationVersions = async (config) => {
  const { contentTypeId } = config;
  const client = await getEnvironment(config);
  const { items } = await client.getEntries({ content_type: contentTypeId });

  return (items || []).map((item) => parseInt(item.sys.id, 10));
};

const migrateToContentStrategy = async (config) => {
  const { directory, fieldId } = config || {};
  let { defaultLocale } = config;
  if (!defaultLocale) {
    defaultLocale = await getDefaultLocale(config);
  }

  const client = await getEnvironment(config);
  const version = await getMigrationVersion(config);
  const migrations = await globby(`${directory}/*.js`);
  const environmentId = client.sys.id;
  const filtered = migrations.filter((file) => {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    return version && parseInt(version, 10) >= parseInt(num, 10);
  });

  console.log(
    `\nFound ${chalk.green(filtered.length)} executed migrations in environment ${chalk.green(environmentId)}`
  );
  console.log(`Adding content-entries ...`);
  for await (const file of filtered) {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    await addMigrationEntry({ version: num, name, state: STATE_SUCCESS }, config);
  }

  if (fieldId) {
    try {
      const migrationTag = await client.getTag(fieldId);
      await migrationTag.delete();
    } catch {}
  }
  console.log('done 👍🏼');
};

const migrateToTagStrategy = async (config) => {
  const { contentTypeId } = config;
  const defaultLocale = await getDefaultLocale(config);
  const oldVersion = getMigrationVersion(config);
  if (contentTypeId) {
    const client = await getEnvironment(config);
    const { items } = await client.getEntries({ content_type: contentTypeId });

    const version =
      items.length &&
      Math.max(
        ...items
          .filter((item) => item?.fields?.state?.[defaultLocale] === STATE_SUCCESS)
          .map((item) => parseInt(item.sys.id, 10))
      );

    if (version && (oldVersion || 0) < version) {
      await setMigrationVersion(config, version);
    }
    for await (const item of items) {
      const entry = await client.getEntry(item.sys.id);
      try {
        await entry.unpublish();
      } catch {}
      await entry.delete();
    }

    const contentType = await client.getContentType(contentTypeId);
    if (contentType) {
      await contentType.unpublish();
      await contentType.delete();
    }
  }
};

/**
 * Get the default locale
 * @param {Object} config The config object including all required data
 * @returns {boolean}
 */
const getDefaultLocale = async (config) => {
  const client = await getEnvironment(config);
  const { items: locales } = await client.getLocales();

  const defaultLocale = locales.find((locale) => locale.default);
  const { code } = defaultLocale || {};
  return code || 'de';
};

/**
 * Get migration version from the currewnt encvironment stored in the meta object
 * @param {Object} config The config object including all required data
 * @returns {String}
 */
const getMigrationVersion = async (config) => {
  const { contentTypeId, fieldId } = config || {};
  const client = await getEnvironment(config);

  // try to get migration version from tags
  try {
    const migrationTag = await client.getTag(fieldId);
    return migrationTag.name || 0;
  } catch {}

  // Fall back to old config if no tag is available (backwards compatibility)
  const locale = await getDefaultLocale(config);
  try {
    const { items } = await client.getEntries({
      content_type: contentTypeId,
    });

    return (items || []).reduce(async (result, item) => {
      const { fields } = item || {};

      if (Object.keys(fields).includes(fieldId)) {
        const { [fieldId]: field } = fields || {};
        const { [locale]: value } = field || {};
        return value || 0;
      }
      return result;
    }, undefined);
  } catch {}

  return;
};

/**
 * Set migration version in meta object
 * @param {Object} config The config object including all required data
 * @param {Number} version Migration Version
 */
const setMigrationVersion = async (config, version) => {
  const { contentTypeId, fieldId } = config || {};
  const client = await getEnvironment(config);

  try {
    const migrationTag = await client.getTag(fieldId);
    migrationTag.name = `${version}`;
    await migrationTag.update();
    return;
  } catch (error) {
    console.log(error);
  }

  try {
    await client.createTag(fieldId, `${version}`);
    return;
  } catch (error) {
    console.log(error);
  }

  console.log('Could not save migration version');
};

/**
 * Create new migration file.
 * Adds initial migration file adding the migration field in the content type
 * @param {Object} config The config object including all required data
 */
const createMigration = async (config) => {
  const { directory } = config || {};
  const timestamp = Date.now();
  const filename = path.join(directory, `${timestamp}-migration.js`);
  const content = stripIndent`
  /* eslint-env node */

  /**
   * Contentful migration
   */
  module.exports = function(migration /*, context */) {
    // Add your migration code here
    // See: https://github.com/contentful/contentful-migration
  }`;

  await fs.outputFile(filename, content);
  console.log(`Generated new migration file to ${chalk.green(filename)}`);
};

const executeMigration = async (file, config) => {
  const { accessToken, spaceId, strategy } = config || {};
  const client = await getEnvironment(config);
  const environmentId = client.sys.id;

  const name = path.basename(file);
  const [, version] = /^(\d+)-/.exec(name);

  const options = {
    filePath: file,
    accessToken,
    spaceId,
    environmentId,
    yes: true,
  };

  console.log(`\nRun migration ${chalk.green(version)} ...`);
  try {
    await runMigration(options);
    await addMigrationEntry({ version, name, state: STATE_SUCCESS }, config);
  } catch (error) {
    if (strategy === STRATEGY_TAG && migrationVersion) {
      await setMigrationVersion(config, migrationVersion);
    }
    if (strategy === STRATEGY_CONTENT) {
      const message = (error.errors || [error]).map((error) => error.message).join('\n');
      await addMigrationEntry({ version, name, state: STATE_FAILURE, message }, config);
    }
    throw error;
  }

  return version;
};

/**
 *
 * @param {Object} config The config object including all required data
 */
const runMigrations = async (config) => {
  const { directory, strategy, bail } = config || {};

  const client = await getEnvironment(config);
  const migrations = await globby(`${directory}/*.js`);
  const environmentId = client.sys.id;
  let filtered = [];

  if (strategy === STRATEGY_TAG) {
    const version = await getMigrationVersion(config);
    filtered = migrations.filter((file) => {
      const name = path.basename(file);
      const [, num] = /^(\d+)-/.exec(name);

      return !version || parseInt(version, 10) < parseInt(num, 10);
    });
  }

  if (strategy === STRATEGY_CONTENT) {
    const versions = await getMigrationVersions(config);
    filtered = migrations.filter((file) => {
      const name = path.basename(file);
      const [, num] = /^(\d+)-/.exec(name);

      return !(versions || []).includes(parseInt(num, 10));
    });
  }

  console.log(
    `Found ${chalk.green(filtered.length)} unexecuted migrations in environment ${chalk.green(environmentId)}`
  );

  let migrationVersion = 0;
  for await (const file of filtered) {
    try {
      migrationVersion = await executeMigration(file, config);
    } catch (error) {
      if (bail) {
        throw error;
      }
    }
  }

  if (filtered.length && strategy === STRATEGY_TAG) {
    await setMigrationVersion(config, migrationVersion);
  }

  console.log(chalk.green('\nAll done'), '🚀');
};

/**
 * Fetch migration from contentful
 * @param {Object} config The config object including all required data
 */
const fetchMigration = async (config) => {
  const { contentType, directory } = config || {};
  const client = await getEnvironment(config);
  let timestamp = Date.now();
  const contentTypes = contentType
    ? (await Promise.all(contentType.map((ct) => getContentTypes(client, ct)))).flat()
    : await getContentTypes(client);

  const promises = contentTypes.map(async (entry) => {
    const filename = path.join(directory, `${timestamp++}-create-${entry.sys.id}-migration.js`);
    const content = await generateMigrationScript(client, [entry]);
    await fs.outputFile(filename, content);
    console.log(`Generated new migration file to ${chalk.green(filename)}`);
  });

  return Promise.all(promises);
};

const resolveConflicts = async (sourceEntries, destEntries, options) => {
  const { contentTypes, diffConflicts, forceOverwrite } = options;

  // Find conflicting entries
  const sourceEntryIds = sourceEntries.map((entry) => getContentId(entry));
  const conflictEntries = destEntries.filter((entry) => sourceEntryIds.includes(getContentId(entry)));
  const conflictEntryIds = conflictEntries.map((entry) => getContentId(entry));

  const entryPrompts = conflictEntries
    .map((dest) => {
      const source = sourceEntries.find((entry) => getContentId(entry) === getContentId(dest));
      return diff(source, dest, contentTypes);
    })
    .filter((v) => v);

  let entryOverwrites = {};
  if (diffConflicts) {
    entryOverwrites = await inquirer.prompt(entryPrompts);
  } else if (forceOverwrite) {
    entryOverwrites = entryPrompts.reduce((result, { name }) => ({ ...result, [name]: true }), {});
  } else {
    entryOverwrites = entryPrompts.reduce((result, { name }) => ({ ...result, [name]: false }), {});
  }

  const skipEntryIds = conflictEntryIds.filter((id) => {
    const { [id]: overwrite } = entryOverwrites;
    return !overwrite;
  });

  return sourceEntries.filter((entry) => !skipEntryIds.includes(getContentId(entry)));
};

/**
 * Transfer content from one environment to another one
 * @param {Object} config The config object including all required data
 */
const transferContent = async (config) => {
  const {
    verbose,
    diffConflicts,
    forceOverwrite,
    sourceEnvironment,
    destEnvironment,
    spaceId,
    contentType,
    accessToken: managementToken,
  } = config || {};
  // Check migration version
  const sourceVersion = await getMigrationVersion({ ...config, environment: sourceEnvironment });
  const destVersion = await getMigrationVersion({ ...config, environment: destEnvironment });

  if (sourceVersion !== destVersion) {
    throw new Error(
      `Different migration states detected. ${chalk.bold(sourceEnvironment)} (${sourceVersion}) !== ${chalk.bold(
        destEnvironment
      )} (${destVersion})`
    );
  }

  // Get content from source environment (all + filtered by passed contentType)
  console.log(`\nFetching content from ${chalk.green(sourceEnvironment)} environment`);
  const {
    entries: sourceEntries,
    assets: sourceAssetsBase,
    filteredEntries,
    contentTypes: sourceContentTypes,
  } = await getContent({
    ...config,
    environment: sourceEnvironment,
  });

  console.log(`Fetching content from ${chalk.green(destEnvironment)} environment\n`);
  const {
    entries: destEntries,
    assets: destAssets,
    contentTypes: destContentTypes,
  } = await getContent({
    ...config,
    environment: destEnvironment,
  });

  // Find changed entries
  let entries = [];
  if (contentType) {
    // Filter unchanged entries from filtered entries
    const filteredResolved = await resolveConflicts(filteredEntries, destEntries, {
      contentTypes: destContentTypes,
      diffConflicts,
      forceOverwrite,
    });

    // Filter unchanged entries from all source entries and store ids
    const changedEntries = await resolveConflicts(sourceEntries, destEntries, {
      contentTypes: destContentTypes,
      diffConflicts: false,
      forceOverwrite: false,
    });
    const changedEntryIds = changedEntries.map((entry) => getContentId(entry));

    // Get all changed linked entries from filtered entries recursive until we find an unchanged entry
    const linkedEntries = getLinkedEntries(filteredResolved, sourceEntries, { includeIds: changedEntryIds });

    // Resolve changed linked entries
    const linkedResolved = await resolveConflicts(linkedEntries, destEntries, {
      contentTypes: destContentTypes,
      diffConflicts,
      forceOverwrite,
    });

    entries = [...filteredResolved, ...linkedResolved];
  } else {
    entries = await resolveConflicts(sourceEntries, destEntries, {
      contentTypes: destContentTypes,
      diffConflicts,
      forceOverwrite,
    });
  }

  // Find conflicting assets
  const sourceAssets = getLinkedAssets(entries, sourceAssetsBase);
  const assets = await resolveConflicts(sourceAssets, destAssets, {
    diffConflicts,
    forceOverwrite,
  });

  // just a small helper to add a line break after the inquiry
  const br = diffConflicts && (Object.keys(assetOverwrites).length || Object.keys(entryOverwrites).length) ? '\n' : '';

  if (assets.length === 0 && entries.length === 0) {
    console.log(chalk.green(`${br}All done`), '🚀');
    return;
  }

  if (verbose) {
    const tree = buildTree({ contentTypes: destContentTypes, entries, assets });
    console.log(tree + '\n');
  }

  console.log(
    `${br}Transfering ${chalk.cyan(`${entries.length} Entries`)} and ${chalk.cyan(
      `${assets.length} Assets`
    )} from ${chalk.cyan(sourceEnvironment)} to ${chalk.cyan(destEnvironment)}`
  );

  const { proceed } = await inquirer.prompt([
    {
      type: 'confirm',
      message: 'Do you wish to proceed?',
      default: true,
      name: 'proceed',
    },
  ]);

  if (proceed !== true) {
    return;
  }

  try {
    await contentfulImport({
      spaceId,
      managementToken,
      environmentId: destEnvironment,
      skipContentModel: true,
      content: { entries, assets },
    });
  } catch (error) {
    console.log(error.message);
  }

  console.log(chalk.green('\nAll done'), '🚀');
};

module.exports.fetchMigration = fetchMigration;
module.exports.createMigration = createMigration;
module.exports.runMigrations = runMigrations;
module.exports.executeMigration = executeMigration;
module.exports.transferContent = transferContent;
module.exports.initializeContentModel = initializeContentModel;
module.exports.migrateToContentStrategy = migrateToContentStrategy;
module.exports.migrateToTagStrategy = migrateToTagStrategy;
module.exports.versionAdd = versionAdd;
module.exports.versionDelete = versionDelete;

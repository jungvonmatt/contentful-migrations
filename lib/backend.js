const path = require('path');
const fs = require('fs/promises');
const pc = require('picocolors');
const cliProgress = require('cli-progress');
const { getEnvironment, getDefaultLocale, getMigrationItems } = require('./contentful');
const { STORAGE_TAG, STORAGE_CONTENT, STATE_SUCCESS, STATE_FAILURE } = require('./config');

/**
 * Create contentful-migrations content-type
 * @param {Object} config The config object including all required data
 */
const initializeContentModel = async (config) => {
  const { migrationContentTypeId } = config;
  const client = await getEnvironment(config);
  const environmentId = client.sys.id;
  const { items: contentTypes } = await client.getContentTypes();

  const exists = (contentTypes || []).some((contentType) => contentType.sys.id === migrationContentTypeId);

  if (!exists) {
    console.log(
      `\nCreating content-type: ${pc.green(migrationContentTypeId)} in environment ${pc.green(environmentId)}`
    );
    const contentType = await client.createContentTypeWithId(migrationContentTypeId, {
      name: 'Migrations',
      description: 'Internal data model holding references to all migrations',
      displayField: 'name',
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

    const editorInterface = await client.getEditorInterfaceForContentType(migrationContentTypeId);
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

/**
 * Add migration entry to contentful
 * @param {*} data
 * @param {*} config
 */
const addMigrationEntry = async (data, config) => {
  const { version, name, state, message } = data;

  let { defaultLocale, migrationContentTypeId } = config;
  if (!defaultLocale) {
    defaultLocale = await getDefaultLocale(config);
  }

  const client = await getEnvironment(config);

  let entry;
  try {
    entry = await client.getEntry(version);
  } catch {}

  if (!entry) {
    entry = await client.createEntryWithId(migrationContentTypeId, version, {
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
    if (state === STATE_SUCCESS) {
      await entry.publish();
    }
  }
};

/**
 * Set migration version in meta object
 * @param {Number} version Migration Version
 * @param {Object} config The config object including all required data
 */
const setMigrationTag = async (version, config) => {
  const { fieldId } = config || {};
  const client = await getEnvironment(config);
  try {
    const migrationTag = await client.getTag(fieldId);
    if (migrationTag) {
      migrationTag.name = `${version}`;
      await migrationTag.update();
      return;
    }
  } catch {}

  await client.createTag(fieldId, `${version}`);
};

/**
 * Store migration reference in contentful
 * @param {Object} data Migration data
 * @param {Object} config The config object including all required data
 * @returns
 */
const storeMigration = (data, config) => {
  const { version, state = STATE_SUCCESS } = data;
  const { storage = STORAGE_TAG } = config;

  if (storage === STORAGE_CONTENT) {
    return addMigrationEntry(data, config);
  }

  if (state === STATE_SUCCESS) {
    return setMigrationTag(version, config);
  }
};

/**
 * Run operations to switch from tag storage to content-type storage
 * @param {Object} config The config object including all required data
 */
const migrateToContentStorage = async (config) => {
  const { directory, fieldId } = config || {};
  let { defaultLocale } = config;
  if (!defaultLocale) {
    defaultLocale = await getDefaultLocale(config);
  }

  const client = await getEnvironment(config);
  const version = await getMigrationVersionFromTag(config);

  const { globby } = await import('globby');
  const migrations = await globby([`${directory}/*.js`, `${directory}/*.cjs`]);
  const environmentId = client.sys.id;
  const filtered = migrations.filter((file) => {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    return version && parseInt(version, 10) >= parseInt(num, 10);
  });

  console.log(`\nFound ${pc.green(filtered.length)} executed migrations in environment ${pc.green(environmentId)}`);

  const bar = new cliProgress.SingleBar(
    { format: 'Adding content-entries: {value}/{total} | ETA: {eta}s' },
    cliProgress.Presets.legacy
  );
  let progress = 0;

  bar.start(filtered.length, 0);
  for await (const file of filtered) {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    await addMigrationEntry({ version: num, name, state: STATE_SUCCESS }, config);
    progress++;
    bar.update(progress);
  }
  bar.stop();

  if (fieldId) {
    try {
      const migrationTag = await client.getTag(fieldId);
      await migrationTag.delete();
    } catch {}
  }
  console.log('All done 👍🏼');
};

/**
 * Run operations to switch from content-type storage to tag storage.
 * @param {Object} config The config object including all required data
 */
const migrateToTagStorage = async (config) => {
  const { migrationContentTypeId, fieldId } = config;
  const defaultLocale = await getDefaultLocale(config);
  const oldVersion = await getMigrationVersionFromTag(config);
  if (migrationContentTypeId) {
    const client = await getEnvironment(config);
    const { items } = await client.getEntries({ content_type: migrationContentTypeId });

    const version =
      items.length &&
      Math.max(
        ...items
          .filter((item) => item?.fields?.state?.[defaultLocale] === STATE_SUCCESS)
          .map((item) => parseInt(item.sys.id, 10))
      );

    if (version && (oldVersion || 0) < version) {
      console.log(`\nAdding ${pc.green(fieldId)} tag with version ${pc.green(version)}`);
      await setMigrationTag(version, config);
    }

    const bar = new cliProgress.SingleBar(
      { format: 'Removing content-entries: {value}/{total} | ETA: {eta}s' },
      cliProgress.Presets.legacy
    );
    let progress = 0;

    bar.start(items.length, 0);
    for await (const item of items) {
      const entry = await client.getEntry(item.sys.id);
      try {
        await entry.unpublish();
      } catch {}
      await entry.delete();
      progress++;
      bar.update(progress);
    }
    bar.stop();

    const contentType = await client.getContentType(migrationContentTypeId);
    if (contentType) {
      await contentType.unpublish();
      await contentType.delete();
    }
  }

  console.log('All done 👍🏼');
};

/**
 * Get all migration versions from contentful entries
 * @param {Object} config The config object including all required data
 * @returns {number[]}
 */
const getMigrationVersions = async (config) => {
  const items = await getMigrationItems(config);

  return (items || []).map((item) => parseInt(item.sys.id, 10));
};

/**
 * Get migration version from the currewnt encvironment stored in the meta object
 * @param {Object} config The config object including all required data
 * @returns {number}
 */
const getMigrationVersionFromTag = async (config) => {
  const { contentTypeId, fieldId } = config || {};
  const client = await getEnvironment(config);

  // try to get migration version from tags
  try {
    const migrationTag = await client.getTag(fieldId);
    return parseInt(migrationTag.name || 0, 10);
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
        return parseInt(value || 0, 10);
      }
      return result;
    }, undefined);
  } catch {}

  return;
};

/**
 *
 * @param {Object} config The config object including all required data
 * @returns {number}
 */
const getLatestVersion = async (config) => {
  const { storage } = config;
  if (storage === STORAGE_CONTENT) {
    try {
      const versions = await getMigrationVersions(config);
      return Math.max(...versions);
    } catch {}
  }

  return getMigrationVersionFromTag(config);
};

const getVersionFromFile = (file) => {
  const name = path.basename(file);
  const [, num] = /^(\d+)-/.exec(name);
  return parseInt(num, 10);
};

/**
 * Get all unexecuted migration files
 * @param {Object} config The config object including all required data
 */
const getNewMigrations = async (config) => {
  const { directory, storage, migrationContentTypeId } = config || {};
  const { globby } = await import('globby');
  const migrations = (await globby([`${directory}/*.js`, `${directory}/*.cjs`])).sort((a, b) => {
    const numA = getVersionFromFile(a);
    const numB = getVersionFromFile(b);
    return numA - numB;
  });

  if (storage === STORAGE_CONTENT) {
    try {
      const versions = await getMigrationVersions(config);
      const result = migrations.filter((file) => {
        const num = getVersionFromFile(file);
        return !(versions || []).includes(num);
      });

      return result;
    } catch (error) {
      // check if we have a migration scheduled which adds the initial content-type
      const regexp = new RegExp(`createContentType\\(['"]${migrationContentTypeId}['"]\\)`, 'mg');
      const initial = (
        await Promise.all(
          migrations.map(async (file) => {
            return fs.readFile(file, 'utf8');
          })
        )
      ).some((content) => regexp.test(content));

      if (initial) {
        return migrations;
      }
      console.error(pc.red('\nError:'), `Missing migration content type. Run ${pc.cyan('npx migrations init')}`);
      process.exit(1);
    }
  }

  const version = await getMigrationVersionFromTag(config);
  return migrations.filter((file) => {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    return !version || parseInt(version, 10) < parseInt(num, 10);
  });
};

module.exports.initializeContentModel = initializeContentModel;
module.exports.migrateToContentStorage = migrateToContentStorage;
module.exports.migrateToTagStorage = migrateToTagStorage;
module.exports.getMigrationVersions = getMigrationVersions;
module.exports.getMigrationVersionFromTag = getMigrationVersionFromTag;
module.exports.getLatestVersion = getLatestVersion;
module.exports.storeMigration = storeMigration;
module.exports.getNewMigrations = getNewMigrations;

const fs = require('fs-extra');
const path = require('path');
const { stripIndent } = require('common-tags');
const runMigration = require('contentful-migration/built/bin/cli').runMigration;
const {
  getContentTypes,
  generateMigrationScript,
} = require('contentful-cli/lib/cmds/space_cmds/generate_cmds/migration');
const globby = require('globby');
const chalk = require('chalk');
const { getEnvironment } = require('./contentful');

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
  const locale = await getDefaultLocale(config);
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
};

/**
 * Set migration version in meta object
 * @param {Object} config The config object including all required data
 * @param {Number} version Migration Version
 */
const setMigrationVersion = async (config, version) => {
  const { contentTypeId, fieldId } = config || {};
  const client = await getEnvironment(config);
  const locale = await getDefaultLocale(config);

  const { items } = await client.getEntries({
    content_type: contentTypeId,
  });

  const item =
    (items || []).find((item) => {
      const { fields } = item || {};
      return Object.keys(fields).includes(fieldId);
    }) || items[0];

  if (item) {
    item.fields[fieldId] = { [locale]: version };
    console.log(item.fields[fieldId]);
    return item.update();
  } else if (items.length === 0) {
    console.log(`Could not save migration because no content of type "${contentTypeId}" exists`);
  } else {
    console.log('Could not save migration version', items);
  }
};

const checkInitialMigration = async (config) => {
  const { contentTypeId, fieldId, directory } = config || {};
  let version;
  try {
    version = await getMigrationVersion(config);
  } catch (error) {}

  // Add initial migration file which adds the migration field to contentful
  const initialFilename = path.join(directory, '0-initial-migration.js');
  if (typeof version === 'undefined' && !fs.existsSync(initialFilename)) {
    const initialMigrationContent = stripIndent`
      /* eslint-env node */

      /**
       * Initial contentful migration
       * Adds the ${fieldId} field to the ${contentTypeId} content-type
       * DO NOT DELETE !!!
       */
      module.exports = async function (migration, { makeRequest }) {
        // Make a request to  check if the content-type or the field already exists
        const { items } =
          (await makeRequest({
            method: "GET",
            url: "/content_types?sys.id[in]=${contentTypeId}",
          })) || {};

        const [contentType] = items || [];
        const { fields } = contentType || {};
        const fieldExists = (fields || []).some((field) => field.id === "${fieldId}");

        if (!fieldExists) {
          const ct = contentType
            ? migration.editContentType("${contentTypeId}")
            : migration.createContentType("${contentTypeId}", { name: "${contentTypeId}" });

          ct.createField("${fieldId}", {
            name: "Migration Version",
            type: "Symbol",
            localized: false,
            required: false,
            validations: [],
            disabled: true,
            omitted: false,
          });
        }
      };
    `;

    await fs.outputFile(initialFilename, initialMigrationContent);
    console.log(`Generated initial migration file to ${chalk.green(initialFilename)}`);
  }
};

/**
 * Create new migration file.
 * Adds initial migration file adding the migration field in the content type
 * @param {Object} config The config object including all required data
 */
const createMigration = async (config) => {
  const { contentTypeId, fieldId, directory } = config || {};
  await checkInitialMigration(config);

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

/**
 *
 * @param {Object} config The config object including all required data
 */
const runMigrations = async (config) => {
  const { directory, accessToken, spaceId } = config || {};

  const client = await getEnvironment(config);
  const version = await getMigrationVersion(config);
  const migrations = await globby(`${directory}/*.js`);
  const environmentId = client.sys.id;
  const filtered = migrations.filter((file) => {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    return !version || parseInt(version, 10) < parseInt(num, 10);
  });

  console.log(
    `Found ${chalk.green(filtered.length)} unexecuted migrations in environment ${chalk.green(environmentId)}`
  );

  let migrationVersion = 0;
  for (const file of filtered) {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    const options = {
      filePath: file,
      accessToken,
      spaceId,
      environmentId,
      yes: true,
    };

    console.log(`Run migration ${chalk.green(num)} ...`);
    await runMigration(options);
    migrationVersion = num;
  }

  if (filtered.length) {
    await setMigrationVersion(config, migrationVersion);
  }

  console.log(chalk.green('\nAll done'), '🚀');
};

/**
 *  Fetch migration from contentful
 * @param {Object} config The config object including all required data
 */
const fetchMigration = async (config) => {
  const { contentType, directory } = config || {};
  const client = await getEnvironment(config);
  await checkInitialMigration(config);

  const timestamp = Date.now();
  const filename = path.join(directory, `${timestamp}-create-${contentType}-migration.js`);

  const contentTypes = await getContentTypes(client, contentType);
  const content = await generateMigrationScript(client, contentTypes);

  await fs.outputFile(filename, content);
  console.log(`Generated new migration file to ${chalk.green(filename)}`);
};

module.exports.fetchMigration = fetchMigration;
module.exports.createMigration = createMigration;
module.exports.runMigrations = runMigrations;

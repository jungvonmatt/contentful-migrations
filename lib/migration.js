const fs = require('fs-extra');
const path = require('path');
const { promisify } = require('util');
const { stripIndent } = require('common-tags');
const contentful = require('contentful-management');
const runMigration = require('contentful-migration/built/bin/cli').runMigration;
const mergeOptions = require('merge-options').bind({ ignoreUndefined: true });
const { cosmiconfig } = require('cosmiconfig');
const explorer = cosmiconfig('migrations');

const DEFAULT_ENVIRONMENT = 'master';

/**
 * Get migration version from the currewnt encvironment stored in the meta object
 * @param {String} env Environmemnt id
 * @returns {String}
 */
const getMigrationVersion = async (config) => {
  const client = await getEnvironment(config);

  const { items } = await client.getEntries({
    content_type: MIGRATION_CONFIG_CT,
  });

  return (items || []).reduce(async (result, item) => {
    const { fields } = item || {};

    if (Object.keys(fields).includes(MIGRATION_FIELD_ID)) {
      return fields[MIGRATION_FIELD_ID]['de'] || 0;
    }
    return result;
  }, undefined);
};

/**
 * Set migration version in meta object
 * @param {String} env Environmemnt id
 * @param {Number} version Migration Version
 */
const setMigrationVersion = async (config, version) => {
  const client = await getClient(config);

  const { items } = await client.getEntries({
    content_type: MIGRATION_CONFIG_CT,
  });

  const item =
    (items || []).find((item) => {
      const { fields } = item || {};
      return Object.keys(fields).includes(MIGRATION_FIELD_ID);
    }) || items[0];

  if (item) {
    item.fields[MIGRATION_FIELD_ID] = { de: version };
    return item.update();
  } else {
    console.log('Could not save migration version', items);
  }
};

const createMigration = async (config) => {
  const version = await getMigrationVersion(config);
  const initialFilename = path.join(dir, '0-initial-migration.js');
  // Add initial migration file which adds the migration firld to contentful
  if (typeof version === 'undefined' && !fs.existsSync(initialFilename)) {
    const initialMigrationContent = stripIndent`
      /* eslint-env node */

      /**
       * Initial contentful migration
       * Adds the ${MIGRATION_FIELD_ID} field to the ${MIGRATION_CONFIG_CT} content-type
       * DO NOT DELETE !!!
       */
      module.exports = function(migration /*, context */) {
        const ct = migration.editContentType('${MIGRATION_CONFIG_CT}')

        ct.createField('${MIGRATION_FIELD_ID}', {
          name: 'Migration Version',
          type: 'Symbol',
          localized: false,
          required: false,
          validations: [],
          disabled: true,
          omitted: false,
        })
      }
    `;

    await fs.outputFile(initialFilename, initialMigrationContent);
    console.log(`Generated initial migration file to ${chalk.green(initialFilename)}`);
  }

  const timestamp = Date.now();
  const filename = path.join(dir, `${timestamp}-migration.js`);
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

const runMigrations = async (config) => {
  const version = await getMigrationVersion(config);

  const migrations = await globby(`${dir}/*.js`);

  const filtered = migrations.filter((file) => {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    return !version || parseInt(version, 10) < parseInt(num, 10);
  });

  console.log(`Found ${chalk.green(filtered.length)} unexecuted migrations`);

  let migrationVersion = 0;
  for (const file of filtered) {
    const name = path.basename(file);
    const [, num] = /^(\d+)-/.exec(name);

    const options = {
      filePath: file,
      accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
      spaceId: process.env.CONTENTFUL_SPACE_ID,
      environmentId: env,
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

module.exports.createMigration = createMigration;
module.exports.runMigrations = runMigrations;

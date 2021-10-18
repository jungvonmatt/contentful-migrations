const fs = require('fs-extra');
const path = require('path');
const { stripIndent } = require('common-tags');
const runMigration = require('contentful-migration/built/bin/cli').runMigration;
const {
  getContentTypes,
  generateMigrationScript,
} = require('contentful-cli/lib/cmds/space_cmds/generate_cmds/migration');
const chalk = require('chalk');
const { getEnvironment } = require('./contentful');

const { STATE_SUCCESS, STATE_FAILURE } = require('./config');

const { storeMigration, getNewMigrations } = require('./backend');

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

/**
 * Execute a single migration
 * @param {string} file Path to the migration file
 * @param {Object} config The config object including all required data
 * @returns
 */
const executeMigration = async (file, config) => {
  const { accessToken, spaceId } = config || {};
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
    await storeMigration({ version, name, state: STATE_SUCCESS }, config);
  } catch (error) {
    const message = (error.errors || [error]).map((error) => error.message).join('\n');
    await storeMigration({ version, name, state: STATE_FAILURE, message }, config);

    throw error;
  }

  return version;
};

/**
 *
 * @param {Object} config The config object including all required data
 */
const runMigrations = async (config) => {
  const { bail } = config || {};

  const client = await getEnvironment(config);
  const environmentId = client.sys.id;
  console.log('TEST 1');
  const migrations = await getNewMigrations(config);
  console.log('TEST 2', migrations);
  console.log(
    `Found ${chalk.green(migrations.length)} unexecuted migrations in environment ${chalk.green(environmentId)}`
  );

  let migrationVersion = 0;
  for await (const file of migrations) {
    try {
      migrationVersion = await executeMigration(file, config);
    } catch (error) {
      if (bail) {
        throw error;
      }
    }
  }

  console.log(chalk.green('\nAll done'), '🚀');
};

module.exports.fetchMigration = fetchMigration;
module.exports.createMigration = createMigration;
module.exports.runMigrations = runMigrations;
module.exports.executeMigration = executeMigration;

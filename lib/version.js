const path = require('path');
const chalk = require('chalk');
const { storeMigration } = require('./backend');
const { getEnvironment } = require('./contentful');
const { STORAGE_TAG, STATE_SUCCESS } = require('./config');

/**
 * Add a content entry for a single migration file
 * @param {string} file Path to the migration file
 * @param {Object} config The config object including all required data
 */
const versionAdd = async (file, config) => {
  const { storage } = config || {};
  if (storage === STORAGE_TAG) {
    throw new Error('The version command is not available for the "tag" storage');
  }

  const name = path.basename(file);
  const [, version] = /^(\d+)-/.exec(name);

  console.log(`\nAdding migration entry ${chalk.green(version)} ...`);
  await storeMigration({ version, name, state: STATE_SUCCESS, message: 'Manually added' }, config);
  console.log(chalk.green('Done'), '🚀');
};

/**
 * Delete a content entry for a single migration file
 * @param {string} file Path to the migration file
 * @param {Object} config The config object including all required data
 */
const versionDelete = async (file, config) => {
  const { storage } = config || {};
  if (storage === STORAGE_TAG) {
    throw new Error('The version command is not available for the "tag" storage');
  }

  const name = path.basename(file);
  const [, version] = /^(\d+)-/.exec(name);

  console.log(`\nDeleting migration entry ${chalk.green(version)} ...`);
  const client = await getEnvironment(config);

  const entry = await client.getEntry(version);

  await entry.delete();
  console.log(chalk.green('Done'), '🚀');
};

module.exports.versionAdd = versionAdd;
module.exports.versionDelete = versionDelete;

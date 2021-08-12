import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

import inquirer from 'inquirer';
import { stripIndent } from 'common-tags';
import contentfulImport from 'contentful-import';
import { runMigration } from 'contentful-migration/built/bin/cli';
import {
  getContentTypes,
  generateMigrationScript,
} from './node_modules/contentful-cli/lib/cmds/space_cmds/generate_cmds/migration.js';
import globby from 'globby';
import chalk from 'chalk';

import { diff } from './diff.js';
import { getEnvironment, getContent, getContentId, getLinkedAssets, getLinkedEntries } from './contentful.js';
import { buildTree } from './tree.js';

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
  } catch {
    return;
  }
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
    return item.update();
  } else if (items.length === 0) {
    try {
      const id = crypto.randomBytes(11).toString('hex');
      await client.createEntryWithId(contentTypeId, id, {
        fields: { [fieldId]: { [locale]: version } },
      });
    } catch (error) {
      console.log(`Could not save migration because no content of type "${contentTypeId}" exists`);
      console.log(
        `Make sure you create a new ${chalk.cyan(contentTypeId)} object and set the field value of ${chalk.cyan(
          fieldId
        )} to ${chalk.cyan(version)}`
      );
    }
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
export const createMigration = async (config) => {
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
export const runMigrations = async (config) => {
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

    console.log(`\nRun migration ${chalk.green(num)} ...`);
    try {
      await runMigration(options);
    } catch (error) {
      if (migrationVersion) {
        await setMigrationVersion(config, migrationVersion);
      }
      throw error;
    }

    migrationVersion = num;
  }

  if (filtered.length) {
    await setMigrationVersion(config, migrationVersion);
  }

  console.log(chalk.green('\nAll done'), '🚀');
};

/**
 * Fetch migration from contentful
 * @param {Object} config The config object including all required data
 */
export const fetchMigration = async (config) => {
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
export const transferContent = async (config) => {
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

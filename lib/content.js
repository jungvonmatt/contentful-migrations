const inquirer = require('inquirer');
const contentfulImport = require('contentful-import');
const chalk = require('chalk');
const { getContent, getContentId, getLinkedAssets, getLinkedEntries } = require('./contentful');
const { diff } = require('./diff');
const { buildTree } = require('./tree');
const { getLatestVersion } = require('./backend');

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
  const sourceVersion = await getLatestVersion({ ...config, environment: sourceEnvironment });
  const destVersion = await getLatestVersion({ ...config, environment: destEnvironment });

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

module.exports.transferContent = transferContent;

#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-env node */
const fs = require('fs-extra');
const path = require('path');
const pkgUp = require('pkg-up');
const chalk = require('chalk');
const { Command } = require('commander');

const {
  createMigration,
  runMigrations,
  fetchMigration,
  transferContent,
  initializeContentModel,
  migrateToContentStrategy,
  migrateToTagStrategy,
  executeMigration,
  versionDelete,
  versionAdd,
} = require('./lib/migration');
const { createOfflineDocs } = require('./lib/doc');
const { getConfig, askAll, askMissing, STRATEGY_CONTENT, STRATEGY_TAG } = require('./lib/config');
const pkg = require('./package.json');

require('dotenv').config();

const parseArgs = (cmd) => {
  const { parent = {} } = cmd || {};
  const directory = cmd.path || parent.path;
  return {
    ...cmd,
    environment: cmd.env || parent.env,
    directory: directory ? path.resolve(directory) : undefined,
    sourceEnvironment: cmd.sourceEnv || parent.sourceEnv,
    destEnvironment: cmd.destEnv || parent.destEnv,
    verbose: cmd.verbose || parent.verbose,
    template: cmd.template || parent.template,
    extension: cmd.extension || parent.extension,
    bail: cmd.bail || parent.bail,
  };
};

const errorHandler = (error, log) => {
  if (log) {
    const { errors, message } = error;
    console.error(chalk.red('\nError:'), message);
    console.log(error);
    (errors || []).forEach((error) => {
      console.error(chalk.red('Error:'), error.message);
    });
  }
  process.exit(1);
};

const actionRunner = (fn, log = true) => {
  return (...args) => fn(...args).catch((error) => errorHandler(error, log));
};

const program = new Command();

program.version(pkg.version);
program
  .command('init')
  .description('Initialize contentful-migrations')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askAll(config);
      const { managementToken, accessToken, environment, ...rest } = verified;

      if (verified.strategy === STRATEGY_CONTENT) {
        await initializeContentModel(verified);
        await migrateToContentStrategy({ ...config, ...verified });
      }
      if (verified.strategy === STRATEGY_TAG) {
        await migrateToTagStrategy({ ...config, ...verified });
      }

      // try to store in package.json
      const localPkg = await pkgUp();
      if (localPkg) {
        const packageJson = await fs.readJson(localPkg);
        rest.directory = path.relative(path.dirname(localPkg), rest.directory);
        packageJson.migrations = rest;
        await fs.outputJson(localPkg, packageJson, { spaces: 2 });
      } else {
        // store in .migrationsrc if no package.json is available
        await fs.outputJson(path.join(process.cwd(), '.migrationsrc'), rest, { spaces: 2 });
      }
    })
  );

program
  .command('fetch')
  .option('-c, --content-type <content-type...>', 'Specify content-types')
  .option('-e, --env <environment>', 'Change the Contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .option('-v, --verbose', 'Verbosity')
  .option('--space-id <space-id>', 'Contentful space id')
  .description('Generated new Contentful migration')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);
      await fetchMigration({ ...verified, contentType: cmd.contentType });
    })
  );

program
  .command('generate')
  .option('-e, --env <environment>', 'Change the Contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .option('-v, --verbose', 'Verbosity')
  .option('--space-id <space-id>', 'Contentful space id')
  .description('Generated new Contentful migration')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);
      await createMigration(verified);
    })
  );

program
  .command('migrate')
  .option('-e, --env <environment>', 'Change the Contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are stored')
  .option('-v, --verbose', 'Verbosity')
  .option('--bail', 'Abort execution after first failed migration (default: true)', true)
  .option('--no-bail', 'Ignore failed migrations')
  .option('--space-id <space-id>', 'Contentful space id')
  .description('Execute all unexecuted migrations available.')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);
      await runMigrations(verified);
    }, false)
  );

program
  .command('execute <file>')
  .option('-e, --env <environment>', 'Change the Contentful environment')
  .option('--space-id <space-id>', 'Contentful space id')
  .description('Execute a single migration.')
  .action(
    actionRunner(async (file, options) => {
      const config = await getConfig(parseArgs(options || {}));
      const verified = await askMissing(config);
      await executeMigration(path.resolve(file), verified);
    }, false)
  );

program
  .command('version <file>')
  .option('-e, --env <environment>', 'Change the Contentful environment')
  .option('--space-id <space-id>', 'Contentful space id')
  .option('--add', 'Mark migration as migrated')
  .option('--delete', 'Delete migration entry in Contentful')
  .description('Manually mark a migration as migrated or not. (Only available with the Content-model strategy)')
  .action(
    actionRunner(async (file, options) => {
      const { delete: deleteVersion, add: addVersion } = options;
      const config = await getConfig(parseArgs(options || {}));
      const verified = await askMissing(config);
      const { strategy } = verified || {};
      if (strategy === STRATEGY_TAG) {
        throw new Error('The version command is not available for the "tag" strategy');
      }
      if (deleteVersion) {
        versionDelete(file, verified);
      } else if (addVersion) {
        versionAdd(file, verified);
      }
    }, false)
  );

program
  .command('doc')
  .option('-e, --env <environment>', 'Change the Contentful environment')
  .option('-p, --path <path/to/docs>', 'Change the path where the docs are stored')
  .option('-v, --verbose', 'Verbosity')
  .option('-t, --template <path/to/template>', 'Use custom template for docs')
  .option('--extension <file-extension>', 'Use custom file extension (default is `md`)')
  .option('--space-id <space-id>', 'Contentful space id')
  .description('Generate offline docs from content-types')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);
      await createOfflineDocs(verified);
    }, true)
  );

program
  .command('content')
  .requiredOption('-s, --source-env <environment>', 'Set the Contentful source environment (from)')
  .requiredOption('-d, --dest-env <environment>', 'Set the Contentful destination environment (to)')
  .option('-c, --content-type <content-type>', 'Specify content-type')
  .option('--diff', 'Manually choose skip/overwrite for every conflict')
  .option('--force', 'No manual diffing. Overwrites all conflicting entries/assets')
  .option('-v, --verbose', 'Verbosity')
  .option('--space-id <space-id>', 'Contentful space id')
  .description('Transfer content from source environment to destination environment')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);

      // run migrations on destination environment
      await transferContent({
        ...verified,
        contentType: cmd.contentType || '',
        forceOverwrite: cmd.force || false,
        diffConflicts: cmd.diff || false,
      });
    })
  );

program.parse(process.argv);

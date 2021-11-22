#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-env node */
const fs = require('fs-extra');
const path = require('path');
const pkgUp = require('pkg-up');
const chalk = require('chalk');
const { Command } = require('commander');

const { initializeContentModel, migrateToContentStorage, migrateToTagStorage } = require('./lib/backend');
const { createMigration, runMigrations, fetchMigration, executeMigration } = require('./lib/migration');
const { versionDelete, versionAdd } = require('./lib/version');
const { transferContent } = require('./lib/content');
const { createOfflineDocs } = require('./lib/doc');
const { createEnvironment, removeEnvironment, resetEnvironment } = require('./lib/environment');
const { getConfig, askAll, askMissing, STORAGE_CONTENT, STORAGE_TAG } = require('./lib/config');
const pkg = require('./package.json');

require('dotenv').config();

const parseArgs = (cmd) => {
  const { parent = {} } = cmd || {};
  const directory = cmd.path || parent.path;
  return {
    ...cmd,
    environment: cmd.env || parent.env,
    directory: directory ? path.resolve(directory) : undefined,
    sourceEnvironmentId: cmd.sourceEnvironmentId || parent.sourceEnvironmentId,
    destEnvironmentId: cmd.destEnvironmentId || parent.destEnvironmentId,
    verbose: cmd.verbose || parent.verbose,
    template: cmd.template || parent.template,
    yes: cmd.yes || parent.yes,
    extension: cmd.extension || parent.extension,
    bail: cmd.bail || parent.bail,
  };
};

const errorHandler = (error, log) => {
  if (log) {
    const { errors, message } = error;
    console.error(chalk.red('\nError:'), message);
    (errors || []).forEach((error) => {
      console.error(chalk.red('Error:'), error.message);
    });
  }
  process.exit(1);
};

const actionRunner = (fn, log = true) => {
  return (...args) => {
    const verbose = args.some((arg) => arg.verbose);
    return fn(...args).catch((error) => errorHandler(error, verbose || log));
  };
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
      const { managementToken, accessToken, environmentId, spaceId, ...rest } = verified;

      if (verified.storage === STORAGE_CONTENT) {
        await initializeContentModel({ ...config, ...verified });
        await migrateToContentStorage({ ...config, ...verified });
      }
      if (verified.storage === STORAGE_TAG) {
        await migrateToTagStorage({ ...config, ...verified });
      }

      if (!process.env.CONTENTFUL_SPACE_ID) {
        rest.spaceId = spaceId;
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
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-e, --environment-id <environment-id>', 'Change the Contentful environment')
  .option('-c, --content-type <content-type...>', 'Specify content-types')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .option('-v, --verbose', 'Verbosity')
  .description('Generated new Contentful migration from content type')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);
      await fetchMigration({ ...verified, contentType: cmd.contentType });
    })
  );

program
  .command('generate')
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-e, --environment-id <environment-id>', 'Change the Contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .option('-v, --verbose', 'Verbosity')
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
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-e, --environment-id <environment-id>', 'Change the Contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are stored')
  .option('-v, --verbose', 'Verbosity')
  .option('-y, --yes', 'Assume "yes" as answer to all prompts and run non-interactively.')
  .option('--bail', 'Abort execution after first failed migration (default: true)', true)
  .option('--no-bail', 'Ignore failed migrations')
  .description('Execute all unexecuted migrations available.')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config);

      const { missingStorageModel } = verified;
      if (missingStorageModel) {
        console.error(
          chalk.red('\nError:'),
          `Missing migration content type. Run ${chalk.cyan('npx migrations init')}`
        );
        process.exit(1);
      }

      await runMigrations(verified);
    }, false)
  );

program
  .command('execute <file>')
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-e, --environment-id <environment-id>', 'Change the Contentful environment')
  .option('-v, --verbose', 'Verbosity')
  .option('-y, --yes', 'Assume "yes" as answer to all prompts and run non-interactively.')
  .description('Execute a single migration.')
  .action(
    actionRunner(async (file, options) => {
      const config = await getConfig(parseArgs(options || {}));
      const verified = await askMissing(config);

      const { missingStorageModel } = verified;
      if (missingStorageModel) {
        console.error(
          chalk.red('\nError:'),
          `Missing migration content type. Run ${chalk.cyan('npx migrations init')}`
        );
        process.exit(1);
      }

      await executeMigration(path.resolve(file), verified);
    }, false)
  );

program
  .command('version <file>')
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-e, --environment-id <environment-id>', 'Change the Contentful environment')
  .option('-v, --verbose', 'Verbosity')
  .option('--add', 'Mark migration as migrated')
  .option('--remove', 'Delete migration entry in Contentful')
  .description('Manually mark a migration as migrated or not. (Only available with the Content-model storage)')
  .action(
    actionRunner(async (file, options) => {
      const { remove, add } = options;
      const config = await getConfig(parseArgs(options || {}));
      const verified = await askMissing(config);

      const { missingStorageModel } = verified;
      if (missingStorageModel) {
        console.error(
          chalk.red('\nError:'),
          `Missing migration content type. Run ${chalk.cyan('npx migrations init')}`
        );
        process.exit(1);
      }

      const { storage } = verified || {};
      if (storage === STORAGE_TAG) {
        throw new Error('The version command is not available for the "tag" storage');
      }
      if (remove) {
        await versionDelete(file, verified);
      } else if (add) {
        await versionAdd(file, verified);
      }
    }, true)
  );

program
  .command('environment <environment-id>')
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-v, --verbose', 'Verbosity')
  .option('--create', 'Create new contentful environment')
  .option('--remove', 'Delete contentful environment')
  .option('--reset', 'Reset contentful environment')
  .option('--source-environment-id <environment-id>', 'Set the source environment to clone new environment from')
  .description('Add or remove a contentful environment for migrations')
  .action(
    actionRunner(async (environmentId, options) => {
      const { remove, create, reset } = options;
      const config = await getConfig(parseArgs({ ...(options || {}), environmentId }));
      const verified = await askMissing(config, ['accessToken', 'spaceId', 'environmentId']);

      if (create) {
        return createEnvironment(environmentId, verified);
      }

      if (remove) {
        return removeEnvironment(environmentId, verified);
      }

      if (reset) {
        return resetEnvironment(environmentId, verified);
      }
    }, true)
  );

program
  .command('doc')
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-e, --environment-id <environment-id>', 'Change the Contentful environment')
  .option('-p, --path <path/to/docs>', 'Change the path where the docs are stored')
  .option('-v, --verbose', 'Verbosity')
  .option('-t, --template <path/to/template>', 'Use custom template for docs')
  .option('--extension <file-extension>', 'Use custom file extension (default is `md`)')
  .description('Generate offline docs from content-types')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing(config, ['accessToken', 'spaceId', 'environmentId']);
      await createOfflineDocs(verified);
    }, true)
  );

program
  .command('content')
  .requiredOption('--source-environment-id <environment-id>', 'Set the Contentful source environment (from)')
  .requiredOption('--dest-environment-id <environment-id>', 'Set the Contentful destination environment (to)')
  .option('-s, --space-id <space-id>', 'Contentful space id')
  .option('-c, --content-type <content-type>', 'Specify content-type')
  .option('-v, --verbose', 'Verbosity')
  .option('-y, --yes', 'Assume "yes" as answer to all prompts and run non-interactively.')
  .option('--diff', 'Manually choose skip/overwrite for every conflict')
  .option('--force', 'No manual diffing. Overwrites all conflicting entries/assets')
  .description('Transfer content from source environment to destination environment')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd || {}));
      const verified = await askMissing({ ...config, environmentId: 'not-used' });

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

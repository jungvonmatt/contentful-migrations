#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-env node */
const fs = require('fs-extra');
const path = require('path');
const pkgUp = require('pkg-up');
const chalk = require('chalk');
const { createMigration, runMigrations, fetchMigration, transferContent } = require('./lib/migration');
const { getConfig, askAll, askMissing } = require('./lib/config');
const pkg = require('./package.json');

require('dotenv').config();

const parseArgs = (cmd) => {
  const directory = cmd.path || cmd.parent.path;
  return {
    environment: cmd.env || cmd.parent.env,
    directory: directory ? path.resolve(directory) : undefined,
    sourceEnvironment: cmd.sourceEnv || cmd.parent.sourceEnv,
    destEnvironment: cmd.destEnv || cmd.parent.destEnv,
    verbose: cmd.verbose || cmd.parent.verbose,
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
  return (...args) => fn(...args).catch((error) => errorHandler(error, log));
};

const program = require('commander');
program.version(pkg.version);
program
  .command('init')
  .description('Initialize contentful-migrations')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd));
      const verified = await askAll(config);
      const { managementToken, accessToken, environment, ...rest } = verified;

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
  .requiredOption('-c, --content-type <content-type>', 'Specify content-type')
  .option('-e, --env <environment>', 'Change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .option('-v, --verbose', 'Verbosity')
  .description('Generated new contentful migration')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd));
      const verified = await askMissing(config);
      await fetchMigration({ ...verified, contentType: cmd.contentType });
    })
  );

program
  .command('generate')
  .option('-e, --env <environment>', 'Change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .option('-v, --verbose', 'Verbosity')
  .description('Generated new contentful migration')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd));
      const verified = await askMissing(config);
      await createMigration(verified);
    })
  );

program
  .command('migrate')
  .option('-e, --env <environment>', 'Change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are stored')
  .option('-v, --verbose', 'Verbosity')
  .description('Execute all unexecuted migrations available.')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd));
      const verified = await askMissing(config);
      await runMigrations(verified);
    }, false)
  );

program
  .command('content')
  .requiredOption('-s, --source-env <environment>', 'Set the contentful source environment (from)')
  .requiredOption('-d, --dest-env <environment>', 'Set the contentful destination environment (to)')
  .option('-c, --content-type <content-type>', 'Specify content-type')
  .option('--diff', 'Manually choose skip/overwrite for every conflict')
  .option('--force', 'No manual diffing. Overwrites all conflicting entries/assets')
  .option('-v, --verbose', 'Verbosity')
  .description('Transfer content from source environment to destination environment')
  .action(
    actionRunner(async (cmd) => {
      const config = await getConfig(parseArgs(cmd));
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

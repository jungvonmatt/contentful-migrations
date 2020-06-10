#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-env node */
const fs = require('fs-extra');
const path = require('path');
const pkgUp = require('pkg-up');
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
  };
};

const program = require('commander');
program.version(pkg.version);
program
  .command('init')
  .description('Initialize contentful-migrations')
  .action(async (cmd) => {
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
  });

program
  .command('fetch')
  .requiredOption('-c, --content-type <content-type>', 'Specify content-type')
  .option('-e, --env <environment>', 'Change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .description('Generated new contentful migration')
  .action(async (cmd) => {
    const config = await getConfig(parseArgs(cmd));
    const verified = await askMissing(config);
    await fetchMigration({ ...verified, contentType: cmd.contentType });
  });

program
  .command('generate')
  .option('-e, --env <environment>', 'Change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are saved')
  .description('Generated new contentful migration')
  .action(async (cmd) => {
    const config = await getConfig(parseArgs(cmd));
    const verified = await askMissing(config);
    await createMigration(verified);
  });

program
  .command('migrate')
  .option('-e, --env <environment>', 'Change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'Change the path where the migrations are stored')
  .description('Execute all unexecuted migrations available.')
  .action(async (cmd) => {
    const config = await getConfig(parseArgs(cmd));
    const verified = await askMissing(config);
    await runMigrations(verified);
  });

program
  .command('content')
  .requiredOption('-s, --source-env <environment>', 'Set the contentful source environment')
  .requiredOption('-d, --dest-env <environment>', 'Set the contentful destination environment')
  .option('-c, --content-type <content-type>', 'Specify content-type')
  .option('--diff', 'Manually choose skip/overwrite for every conflict')
  .option('--force', 'No manual diffing. Overwrites all conflicting entries/assets')
  .description('Transfer content from one environment to another environment')
  .action(async (cmd) => {
    const config = await getConfig(parseArgs(cmd));
    const verified = await askMissing(config);
    // run migrations on destination environment
    await transferContent({
      ...verified,
      contentType: cmd.contentType || '',
      forceOverwrite: cmd.force || false,
      diffConflicts: cmd.diff || false,
    });
  });

program.parse(process.argv);

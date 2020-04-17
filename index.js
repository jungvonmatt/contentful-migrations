#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-env node */
const fs = require('fs-extra');
const path = require('path');
const pkgUp = require('pkg-up');
const { createMigration, runMigrations } = require('./lib/migration');
const { getConfig, askAll, askMissing } = require('./lib/config');
const pkg = require('./package.json');

require('dotenv').config();

const parseArgs = (cmd) => {
  const directory = cmd.path || cmd.parent.path;

  return {
    environment: cmd.env || cmd.parent.env,
    directory: directory ? path.resolve(directory) : undefined,
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
    const { managementToken, accessToken, ...rest } = verified;

    console.log('DATA');
    console.log(rest);
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
  .command('generate')
  .option('-e, --env <environment>', 'change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'change the path where the migrations are saved')
  .description('Generated new contentful migration')
  .action(async (cmd) => {
    const config = await getConfig(parseArgs(cmd));
    const verified = await askMissing(config);
    console.log(verified);
    /** run createMigration from index */
  });

program
  .command('migrate')
  .option('-e, --env <environment>', 'change the contentful environment')
  .option('-p, --path <path/to/migrations>', 'change the path where the migrations are saved')
  .description('Execute all unexecuted migrations available.')
  .action(async (cmd) => {
    const config = await getConfig(parseArgs(cmd));
    const verified = await askMissing(config);
    console.log(verified);

    /** run runMigrations from index */
  });

program.parse(process.argv);

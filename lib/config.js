import path from 'path';
import inquirer from 'inquirer';
import load from '@proload/core';
import json from '@proload/plugin-json';
import rc from '@proload/plugin-rc';
import typescript from '@proload/plugin-typescript';
import mergeOptionsModule from 'merge-options';
import branch from 'git-branch';
import { getSpaces, getEnvironments } from './contentful.js';

const mergeOptions = mergeOptionsModule.bind({ ignoreUndefined: true });

load.use([json, typescript, rc]);

/**
 * Get configuration
 * @param {Object} args
 */
export const getConfig = async (args) => {
  const defaultOptions = {
    fieldId: 'migration',
    contentTypeId: 'config',
    fallbackEnvironment: 'master',
    host: 'api.contentful.com',
    directory: path.resolve(process.cwd(), 'migrations'),
  };

  const environmentOptions = {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    environment: process.env.CONTENTFUL_ENVIRONMENT_ID,
    accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  };

  try {
    defaultOptions.branch = await branch();
  } catch (error) {}

  let contentfulCliOptions = {};
  try {
    // get configuration from contentful rc file (created by the contentful cli command)
    const contentfulConfig = await load('contentful', {
      accept(fileName) {
        return fileName.startsWith('.contentfulrc');
      },
    });
    if (contentfulConfig !== null) {
      const { config } = contentfulConfig || {};
      const { managementToken, activeSpaceId, activeEnvironmentId, host } = config || {};
      contentfulCliOptions = {
        spaceId: activeSpaceId,
        accessToken: managementToken,
        host,
      };
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  let configFileOptions = {};
  try {
    // get configuration from migrations rc file
    const migrationsConfig = await load('migrations');
    if (migrationsConfig !== null) {
      const { config, filepath } = migrationsConfig || {};

      configFileOptions = {
        directory: path.resolve(path.dirname(filepath || ''), args.directory || 'migrations'),
        ...(config || {}),
      };

      if (configFileOptions.directory && !path.isAbsolute(configFileOptions.directory)) {
        configFileOptions.directory = path.resolve(path.dirname(filepath || ''), configFileOptions.directory);
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  return mergeOptions(defaultOptions, contentfulCliOptions, environmentOptions, configFileOptions, args || {});
};

const getPromts = (data) => {
  return [
    {
      type: 'input',
      name: 'accessToken',
      message: 'Management Token',
      default: function () {
        return data.accessToken;
      },
    },
    {
      type: 'list',
      name: 'spaceId',
      message: 'Space ID',
      choices: async (answers) => {
        const spaces = await getSpaces(answers);
        return spaces.map((space) => ({
          name: `${space.name} (${space.sys.id})`,
          value: space.sys.id,
        }));
      },
      default: function () {
        return data.spaceId;
      },
    },
    {
      type: 'list',
      name: 'fallbackEnvironment',
      message: 'Fallback environment',
      choices: async (answers) => {
        const environments = await getEnvironments(answers);
        return environments.map((environment) => environment.sys.id);
      },
      default: function () {
        return data.fallbackEnvironment;
      },
    },
    {
      type: 'input',
      name: 'contentTypeId',
      message: 'Content model to hold the field storing the migration version',
      default: function () {
        return data.contentTypeId;
      },
    },
    {
      type: 'input',
      name: 'fieldId',
      message: 'Id of the field where the the migration version is stored',
      default: function () {
        return data.fieldId;
      },
    },
    {
      type: 'input',
      name: 'directory',
      message: 'Directory where the migrations are stored',
      default: function () {
        return data.directory;
      },
    },
  ];
};

export const askAll = async (data = {}) => {
  console.log('Please verify the following options');

  const answers = await inquirer.prompt(getPromts(data));
  answers.directory = path.resolve(process.cwd(), answers.directory || data.directory);

  return answers;
};

export const askMissing = async (data = {}) => {
  const missingPromts = getPromts(data).filter(({ name }) => !data[name]);
  const answers = await inquirer.prompt(missingPromts);

  return { ...data, ...answers };
};

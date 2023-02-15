const path = require('path');
const inquirer = require('inquirer');
const mergeOptions = require('merge-options').bind({ ignoreUndefined: true });
const { cosmiconfig } = require('cosmiconfig');

const { getSpaces, getEnvironments } = require('./contentful');

const STORAGE_TAG = 'tag';
const STORAGE_CONTENT = 'content';

const STATE_SUCCESS = 'success';
const STATE_FAILURE = 'failure';

/**
 * Get configuration
 * @param {Object} args
 */
const getConfig = async (args) => {
  const defaultOptions = {
    fieldId: 'migration',
    migrationContentTypeId: 'contentful-migrations',
    host: 'api.contentful.com',
    directory: path.resolve(process.cwd(), 'migrations'),
  };

  const environmentOptions = {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    environmentId: process.env.CONTENTFUL_ENVIRONMENT_ID,
    accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
  };

  let contentfulCliOptions = {};
  try {
    // get configuration from contentful rc file (created by the contentful cli command)
    const explorer = cosmiconfig('contentful');
    const explorerResult = await explorer.search();
    if (explorerResult !== null) {
      const { config } = explorerResult || {};
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
    const explorer = cosmiconfig('migrations');
    const explorerResult = args.configFile ? await explorer.load(args.configFile) : await explorer.search();
    if (explorerResult !== null) {
      const { config, filepath } = explorerResult || {};

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
        const spaces = await getSpaces({ ...(data || {}), ...answers });
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
      name: 'environmentId',
      message: 'Environment ID',
      choices: async (answers) => {
        const environments = await getEnvironments({ ...(data || {}), ...answers });
        return environments.map((environment) => environment.sys.id);
      },
      default: function () {
        return data.environmentId;
      },
    },
    {
      type: 'list',
      name: 'storage',
      message: 'How do should the migrations be managed',
      choices: [
        {
          name: 'Content-model (recommended)',
          value: STORAGE_CONTENT,
        },
        {
          name: 'Tag',
          value: STORAGE_TAG,
        },
      ],
      default: function () {
        return data.fieldId;
      },
    },
    {
      type: 'input',
      name: 'fieldId',
      message: 'Id of the tag where the the migration version is stored',
      when(answers) {
        return answers.storage === STORAGE_TAG;
      },
      default: function () {
        return data.fieldId;
      },
    },
    {
      type: 'input',
      name: 'migrationContentTypeId',
      message: 'Id of the content-type where the the migrations are stored',
      when(answers) {
        return answers.storage === STORAGE_CONTENT;
      },
      default: function () {
        return data.migrationContentTypeId;
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

const askAll = async (data = {}) => {
  console.log('Please verify the following options');

  const answers = await inquirer.prompt(getPromts(data));
  answers.directory = path.resolve(process.cwd(), answers.directory || data.directory);

  return answers;
};

const askMissing = async (data = {}, requiredFields = undefined) => {
  const allQuestions = getPromts(data);
  if (!requiredFields) {
    requiredFields = allQuestions.map(({ name }) => name);
  }

  const missingPromts = getPromts(data).filter(({ name }) => !data[name] && requiredFields.includes(name));

  // Check if storage changed to content and run initialization
  const missingStorage = missingPromts.some((prompt) => prompt.name === 'storage');
  const answers = await inquirer.prompt(missingPromts);
  const { storage } = answers;

  return { ...data, ...answers, missingStorageModel: missingStorage && storage === STORAGE_CONTENT };
};

const confirm = async (config = {}) => {
  if (config.yes) {
    return true;
  }
  const { check } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'check',
      message: 'Do you wish to proceed?',
      default: true,
    },
  ]);

  return check;
};

module.exports.getConfig = getConfig;
module.exports.askAll = askAll;
module.exports.askMissing = askMissing;
module.exports.confirm = confirm;
module.exports.STORAGE_TAG = STORAGE_TAG;
module.exports.STORAGE_CONTENT = STORAGE_CONTENT;
module.exports.STATE_SUCCESS = STATE_SUCCESS;
module.exports.STATE_FAILURE = STATE_FAILURE;

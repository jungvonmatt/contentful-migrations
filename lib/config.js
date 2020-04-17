const path = require('path');
const inquirer = require('inquirer');
const mergeOptions = require('merge-options').bind({ ignoreUndefined: true });
const { cosmiconfig } = require('cosmiconfig');
const branch = require('git-branch');

const { getSpaces, getEnvironments } = require('./contentful');

/**
 * Get configuration
 * @param {Object} args
 */
const getConfig = async (args) => {
  const defaultOptions = {
    fieldId: 'migration',
    contentTypeId: 'config',
    host: 'api.contentful.com',
    directory: path.resolve(process.cwd(), 'migrations'),
  };

  const environmentOptions = {
    spaceId: process.env.CONTENTFUL_SPACE_ID,
    accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN,
    environment: process.env.CONTENTFUL_ENVIRONMENT,
  };

  try {
    defaultOptions.branch = await branch();
  } catch (error) {}

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
        environment: activeEnvironmentId,
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
    const explorerResult = await explorer.search();
    if (explorerResult !== null) {
      const { config, filepath } = explorerResult || {};

      configFileOptions = {
        directory: path.resolve(path.dirname(filepath || ''), args.directory || 'migrations'),
        ...(config || {}),
      };
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
    // {
    //   type: 'list',
    //   name: 'environment',
    //   message: 'Environment',
    //   choices: async (answers) => {
    //     const environments = await getEnvironments(answers);
    //     return environments.map((environment) => environment.sys.id);
    //   },
    //   default: function () {
    //     return data.environment;
    //   },
    // },
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

const askAll = async (data = {}) => {
  console.log('Please verify the following options');

  const answers = await inquirer.prompt(getPromts(data));
  answers.directory = path.resolve(process.cwd(), answers.directory || data.directory);

  return answers;
};

const askMissing = async (data = {}) => {
  const missingPromts = getPromts(data).filter(({ name }) => !data[name]);
  const answers = await inquirer.prompt(missingPromts);

  return { ...data, ...answers };
};

module.exports.getConfig = getConfig;
module.exports.askAll = askAll;
module.exports.askMissing = askMissing;

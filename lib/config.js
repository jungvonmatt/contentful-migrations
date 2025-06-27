const path = require('path');
const { Confirm } = require('enquirer');

const { getSpaces, getEnvironments } = require('./contentful');

const STORAGE_TAG = 'tag';
const STORAGE_CONTENT = 'content';

const STATE_SUCCESS = 'success';
const STATE_FAILURE = 'failure';

/**
 * Get configuration
 * @param {Object} args
 */
const getConfig = async (args, required = [], prompt = []) => {
  const { configFile, cwd, ...overrides } = args;
  const { loadContentfulConfig } = await import('@jungvonmatt/contentful-config');

  const result = await loadContentfulConfig('migrations', {
    configFile,
    cwd,
    overrides,
    prompt,
    defaultConfig: {
      fieldId: 'migration',
      migrationContentTypeId: 'contentful-migrations',
      host: 'api.contentful.com',
      directory: path.resolve(cwd || process.cwd(), 'migrations'),
    },
    envMap: {
      CONTENTFUL_SPACE_ID: 'spaceId',
      CONTENTFUL_ENVIRONMENT_ID: 'environmentId',
      CONTENTFUL_MANAGEMENT_TOKEN: 'managementToken',
      CONTENTFUL_HOST: 'host',
      CONTENTFUL_PROXY: 'proxy',
      CONTENTFUL_MIGRATIONS_STORAGE: 'storage',
      CONTENTFUL_MIGRATIONS_FIELD_ID: 'fieldId',
      CONTENTFUL_MIGRATIONS_CONTENT_TYPE_ID: 'migrationContentTypeId',
      CONTENTFUL_MIGRATIONS_DIRECTORY: 'directory',
      CONTENTFUL_MIGRATIONS_REQUEST_BATCH_SIZE: 'requestBatchSize',
    },
    prompts: getPromts,
    required,
  });

  const missingStorage = result.missing.includes('storage');

  return { ...result.config, missingStorageModel: missingStorage && result.config.storage === STORAGE_CONTENT };
};

/**
 * Add prompts for migration specific config fields.
 * All default contentful prompts are already available via @jungvonmatt/contentful-config
 * @param {*} data
 * @returns
 */
const getPromts = (data) => {
  return [
    {
      type: 'select',
      name: 'storage',
      message: 'How should the migrations be managed',
      choices: [
        {
          message: 'Content-model (recommended)',
          name: STORAGE_CONTENT,
          value: STORAGE_CONTENT,
        },
        {
          message: 'Tag',
          name: STORAGE_TAG,
          value: STORAGE_TAG,
        },
      ],
      initial: data.fieldId,
    },
    {
      type: 'input',
      name: 'fieldId',
      message: 'Id of the tag where the the migration version is stored',
      skip() {
        const answers = this?.enquirer?.answers;
        return answers.storage === STORAGE_CONTENT;
      },
      initial: data.fieldId,
    },
    {
      type: 'input',
      name: 'migrationContentTypeId',
      message: 'Id of the content-type where the the migrations are stored',
      skip() {
        const answers = this?.enquirer?.answers;
        return answers.storage === STORAGE_TAG;
      },
      initial: data.migrationContentTypeId,
    },
    {
      type: 'input',
      name: 'directory',
      message: 'Directory where the migrations are stored',
      initial: data.directory,
    },
  ];
};

const confirm = async (config = {}) => {
  if (config.yes) {
    return true;
  }

  const prompt = new Confirm({
    name: 'check',
    message: config?.message || 'Do you wish to proceed?',
    initial: true,
  });

  return prompt.run();
};

module.exports.getConfig = getConfig;
module.exports.confirm = confirm;
module.exports.STORAGE_TAG = STORAGE_TAG;
module.exports.STORAGE_CONTENT = STORAGE_CONTENT;
module.exports.STATE_SUCCESS = STATE_SUCCESS;
module.exports.STATE_FAILURE = STATE_FAILURE;

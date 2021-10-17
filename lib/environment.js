const chalk = require('chalk');
const { getSpace, getApiKeys } = require('./contentful');

const getActiveApiKey = async (config) => {
  const space = await getSpace(config);
  const { CONTENTFUL_DELIVERY_TOKEN } = process.env;
  const apiKeys = await getApiKeys(config);
  const [activeApiKey] = CONTENTFUL_DELIVERY_TOKEN
    ? apiKeys.filter((apiKey) => apiKey.accessToken === CONTENTFUL_DELIVERY_TOKEN)
    : apiKeys;

  if (activeApiKey) {
    return space.getApiKey(activeApiKey.sys.id);
  }
};

/**
 * Create contentful environment and activate api access
 * @param {string} id
 * @param {Object} config The config object including all required data
 */
const createEnvironment = async (id, config) => {
  const { sourceEnvironment = 'master' } = config;
  console.log(`\nCreating new environment ${chalk.green(id)} from ${chalk.green(sourceEnvironment)}`);

  const space = await getSpace(config);
  const environment = await space.createEnvironmentWithId(id, { name: id }, sourceEnvironment);

  const apiKey = await getActiveApiKey(config);

  if (apiKey) {
    console.log(`Activating ${chalk.green(id)} for API key ${chalk.green(apiKey.sys.id)}`);
    apiKey.environments = [
      ...apiKey.environments,
      {
        sys: {
          type: 'Link',
          linkType: 'Environment',
          id: environment.sys.id,
        },
      },
    ];

    await apiKey.update();
  }
  console.log(chalk.green('\nDone'), '🚀');
};

/**
 * Remove contentful environment and remove api access
 * @param {string} id
 * @param {Object} config The config object including all required data
 */
const removeEnvironment = async (id, config) => {
  const { fallbackEnvironment } = config;
  if ([fallbackEnvironment, 'master'].includes(id)) {
    throw new Error('Removing the fallback environment or the master environment is not supported');
  }
  console.log(`\nRemoving environment ${chalk.green(id)}`);
  const space = await getSpace(config);
  const environment = await space.getEnvironment(id);
  await environment.delete();

  const apiKey = await getActiveApiKey(config);
  if (apiKey) {
    console.log(`Removing ${chalk.green(id)} from API key ${chalk.green(apiKey.sys.id)}`);
    const index = (apiKey.environments || []).findIndex((env) => env.sys.id === environment.sys.id);
    apiKey.environments = [...apiKey.environments.slice(0, index), ...apiKey.environments.slice(index + 1)];

    await apiKey.update();
  }
  console.log(chalk.green('\nDone'), '🚀');
};

/**
 * Reset environment
 * @param {string} id
 * @param {Object} config The config object including all required data
 */
const resetEnvironment = async (id, config) => {
  if (['master'].includes(id)) {
    throw new Error('Removing the fallback environment or the master environment is not supported');
  }
  console.log(`\nRemoving environment ${chalk.green(id)}`);
  const space = await getSpace(config);
  try {
    const environment = await space.getEnvironment(id);
    await environment.delete();
  } catch {}
  await createEnvironment(id, config);

  console.log(chalk.green('\nDone'), '🚀');
};

module.exports.createEnvironment = createEnvironment;
module.exports.removeEnvironment = removeEnvironment;
module.exports.resetEnvironment = resetEnvironment;

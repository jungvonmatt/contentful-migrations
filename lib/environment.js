const pc = require('picocolors');
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
 * @param {string} environmentId
 * @param {Object} config The config object including all required data
 */
const createEnvironment = async (environmentId, config) => {
  const { sourceEnvironmentId = 'master' } = config;
  console.log(`\nCreating new environment ${pc.green(environmentId)} from ${pc.green(sourceEnvironmentId)}`);

  const space = await getSpace(config);
  const environment = await space.createEnvironmentWithId(environmentId, { name: environmentId }, sourceEnvironmentId);

  const apiKey = await getActiveApiKey(config);

  if (apiKey) {
    console.log(`Activating ${pc.green(environmentId)} for API key ${pc.green(apiKey.sys.id)}`);
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
  console.log(pc.green('\nDone'), '🚀');
};

/**
 * Remove contentful environment and remove api access
 * @param {string} environmentId
 * @param {Object} config The config object including all required data
 */
const removeEnvironment = async (environmentId, config) => {
  if (['master'].includes(environmentId)) {
    throw new Error('Removing the master environment is not supported');
  }
  console.log(`\nRemoving environment ${pc.green(environmentId)}`);
  const space = await getSpace(config);
  const environment = await space.getEnvironment(environmentId);
  await environment.delete();

  const apiKey = await getActiveApiKey(config);
  if (apiKey) {
    console.log(`Removing ${pc.green(environmentId)} from API key ${pc.green(apiKey.sys.id)}`);
    const index = (apiKey.environments || []).findIndex((env) => env.sys.id === environment.sys.id);
    apiKey.environments = [...apiKey.environments.slice(0, index), ...apiKey.environments.slice(index + 1)];

    await apiKey.update();
  }
  console.log(pc.green('\nDone'), '🚀');
};

/**
 * Reset environment
 * @param {string} environmentId
 * @param {Object} config The config object including all required data
 */
const resetEnvironment = async (environmentId, config) => {
  if (['master'].includes(environmentId)) {
    throw new Error('Removing the master environment is not supported');
  }
  console.log(`\nRemoving environment ${pc.green(environmentId)}`);
  const space = await getSpace(config);
  try {
    const environment = await space.getEnvironment(environmentId);
    await environment.delete();
  } catch {}
  await createEnvironment(environmentId, config);
};

module.exports.createEnvironment = createEnvironment;
module.exports.removeEnvironment = removeEnvironment;
module.exports.resetEnvironment = resetEnvironment;

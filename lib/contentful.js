const contentful = require('contentful-management');

const DEFAULT_ENVIRONMENT = 'master';

let client;

const getClient = async (options) => {
  const { accessToken } = options || {};

  if (client) {
    return client;
  }

  if (accessToken) {
    client = await contentful.createClient({
      accessToken,
    });
    return client;
  }

  throw new Error('You need to login first. Run npx contentful login');
};

const getSpaces = async (options) => {
  const client = await getClient(options);
  const { items: spaces } = await client.getSpaces();

  return spaces;
};

const getSpace = async (options) => {
  const { spaceId } = options || {};
  const client = await getClient(options);
  return client.getSpace(spaceId);
};

const getEnvironments = async (options) => {
  const space = await getSpace(options);
  const { items: environments } = await space.getEnvironments();

  return environments;
};

/**
 * Get Contentful management client
 * @param {Options} options
 */
const getEnvironment = async (options) => {
  const { environment, branch, fallbackEnvironment } = options || {};
  const space = await getSpace(options);

  const { items: environments } = await space.getEnvironments();

  const environmentIds = (environments || []).map((env) => env.sys.id);

  const targetEnvironment = environment || branch;
  if (targetEnvironment && environmentIds.includes(targetEnvironment)) {
    return space.getEnvironment(targetEnvironment);
  }

  return space.getEnvironment(fallbackEnvironment || DEFAULT_ENVIRONMENT);
};

exports.getClient = getClient;
exports.getSpaces = getSpaces;
exports.getSpace = getSpace;
exports.getEnvironments = getEnvironments;
exports.getEnvironment = getEnvironment;

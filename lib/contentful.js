const contentful = require('contentful-management');
const flatMap = require('array.prototype.flatmap');
const DEFAULT_ENVIRONMENT = 'master';
const hasher = require('node-object-hash');
const objectHash = hasher();

let client;
let environmentCache = new Map();

const TYPE_SYMBOL = 'Symbol';
const TYPE_TEXT = 'Text';
const TYPE_RICHTEXT = 'RichText';
const TYPE_NUMBER = 'Integer';
const TYPE_DATE = 'Date';
const TYPE_LOCATION = 'Location';
const TYPE_ARRAY = 'Array';
const TYPE_BOOLEAN = 'Boolean';
const TYPE_LINK = 'Link';
const LINK_TYPE_ASSET = 'Asset';
const LINK_TYPE_ENTRY = 'Entry';

const MAX_ALLOWED_LIMIT = 1000;

const getContentTypeId = (node) => {
  const { sys } = node || {};
  const { contentType } = sys || {};
  const { sys: contentTypeSys } = contentType || {};
  const { id } = contentTypeSys || {};

  return id;
};

const getEnvironmentId = (node) => {
  const { sys } = node || {};
  const { environment } = sys || {};
  const { sys: environmentSys } = environment || {};
  const { id } = environmentSys || {};

  return id;
};

const getContentId = (node) => {
  const { sys } = node || {};
  const { id } = sys || {};
  return id;
};

const getContentName = (node, displayField) => {
  const { fields, sys } = node;
  const { id: fallback = 'unknown' } = sys || {};
  const { [displayField]: field, name, title, id } = fields || {};

  for (const tmp of [field, name, title, id].filter((v) => v)) {
    const [result] = Object.values(tmp);

    if (result && typeof result === 'string') {
      return result;
    }
  }

  return fallback;
};

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
  const cacheKey = objectHash(options);
  if (environmentCache.has(cacheKey)) {
    return environmentCache.get(cacheKey);
  }
  const { environment, branch, fallbackEnvironment } = options || {};
  const space = await getSpace(options);

  const { items: environments } = await space.getEnvironments();

  const environmentIds = (environments || []).map((env) => env.sys.id);

  const targetEnvironment = environment || branch;
  if (targetEnvironment && environmentIds.includes(targetEnvironment)) {
    environmentCache.set(cacheKey, space.getEnvironment(targetEnvironment));
  } else {
    environmentCache.set(cacheKey, space.getEnvironment(fallbackEnvironment || DEFAULT_ENVIRONMENT));
  }

  return environmentCache.get(cacheKey);
};

/**
 * Gets all the existing entities based on pagination parameters.
 * The first call will have no aggregated response. Subsequent calls will
 * concatenate the new responses to the original one.
 * Methods:
 * - getContentTypes
 * - getEntries
 * - getAssets
 */
const pagedGet = async (environment, { method, skip = 0, aggregatedResponse = null, query = null }) => {
  const fullQuery = {
    skip: skip,
    limit: MAX_ALLOWED_LIMIT,
    order: 'sys.createdAt,sys.id',
    ...(query || {}),
  };

  const response = await environment[method](fullQuery);

  if (!aggregatedResponse) {
    aggregatedResponse = response;
  } else {
    aggregatedResponse.items = aggregatedResponse.items.concat(response.items);
  }
  // const page = Math.ceil(skip / MAX_ALLOWED_LIMIT) + 1;
  // const pages = Math.ceil(response.total / MAX_ALLOWED_LIMIT);

  if (skip + MAX_ALLOWED_LIMIT <= response.total) {
    return pagedGet(environment, { method, skip: skip + MAX_ALLOWED_LIMIT, aggregatedResponse, query });
  }
  return aggregatedResponse;
};

const filterDrafts = (items, includeDrafts) => {
  return includeDrafts ? items : items.filter((item) => !!item.sys.publishedVersion || !!item.sys.archivedVersion);
};

const filterArchived = (items, includeArchived) => {
  return includeArchived ? items : items.filter((item) => !item.sys.archivedVersion);
};

const getLinkedId = (node, destType) => {
  const { sys } = node || {};
  const { type, linkType, id } = sys || {};
  if (type === TYPE_LINK && linkType === destType) {
    return id;
  }
};

const getLinkedIds = (entry, destType) => {
  const { fields } = entry || {};
  const ids = Object.values(fields).reduce((result, locales) => {
    const ids = flatMap(Object.values(locales), (value) => {
      if (Array.isArray(value)) {
        return value.map((node) => getLinkedId(node, destType));
      }

      return [getLinkedId(value, destType)];
    });

    return [...result, ...ids];
  }, []);

  return ids.filter((v) => v);
};

const getLinkedEntries = (entries, allEntries, options) => {
  const { collectedIds = [], includeIds = [] } = options || {};
  if ((entries || []).length === 0) {
    return [];
  }
  const entryIds = (entries || []).map((entry) => getContentId(entry));
  const linkedIds = (entries || []).reduce((result, entry) => [...result, ...getLinkedIds(entry, LINK_TYPE_ENTRY)], []);
  const newIds = linkedIds.filter(
    (id) => !collectedIds.includes(id) && !entryIds.includes(id) && includeIds.includes(id)
  );
  const newEntries = allEntries.filter((entry) => newIds.includes(getContentId(entry)));

  return [
    ...newEntries,
    ...getLinkedEntries(newEntries, allEntries, { ...(options || {}), collectedIds: [...collectedIds, ...entryIds] }),
  ];
};

const getLinkedAssets = (entries, assets) => {
  if ((entries || []).length === 0) {
    return [];
  }
  const linkedIds = (entries || []).reduce((result, entry) => [...result, ...getLinkedIds(entry, LINK_TYPE_ASSET)], []);

  return assets.filter((asset) => linkedIds.includes(getContentId(asset)));
};

const getNodeName = (node, contentType) => {
  const { sys } = node || {};
  const { type } = sys || {};
  const { name: contentTypeName, displayField } = contentType || {};

  const name = getContentName(node, displayField);
  return `[${contentTypeName || type}] ${name}`;
};

const getContent = async (options) => {
  const { contentType } = options;
  const environment = await getEnvironment(options);

  const { items: contentTypes } = await pagedGet(environment, { method: 'getContentTypes' });
  const { items: entries } = await pagedGet(environment, { method: 'getEntries' });
  const { items: assets } = await pagedGet(environment, { method: 'getAssets' });

  if (contentType) {
    const baseEntries = entries.filter((entry) => getContentTypeId(entry) === contentType);

    return {
      entries,
      assets,
      filteredEntries: baseEntries,
      filteredAssets: getLinkedAssets(baseEntries, assets),
      contentTypes,
    };
  }

  return { entries, assets, contentTypes };
};

const getContentTypes = async (options) => {
  const { contentType } = options;
  const environment = await getEnvironment(options);

  const { items: contentTypes } = await pagedGet(environment, { method: 'getContentTypes' });

  if (contentType) {
    return contentTypes.filter((entry) => getContentId(entry) === contentType);
  }

  return contentTypes;
};

const getEditorInterfaces = async (options) => {
  const environment = await getEnvironment(options);

  const { items: editorInterfaces } = await pagedGet(environment, { method: 'getEditorInterfaces' });

  return editorInterfaces;
};

exports.getClient = getClient;
exports.getSpaces = getSpaces;
exports.getSpace = getSpace;
exports.getEnvironments = getEnvironments;
exports.getEnvironment = getEnvironment;
exports.getContent = getContent;
exports.getContentTypes = getContentTypes;
exports.getContentId = getContentId;
exports.getLinkedAssets = getLinkedAssets;
exports.getLinkedEntries = getLinkedEntries;
exports.getContentTypeId = getContentTypeId;
exports.getContentName = getContentName;
exports.getNodeName = getNodeName;
exports.getEnvironmentId = getEnvironmentId;
exports.getEditorInterfaces = getEditorInterfaces;

// Constants
exports.TYPE_SYMBOL = TYPE_SYMBOL;
exports.TYPE_TEXT = TYPE_TEXT;
exports.TYPE_RICHTEXT = TYPE_RICHTEXT;
exports.TYPE_NUMBER = TYPE_NUMBER;
exports.TYPE_DATE = TYPE_DATE;
exports.TYPE_LOCATION = TYPE_LOCATION;
exports.TYPE_ARRAY = TYPE_ARRAY;
exports.TYPE_BOOLEAN = TYPE_BOOLEAN;
exports.TYPE_LINK = TYPE_LINK;
exports.LINK_TYPE_ASSET = LINK_TYPE_ASSET;
exports.LINK_TYPE_ENTRY = LINK_TYPE_ENTRY;

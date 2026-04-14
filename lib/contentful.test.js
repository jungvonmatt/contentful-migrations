import { vi } from 'vitest';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

const makeLink = (id, linkType) => ({
  sys: {
    type: 'Link',
    linkType,
    id,
  },
});

const makeEntry = (id, contentTypeId, fields) => ({
  sys: {
    id,
    type: 'Entry',
    contentType: {
      sys: {
        id: contentTypeId,
      },
    },
    environment: {
      sys: {
        id: 'master',
      },
    },
  },
  fields,
});

const loadContentfulModule = ({ client } = {}) => {
  const createClient = vi.fn().mockResolvedValue(client || {});

  return {
    createClient,
    module: loadCjsModule('./lib/contentful.js', {
      'contentful-management': {
        createClient,
      },
    }),
  };
};

describe('contentful helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts ids and names from Contentful resources', () => {
    const { module } = loadContentfulModule();
    const entry = makeEntry('entry-1', 'article', {
      slug: { 'en-US': 'hello-world' },
    });

    expect(module.getContentId(entry)).toBe('entry-1');
    expect(module.getContentTypeId(entry)).toBe('article');
    expect(module.getEnvironmentId(entry)).toBe('master');
    expect(module.getContentName(entry, 'slug')).toBe('hello-world');
    expect(module.getContentName({ sys: { id: 'fallback' }, fields: {} }, 'slug')).toBe('fallback');
    expect(module.getNodeName(entry, { name: 'Article', displayField: 'slug' })).toBe('[Article] hello-world');
  });

  it('creates and caches a management client using documented options', async () => {
    const client = { getSpace: vi.fn() };
    const { module, createClient } = loadContentfulModule({ client });

    await expect(module.getClient()).rejects.toThrow('You need to login first. Run npx contentful login');

    const first = await module.getClient({
      managementToken: 'token',
      host: 'api.eu.contentful.com',
    });
    const second = await module.getClient({
      managementToken: 'another-token',
    });

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith({
      accessToken: 'token',
      host: 'api.eu.contentful.com',
    });
    expect(second).toBe(first);
  });

  it('paginates spaces, spaces API keys, and environment lookups', async () => {
    const environment = {
      sys: { id: 'master' },
      getLocales: vi.fn().mockResolvedValue({
        items: [
          { code: 'de-DE', default: false },
          { code: 'en-US', default: true },
        ],
      }),
    };
    const space = {
      sys: {
        organization: {
          sys: {
            id: 'org-1',
          },
        },
      },
      getEnvironments: vi
        .fn()
        .mockResolvedValueOnce({ items: [{ sys: { id: 'master' } }, { sys: { id: 'preview' } }] })
        .mockResolvedValueOnce({ items: [{ sys: { id: 'master' } }, { sys: { id: 'preview' } }] })
        .mockResolvedValueOnce({ items: [{ sys: { id: 'master' } }, { sys: { id: 'preview' } }] }),
      getEnvironment: vi.fn().mockResolvedValue(environment),
      getApiKeys: vi
        .fn()
        .mockResolvedValueOnce({
          total: 1500,
          limit: 1000,
          items: [{ sys: { id: 'key-1' } }],
        })
        .mockResolvedValueOnce({
          total: 1500,
          limit: 1000,
          items: [{ sys: { id: 'key-2' } }],
        }),
    };
    const client = {
      getSpaces: vi
        .fn()
        .mockResolvedValueOnce({
          total: 1500,
          limit: 1000,
          items: [{ sys: { id: 'space-1' } }],
        })
        .mockResolvedValueOnce({
          total: 1500,
          limit: 1000,
          items: [{ sys: { id: 'space-2' } }],
        }),
      getSpace: vi.fn().mockResolvedValue(space),
    };
    const { module } = loadContentfulModule({ client });
    const options = {
      managementToken: 'token',
      spaceId: 'space-1',
      environmentId: 'master',
    };

    await expect(module.getSpaces(options)).resolves.toEqual([{ sys: { id: 'space-1' } }, { sys: { id: 'space-2' } }]);
    await expect(module.getSpace(options)).resolves.toBe(space);
    await expect(module.getSpace(options)).resolves.toBe(space);
    await expect(module.getOrganizationId(options)).resolves.toBe('org-1');
    await expect(module.getEnvironments(options)).resolves.toEqual([
      { sys: { id: 'master' } },
      { sys: { id: 'preview' } },
    ]);
    await expect(module.getApiKeys(options)).resolves.toEqual([{ sys: { id: 'key-1' } }, { sys: { id: 'key-2' } }]);
    await expect(module.getEnvironment(options)).resolves.toBe(environment);
    await expect(module.getDefaultLocale(options)).resolves.toBe('en-US');

    expect(client.getSpaces).toHaveBeenNthCalledWith(1, { skip: 0, limit: 1000 });
    expect(client.getSpaces).toHaveBeenNthCalledWith(2, { skip: 1000, limit: 1000 });
    expect(client.getSpace).toHaveBeenCalledTimes(1);
    expect(space.getApiKeys).toHaveBeenNthCalledWith(1, { skip: 0, limit: 1000 });
    expect(space.getApiKeys).toHaveBeenNthCalledWith(2, { skip: 1000, limit: 1000 });
    expect(space.getEnvironment).toHaveBeenCalledWith('master');
  });

  it('fails fast when the requested environment is missing or omitted', async () => {
    const client = {
      getSpace: vi.fn().mockResolvedValue({
        getEnvironments: vi.fn().mockResolvedValue({ items: [{ sys: { id: 'master' } }] }),
      }),
    };
    const { module } = loadContentfulModule({ client });

    await expect(
      module.getEnvironment({
        managementToken: 'token',
        spaceId: 'space-1',
        environmentId: 'preview',
      })
    ).rejects.toThrow('Environment "preview" is not available in space "space-1"');

    await expect(
      module.getEnvironment({
        managementToken: 'token',
        spaceId: 'space-1',
      })
    ).rejects.toThrow(
      'Missing environment id. Use -e <environment-id> or set environment variable CONTENTFUL_ENVIRONMENT_ID'
    );
  });

  it('falls back to de when no locale is marked as default', async () => {
    const environment = {
      sys: { id: 'master' },
      getLocales: vi.fn().mockResolvedValue({
        items: [{ code: 'de-DE', default: false }],
      }),
    };
    const client = {
      getSpace: vi.fn().mockResolvedValue({
        getEnvironments: vi.fn().mockResolvedValue({ items: [{ sys: { id: 'master' } }] }),
        getEnvironment: vi.fn().mockResolvedValue(environment),
      }),
    };
    const { module } = loadContentfulModule({ client });

    await expect(
      module.getDefaultLocale({
        managementToken: 'token',
        spaceId: 'space-1',
        environmentId: 'master',
      })
    ).resolves.toBe('de');
  });

  it('resolves linked entries and assets from entry fields', () => {
    const { module } = loadContentfulModule();
    const entryA = makeEntry('entry-a', 'article', {
      related: {
        'en-US': [makeLink('entry-b', 'Entry')],
      },
      hero: {
        'en-US': makeLink('asset-a', 'Asset'),
      },
    });
    const entryB = makeEntry('entry-b', 'article', {
      related: {
        'en-US': [makeLink('entry-c', 'Entry')],
      },
    });
    const entryC = makeEntry('entry-c', 'article', {
      title: { 'en-US': 'Leaf' },
    });
    const assets = [{ sys: { id: 'asset-a' } }, { sys: { id: 'asset-b' } }];

    expect(module.getLinkedEntries([entryA], [entryA, entryB, entryC], { includeIds: ['entry-b', 'entry-c'] })).toEqual(
      [entryB, entryC]
    );
    expect(module.getLinkedAssets([entryA], assets)).toEqual([{ sys: { id: 'asset-a' } }]);
    expect(module.getLinkedEntries([], [entryA], { includeIds: ['entry-b'] })).toEqual([]);
    expect(module.getLinkedAssets([], assets)).toEqual([]);
  });

  it('loads content collections through paged environment methods', async () => {
    const contentTypes = [{ sys: { id: 'article' } }, { sys: { id: 'author' } }];
    const entries = [
      makeEntry('entry-a', 'article', {
        title: { 'en-US': 'Hello world' },
        hero: { 'en-US': makeLink('asset-a', 'Asset') },
      }),
      makeEntry('entry-b', 'author', {
        name: { 'en-US': 'Ada' },
      }),
    ];
    const assets = [{ sys: { id: 'asset-a' } }, { sys: { id: 'asset-b' } }];
    const editorInterfaces = [{ sys: { contentType: { sys: { id: 'article' } } } }];
    const environment = {
      sys: { id: 'master' },
      getContentTypes: vi.fn().mockResolvedValue({ total: 2, items: contentTypes }),
      getEntries: vi.fn().mockImplementation(({ content_type } = {}) =>
        Promise.resolve({
          total: content_type ? 1 : entries.length,
          items: content_type ? [makeEntry('migration-1', 'contentful-migrations', {})] : entries,
        })
      ),
      getAssets: vi.fn().mockResolvedValue({ total: 2, items: assets }),
      getEditorInterfaces: vi.fn().mockResolvedValue({ total: 1, items: editorInterfaces }),
    };
    const client = {
      getSpace: vi.fn().mockResolvedValue({
        getEnvironments: vi.fn().mockResolvedValue({ items: [{ sys: { id: 'master' } }] }),
        getEnvironment: vi.fn().mockResolvedValue(environment),
      }),
    };
    const { module } = loadContentfulModule({ client });
    const config = {
      managementToken: 'token',
      spaceId: 'space-1',
      environmentId: 'master',
      contentType: 'article',
      migrationContentTypeId: 'contentful-migrations',
    };

    await expect(module.getContent(config)).resolves.toEqual({
      entries,
      assets,
      filteredEntries: [entries[0]],
      filteredAssets: [{ sys: { id: 'asset-a' } }],
      contentTypes,
    });
    await expect(module.getMigrationItems(config)).resolves.toEqual([
      makeEntry('migration-1', 'contentful-migrations', {}),
    ]);
    await expect(module.getContentTypes(config)).resolves.toEqual([{ sys: { id: 'article' } }]);
    await expect(module.getEditorInterfaces(config)).resolves.toEqual(editorInterfaces);

    expect(environment.getEntries).toHaveBeenCalledWith({
      skip: 0,
      limit: 1000,
      order: 'sys.createdAt,sys.id',
    });
    expect(environment.getEntries).toHaveBeenCalledWith({
      skip: 0,
      limit: 1000,
      order: 'sys.createdAt,sys.id',
      content_type: 'contentful-migrations',
    });
  });
});

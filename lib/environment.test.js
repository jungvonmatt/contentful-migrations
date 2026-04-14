import { vi } from 'vitest';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

describe('environment helpers', () => {
  const originalDeliveryToken = process.env.CONTENTFUL_DELIVERY_TOKEN;
  let getSpace;
  let getApiKeys;
  let createEnvironment;
  let removeEnvironment;
  let resetEnvironment;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTENTFUL_DELIVERY_TOKEN;
    getSpace = vi.fn();
    getApiKeys = vi.fn();
    ({ createEnvironment, removeEnvironment, resetEnvironment } = loadCjsModule('./lib/environment.js', {
      './contentful': { getSpace, getApiKeys },
    }));
  });

  afterAll(() => {
    process.env.CONTENTFUL_DELIVERY_TOKEN = originalDeliveryToken;
  });

  it('creates an environment and activates it for the matching API key', async () => {
    const apiKey = {
      sys: { id: 'api-key-1' },
      accessToken: 'delivery-token',
      environments: [{ sys: { id: 'master' } }],
      update: vi.fn().mockResolvedValue(undefined),
    };
    const space = {
      createEnvironmentWithId: vi.fn().mockResolvedValue({ sys: { id: 'preview' } }),
      getApiKey: vi.fn().mockResolvedValue(apiKey),
    };

    getSpace.mockResolvedValue(space);
    getApiKeys.mockResolvedValue([{ accessToken: 'other-token' }, apiKey]);
    process.env.CONTENTFUL_DELIVERY_TOKEN = 'delivery-token';

    await createEnvironment('preview', { sourceEnvironmentId: 'sandbox' });

    expect(space.createEnvironmentWithId).toHaveBeenCalledWith('preview', { name: 'preview' }, 'sandbox');
    expect(space.getApiKey).toHaveBeenCalledWith('api-key-1');
    expect(apiKey.environments).toContainEqual({
      sys: {
        type: 'Link',
        linkType: 'Environment',
        id: 'preview',
      },
    });
    expect(apiKey.update).toHaveBeenCalled();
  });

  it('removes an environment and detaches it from the active API key', async () => {
    const environment = {
      sys: { id: 'preview' },
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const apiKey = {
      sys: { id: 'api-key-1' },
      environments: [{ sys: { id: 'master' } }, { sys: { id: 'preview' } }],
      update: vi.fn().mockResolvedValue(undefined),
    };
    const space = {
      getEnvironment: vi.fn().mockResolvedValue(environment),
      getApiKey: vi.fn().mockResolvedValue(apiKey),
    };

    getSpace.mockResolvedValue(space);
    getApiKeys.mockResolvedValue([{ sys: { id: 'api-key-1' } }]);

    await removeEnvironment('preview', {});

    expect(space.getEnvironment).toHaveBeenCalledWith('preview');
    expect(environment.delete).toHaveBeenCalled();
    expect(apiKey.environments).toEqual([{ sys: { id: 'master' } }]);
    expect(apiKey.update).toHaveBeenCalled();
  });

  it('rejects destructive operations against master', async () => {
    await expect(removeEnvironment('master', {})).rejects.toThrow('Removing the master environment is not supported');
    await expect(resetEnvironment('master', {})).rejects.toThrow('Removing the master environment is not supported');
  });

  it('resets an environment even when the old one is already gone', async () => {
    const space = {
      getEnvironment: vi.fn().mockRejectedValue(new Error('missing')),
      createEnvironmentWithId: vi.fn().mockResolvedValue({ sys: { id: 'preview' } }),
      getApiKey: vi.fn(),
    };

    getSpace.mockResolvedValue(space);
    getApiKeys.mockResolvedValue([]);

    await resetEnvironment('preview', {});

    expect(space.getEnvironment).toHaveBeenCalledWith('preview');
    expect(space.createEnvironmentWithId).toHaveBeenCalledWith('preview', { name: 'preview' }, 'master');
  });
});

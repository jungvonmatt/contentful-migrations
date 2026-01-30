const { createEnvironment, removeEnvironment, resetEnvironment } = require('./environment');
const { getSpace, getApiKeys } = require('./contentful');

jest.mock('./contentful');

describe('environment', () => {
  let mockSpace;
  let mockEnvironment;
  let mockApiKey;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEnvironment = {
      sys: { id: 'test-env' },
      delete: jest.fn().mockResolvedValue(),
    };

    mockApiKey = {
      sys: { id: 'test-api-key' },
      accessToken: 'test-token',
      environments: [
        {
          sys: {
            type: 'Link',
            linkType: 'Environment',
            id: 'existing-env',
          },
        },
      ],
      update: jest.fn().mockResolvedValue(),
    };

    mockSpace = {
      createEnvironmentWithId: jest.fn().mockResolvedValue(mockEnvironment),
      getEnvironment: jest.fn().mockResolvedValue(mockEnvironment),
      getApiKey: jest.fn().mockResolvedValue(mockApiKey),
    };

    getSpace.mockResolvedValue(mockSpace);
    getApiKeys.mockResolvedValue([mockApiKey]);

    mockConfig = {
      spaceId: 'test-space',
      environmentId: 'test-env',
      sourceEnvironmentId: 'master',
    };

    // Mock process.env.CONTENTFUL_DELIVERY_TOKEN
    delete process.env.CONTENTFUL_DELIVERY_TOKEN;
  });

  describe('createEnvironment', () => {
    it('should create a new environment from source', async () => {
      await createEnvironment('new-env', mockConfig);

      expect(getSpace).toHaveBeenCalledWith(mockConfig);
      expect(mockSpace.createEnvironmentWithId).toHaveBeenCalledWith('new-env', { name: 'new-env' }, 'master');
    });

    it('should use custom sourceEnvironmentId', async () => {
      const config = { ...mockConfig, sourceEnvironmentId: 'staging' };
      await createEnvironment('new-env', config);

      expect(mockSpace.createEnvironmentWithId).toHaveBeenCalledWith('new-env', { name: 'new-env' }, 'staging');
    });

    it('should activate environment for API key when CONTENTFUL_DELIVERY_TOKEN is not set', async () => {
      await createEnvironment('new-env', mockConfig);

      expect(getApiKeys).toHaveBeenCalledWith(mockConfig);
      expect(mockSpace.getApiKey).toHaveBeenCalledWith('test-api-key');
      expect(mockApiKey.environments).toContainEqual({
        sys: {
          type: 'Link',
          linkType: 'Environment',
          id: 'test-env',
        },
      });
      expect(mockApiKey.update).toHaveBeenCalled();
    });

    it('should not activate API key if no API keys exist', async () => {
      getApiKeys.mockResolvedValue([]);

      await createEnvironment('new-env', mockConfig);

      expect(mockSpace.getApiKey).not.toHaveBeenCalled();
    });

    it('should handle environment creation errors', async () => {
      const error = new Error('Failed to create environment');
      mockSpace.createEnvironmentWithId.mockRejectedValue(error);

      await expect(createEnvironment('new-env', mockConfig)).rejects.toThrow('Failed to create environment');
    });
  });

  describe('removeEnvironment', () => {
    it('should remove an environment', async () => {
      await removeEnvironment('test-env', mockConfig);

      expect(getSpace).toHaveBeenCalledWith(mockConfig);
      expect(mockSpace.getEnvironment).toHaveBeenCalledWith('test-env');
      expect(mockEnvironment.delete).toHaveBeenCalled();
    });

    it('should throw error when trying to remove master environment', async () => {
      await expect(removeEnvironment('master', mockConfig)).rejects.toThrow(
        'Removing the master environment is not supported'
      );

      expect(mockSpace.getEnvironment).not.toHaveBeenCalled();
    });

    it('should remove environment from API key', async () => {
      mockApiKey.environments = [
        {
          sys: {
            type: 'Link',
            linkType: 'Environment',
            id: 'test-env',
          },
        },
        {
          sys: {
            type: 'Link',
            linkType: 'Environment',
            id: 'other-env',
          },
        },
      ];

      await removeEnvironment('test-env', mockConfig);

      expect(getApiKeys).toHaveBeenCalledWith(mockConfig);
      expect(mockApiKey.environments).toEqual([
        {
          sys: {
            type: 'Link',
            linkType: 'Environment',
            id: 'other-env',
          },
        },
      ]);
      expect(mockApiKey.update).toHaveBeenCalled();
    });

    it('should handle environment deletion errors', async () => {
      const error = new Error('Failed to delete environment');
      mockEnvironment.delete.mockRejectedValue(error);

      await expect(removeEnvironment('test-env', mockConfig)).rejects.toThrow('Failed to delete environment');
    });
  });

  describe('resetEnvironment', () => {
    it('should reset an environment by deleting and recreating', async () => {
      await resetEnvironment('test-env', mockConfig);

      expect(mockSpace.getEnvironment).toHaveBeenCalledWith('test-env');
      expect(mockEnvironment.delete).toHaveBeenCalled();
      expect(mockSpace.createEnvironmentWithId).toHaveBeenCalledWith('test-env', { name: 'test-env' }, 'master');
    });

    it('should throw error when trying to reset master environment', async () => {
      await expect(resetEnvironment('master', mockConfig)).rejects.toThrow(
        'Removing the master environment is not supported'
      );

      expect(mockSpace.getEnvironment).not.toHaveBeenCalled();
    });

    it('should continue if environment does not exist', async () => {
      mockSpace.getEnvironment.mockRejectedValue(new Error('Environment not found'));

      await resetEnvironment('test-env', mockConfig);

      expect(mockSpace.getEnvironment).toHaveBeenCalledWith('test-env');
      // Should still create the environment
      expect(mockSpace.createEnvironmentWithId).toHaveBeenCalled();
    });

    it('should handle creation errors after deletion', async () => {
      const error = new Error('Failed to create environment');
      mockSpace.createEnvironmentWithId.mockRejectedValue(error);

      await expect(resetEnvironment('test-env', mockConfig)).rejects.toThrow('Failed to create environment');
    });
  });
});

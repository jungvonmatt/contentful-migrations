const { versionAdd, versionDelete } = require('./version');
const { storeMigration } = require('./backend');
const { getEnvironment } = require('./contentful');
const { STORAGE_TAG, STATE_SUCCESS } = require('./config');

jest.mock('./backend');
jest.mock('./contentful');

describe('version', () => {
  let mockConfig;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      storage: 'content',
      spaceId: 'test-space',
      environmentId: 'test-env',
    };

    mockClient = {
      getEntry: jest.fn(),
    };

    getEnvironment.mockResolvedValue(mockClient);
  });

  describe('versionAdd', () => {
    it('should add a migration version entry', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      storeMigration.mockResolvedValue();

      await versionAdd(file, mockConfig);

      expect(storeMigration).toHaveBeenCalledWith(
        {
          version: '123456',
          name: '123456-test-migration.js',
          state: STATE_SUCCESS,
          message: 'Manually added',
        },
        mockConfig
      );
    });

    it('should work with .cjs files', async () => {
      const file = '/path/to/migrations/789012-another-migration.cjs';
      storeMigration.mockResolvedValue();

      await versionAdd(file, mockConfig);

      expect(storeMigration).toHaveBeenCalledWith(
        {
          version: '789012',
          name: '789012-another-migration.cjs',
          state: STATE_SUCCESS,
          message: 'Manually added',
        },
        mockConfig
      );
    });

    it('should throw error when using tag storage', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      const tagConfig = { ...mockConfig, storage: STORAGE_TAG };

      await expect(versionAdd(file, tagConfig)).rejects.toThrow(
        'The version command is not available for the "tag" storage'
      );

      expect(storeMigration).not.toHaveBeenCalled();
    });

    it('should handle storeMigration errors', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      const error = new Error('Failed to store migration');
      storeMigration.mockRejectedValue(error);

      await expect(versionAdd(file, mockConfig)).rejects.toThrow('Failed to store migration');
    });
  });

  describe('versionDelete', () => {
    it('should delete a migration version entry', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      const mockEntry = {
        delete: jest.fn().mockResolvedValue(),
      };
      mockClient.getEntry.mockResolvedValue(mockEntry);

      await versionDelete(file, mockConfig);

      expect(getEnvironment).toHaveBeenCalledWith(mockConfig);
      expect(mockClient.getEntry).toHaveBeenCalledWith('123456');
      expect(mockEntry.delete).toHaveBeenCalled();
    });

    it('should work with .cjs files', async () => {
      const file = '/path/to/migrations/789012-another-migration.cjs';
      const mockEntry = {
        delete: jest.fn().mockResolvedValue(),
      };
      mockClient.getEntry.mockResolvedValue(mockEntry);

      await versionDelete(file, mockConfig);

      expect(mockClient.getEntry).toHaveBeenCalledWith('789012');
      expect(mockEntry.delete).toHaveBeenCalled();
    });

    it('should throw error when using tag storage', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      const tagConfig = { ...mockConfig, storage: STORAGE_TAG };

      await expect(versionDelete(file, tagConfig)).rejects.toThrow(
        'The version command is not available for the "tag" storage'
      );

      expect(getEnvironment).not.toHaveBeenCalled();
    });

    it('should handle getEntry errors', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      const error = new Error('Entry not found');
      mockClient.getEntry.mockRejectedValue(error);

      await expect(versionDelete(file, mockConfig)).rejects.toThrow('Entry not found');
    });

    it('should handle delete errors', async () => {
      const file = '/path/to/migrations/123456-test-migration.js';
      const mockEntry = {
        delete: jest.fn().mockRejectedValue(new Error('Failed to delete')),
      };
      mockClient.getEntry.mockResolvedValue(mockEntry);

      await expect(versionDelete(file, mockConfig)).rejects.toThrow('Failed to delete');
    });
  });
});

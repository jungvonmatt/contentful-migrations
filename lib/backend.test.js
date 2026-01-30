const { storeMigration, getMigrationVersions, getMigrationVersionFromTag, getLatestVersion } = require('./backend');
const { getEnvironment, getDefaultLocale, getMigrationItems } = require('./contentful');
const { STORAGE_TAG, STORAGE_CONTENT, STATE_SUCCESS, STATE_FAILURE } = require('./config');

jest.mock('./contentful');
jest.mock('./config', () => ({
  ...jest.requireActual('./config'),
}));

describe('backend', () => {
  let mockClient;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      sys: { id: 'test-env' },
      getContentTypes: jest.fn().mockResolvedValue({ items: [] }),
      createContentTypeWithId: jest.fn(),
      getEditorInterfaceForContentType: jest.fn(),
      getTag: jest.fn(),
      createTag: jest.fn(),
      getEntry: jest.fn(),
      createEntryWithId: jest.fn(),
      getEntries: jest.fn(),
    };

    getEnvironment.mockResolvedValue(mockClient);
    getDefaultLocale.mockResolvedValue('en-US');
    getMigrationItems.mockResolvedValue([]);

    mockConfig = {
      spaceId: 'test-space',
      environmentId: 'test-env',
      storage: STORAGE_TAG,
      fieldId: 'migration',
      migrationContentTypeId: 'contentful-migrations',
    };
  });

  describe('storeMigration', () => {
    describe('with tag storage', () => {
      it('should store migration as tag on success', async () => {
        const mockTag = {
          name: '100',
          update: jest.fn().mockResolvedValue(),
        };
        mockClient.getTag.mockResolvedValue(mockTag);

        await storeMigration({ version: 123, state: STATE_SUCCESS }, mockConfig);

        expect(mockClient.getTag).toHaveBeenCalledWith('migration');
        expect(mockTag.name).toBe('123');
        expect(mockTag.update).toHaveBeenCalled();
      });

      it('should create new tag if tag does not exist', async () => {
        mockClient.getTag.mockRejectedValue(new Error('Not found'));
        mockClient.createTag.mockResolvedValue();

        await storeMigration({ version: 123, state: STATE_SUCCESS }, mockConfig);

        expect(mockClient.createTag).toHaveBeenCalledWith('migration', '123');
      });

      it('should not store tag on failure state', async () => {
        await storeMigration({ version: 123, state: STATE_FAILURE }, mockConfig);

        expect(mockClient.getTag).not.toHaveBeenCalled();
        expect(mockClient.createTag).not.toHaveBeenCalled();
      });
    });

    describe('with content storage', () => {
      beforeEach(() => {
        mockConfig.storage = STORAGE_CONTENT;
      });

      it('should create new entry if entry does not exist', async () => {
        mockClient.getEntry.mockRejectedValue(new Error('Not found'));
        const mockEntry = {
          publish: jest.fn().mockResolvedValue(),
        };
        mockClient.createEntryWithId.mockResolvedValue(mockEntry);

        await storeMigration(
          {
            version: '123',
            name: '123-test-migration.js',
            state: STATE_SUCCESS,
            message: 'Test message',
          },
          mockConfig
        );

        expect(mockClient.createEntryWithId).toHaveBeenCalledWith('contentful-migrations', '123', {
          fields: {
            version: { 'en-US': '123' },
            name: { 'en-US': '123-test-migration.js' },
            state: { 'en-US': STATE_SUCCESS },
            message: { 'en-US': 'Test message' },
          },
        });
        expect(mockEntry.publish).toHaveBeenCalled();
      });

      it('should update existing entry', async () => {
        const mockEntry = {
          fields: {},
          publish: jest.fn().mockResolvedValue(),
        };
        mockClient.getEntry.mockResolvedValue(mockEntry);

        await storeMigration(
          {
            version: '123',
            name: '123-test-migration.js',
            state: STATE_SUCCESS,
            message: 'Updated message',
          },
          mockConfig
        );

        expect(mockEntry.fields).toEqual({
          name: { 'en-US': '123-test-migration.js' },
          state: { 'en-US': STATE_SUCCESS },
          message: { 'en-US': 'Updated message' },
        });
        expect(mockEntry.publish).toHaveBeenCalled();
      });

      it('should unpublish entry on failure state', async () => {
        const mockEntry = {
          fields: {},
          unpublish: jest.fn().mockResolvedValue(),
        };
        mockClient.getEntry.mockResolvedValue(mockEntry);

        await storeMigration(
          {
            version: '123',
            name: '123-test-migration.js',
            state: STATE_FAILURE,
            message: 'Error message',
          },
          mockConfig
        );

        expect(mockEntry.unpublish).toHaveBeenCalled();
      });

      it('should handle empty message', async () => {
        mockClient.getEntry.mockRejectedValue(new Error('Not found'));
        const mockEntry = {
          publish: jest.fn().mockResolvedValue(),
        };
        mockClient.createEntryWithId.mockResolvedValue(mockEntry);

        await storeMigration(
          {
            version: '123',
            name: '123-test-migration.js',
            state: STATE_SUCCESS,
          },
          mockConfig
        );

        expect(mockClient.createEntryWithId).toHaveBeenCalledWith(
          'contentful-migrations',
          '123',
          expect.objectContaining({
            fields: expect.objectContaining({
              message: { 'en-US': '' },
            }),
          })
        );
      });
    });
  });

  describe('getMigrationVersions', () => {
    it('should return version numbers from migration items', async () => {
      const mockItems = [{ sys: { id: '100' } }, { sys: { id: '200' } }, { sys: { id: '150' } }];

      getMigrationItems.mockResolvedValue(mockItems);

      const result = await getMigrationVersions(mockConfig);

      expect(result).toEqual([100, 200, 150]);
    });

    it('should return empty array when no items', async () => {
      getMigrationItems.mockResolvedValue([]);

      const result = await getMigrationVersions(mockConfig);

      expect(result).toEqual([]);
    });

    it('should handle null items', async () => {
      getMigrationItems.mockResolvedValue(null);

      const result = await getMigrationVersions(mockConfig);

      expect(result).toEqual([]);
    });
  });

  describe('getMigrationVersionFromTag', () => {
    it('should get version from tag', async () => {
      const mockTag = { name: '123' };
      mockClient.getTag.mockResolvedValue(mockTag);

      const result = await getMigrationVersionFromTag(mockConfig);

      expect(result).toBe(123);
      expect(mockClient.getTag).toHaveBeenCalledWith('migration');
    });

    it('should return 0 when tag name is empty', async () => {
      const mockTag = { name: '' };
      mockClient.getTag.mockResolvedValue(mockTag);

      const result = await getMigrationVersionFromTag(mockConfig);

      expect(result).toBe(0);
    });

    it('should return undefined when tag not found', async () => {
      mockClient.getTag.mockRejectedValue(new Error('Not found'));
      mockClient.getEntries.mockRejectedValue(new Error('Not found'));

      const result = await getMigrationVersionFromTag(mockConfig);

      expect(result).toBeUndefined();
    });

    it('should fallback to old config if no tag available', async () => {
      mockClient.getTag.mockRejectedValue(new Error('Not found'));
      mockClient.getEntries.mockResolvedValue({
        items: [
          {
            fields: {
              migration: {
                'en-US': '150',
              },
            },
          },
        ],
      });

      const config = {
        ...mockConfig,
        contentTypeId: 'old-content-type',
      };

      const result = await getMigrationVersionFromTag(config);

      expect(result).toBe(150);
    });
  });

  describe('getLatestVersion', () => {
    it('should get latest version from content storage', async () => {
      const config = { ...mockConfig, storage: STORAGE_CONTENT };
      getMigrationItems.mockResolvedValue([{ sys: { id: '100' } }, { sys: { id: '200' } }, { sys: { id: '150' } }]);

      const result = await getLatestVersion(config);

      expect(result).toBe(200);
    });

    it('should get latest version from tag storage', async () => {
      const mockTag = { name: '123' };
      mockClient.getTag.mockResolvedValue(mockTag);

      const result = await getLatestVersion(mockConfig);

      expect(result).toBe(123);
    });

    it('should handle errors in content storage', async () => {
      const config = { ...mockConfig, storage: STORAGE_CONTENT };
      getMigrationItems.mockRejectedValue(new Error('Failed to fetch'));
      mockClient.getTag.mockResolvedValue({ name: '100' });

      const result = await getLatestVersion(config);

      expect(result).toBe(100);
    });
  });
});

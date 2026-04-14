import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { STORAGE_CONTENT, STORAGE_TAG, STATE_SUCCESS, STATE_FAILURE } from './config';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'contentful-backend-'));

const writeMigrationFiles = async (directory, files) => {
  await Promise.all(
    files.map(async ([name, content = '// migration\n']) => {
      await fs.writeFile(path.join(directory, name), content);
    })
  );

  return files.map(([name]) => path.join(directory, name));
};

describe('backend helpers', () => {
  let progressBar;
  let getEnvironment;
  let getDefaultLocale;
  let getMigrationItems;
  let initializeContentModel;
  let migrateToContentStorage;
  let migrateToTagStorage;
  let getMigrationVersions;
  let getMigrationVersionFromTag;
  let getLatestVersion;
  let storeMigration;
  let getNewMigrations;
  let getVersionFromFile;

  beforeEach(() => {
    vi.clearAllMocks();
    progressBar = {
      start: vi.fn(),
      update: vi.fn(),
      stop: vi.fn(),
    };
    getEnvironment = vi.fn();
    getDefaultLocale = vi.fn();
    getMigrationItems = vi.fn();

    ({
      initializeContentModel,
      migrateToContentStorage,
      migrateToTagStorage,
      getMigrationVersions,
      getMigrationVersionFromTag,
      getLatestVersion,
      storeMigration,
      getNewMigrations,
      getVersionFromFile,
    } = loadCjsModule('./lib/backend.js', {
      'cli-progress': {
        Presets: { legacy: {} },
        SingleBar: vi.fn(function MockSingleBar() {
          return progressBar;
        }),
      },
      './contentful': {
        getEnvironment,
        getDefaultLocale,
        getMigrationItems,
      },
    }));
  });

  it('initializes the migration content model when it is missing', async () => {
    const contentType = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const editorInterface = {
      controls: [{ fieldId: 'message' }, { fieldId: 'state' }],
      update: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      sys: { id: 'preview' },
      getContentTypes: vi.fn().mockResolvedValue({ items: [] }),
      createContentTypeWithId: vi.fn().mockResolvedValue(contentType),
      getEditorInterfaceForContentType: vi.fn().mockResolvedValue(editorInterface),
    };
    getEnvironment.mockResolvedValue(client);

    await initializeContentModel({ migrationContentTypeId: 'contentful-migrations' });

    expect(client.createContentTypeWithId).toHaveBeenCalledWith(
      'contentful-migrations',
      expect.objectContaining({
        name: 'Migrations',
        displayField: 'name',
      })
    );
    expect(contentType.publish).toHaveBeenCalled();
    expect(editorInterface.controls[0]).toEqual(
      expect.objectContaining({
        fieldId: 'message',
        widgetNamespace: 'builtin',
        widgetId: 'multipleLine',
      })
    );
    expect(editorInterface.controls[1]).toEqual(
      expect.objectContaining({
        fieldId: 'state',
        widgetNamespace: 'builtin',
        widgetId: 'radio',
      })
    );
    expect(editorInterface.update).toHaveBeenCalled();
  });

  it('skips initialization when the migration content type already exists', async () => {
    const client = {
      sys: { id: 'preview' },
      getContentTypes: vi.fn().mockResolvedValue({
        items: [{ sys: { id: 'contentful-migrations' } }],
      }),
      createContentTypeWithId: vi.fn(),
    };
    getEnvironment.mockResolvedValue(client);

    await initializeContentModel({ migrationContentTypeId: 'contentful-migrations' });

    expect(client.createContentTypeWithId).not.toHaveBeenCalled();
  });

  it('stores migration entries in content storage and publishes successful states', async () => {
    const entry = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      getEntry: vi.fn().mockRejectedValue(new Error('missing')),
      createEntryWithId: vi.fn().mockResolvedValue(entry),
    };
    getEnvironment.mockResolvedValue(client);
    getDefaultLocale.mockResolvedValue('en-US');

    await storeMigration(
      {
        version: 123,
        name: '123-create-article.js',
        state: STATE_SUCCESS,
      },
      {
        storage: STORAGE_CONTENT,
        migrationContentTypeId: 'contentful-migrations',
      }
    );

    expect(client.createEntryWithId).toHaveBeenCalledWith('contentful-migrations', '123', {
      fields: {
        version: { 'en-US': '123' },
        name: { 'en-US': '123-create-article.js' },
        state: { 'en-US': STATE_SUCCESS },
        message: { 'en-US': '' },
      },
    });
    expect(entry.publish).toHaveBeenCalled();
  });

  it('updates existing migration entries and unpublishes failures', async () => {
    const entry = {
      fields: {},
      publish: vi.fn(),
      unpublish: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      getEntry: vi.fn().mockResolvedValue(entry),
      createEntryWithId: vi.fn(),
    };
    getEnvironment.mockResolvedValue(client);

    await storeMigration(
      {
        version: 123,
        name: '123-create-article.js',
        state: STATE_FAILURE,
        message: 'Failed badly',
      },
      {
        storage: STORAGE_CONTENT,
        migrationContentTypeId: 'contentful-migrations',
        defaultLocale: 'en-US',
      }
    );

    expect(entry.fields.name).toEqual({ 'en-US': '123-create-article.js' });
    expect(entry.fields.state).toEqual({ 'en-US': STATE_FAILURE });
    expect(entry.fields.message).toEqual({ 'en-US': 'Failed badly' });
    expect(entry.unpublish).toHaveBeenCalled();
  });

  it('stores migration versions in tag storage', async () => {
    const tag = {
      name: '10',
      update: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      getTag: vi.fn().mockResolvedValue(tag),
      createTag: vi.fn(),
    };
    getEnvironment.mockResolvedValue(client);

    await storeMigration(
      {
        version: 200,
        state: STATE_SUCCESS,
      },
      {
        storage: STORAGE_TAG,
        fieldId: 'migration',
      }
    );

    expect(tag.name).toBe('200');
    expect(tag.update).toHaveBeenCalled();
  });

  it('migrates executed tag versions into content entries', async () => {
    const tag = {
      name: '200',
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      sys: { id: 'preview' },
      getTag: vi.fn().mockResolvedValue(tag),
      getEntry: vi.fn().mockRejectedValue(new Error('missing')),
      createEntryWithId: vi.fn().mockResolvedValue({
        publish: vi.fn().mockResolvedValue(undefined),
      }),
    };
    const directory = await makeTempDir();

    await writeMigrationFiles(directory, [['100-first.js'], ['200-second.cjs'], ['300-third.js']]);

    getEnvironment.mockResolvedValue(client);

    await migrateToContentStorage({
      directory,
      fieldId: 'migration',
      defaultLocale: 'en-US',
      migrationContentTypeId: 'contentful-migrations',
    });

    expect(client.createEntryWithId).toHaveBeenCalledTimes(2);
    expect(progressBar.start).toHaveBeenCalledWith(2, 0);
    expect(progressBar.update).toHaveBeenCalledTimes(2);
    expect(progressBar.stop).toHaveBeenCalled();
    expect(tag.delete).toHaveBeenCalled();
  });

  it('migrates content storage back to tags and removes the model', async () => {
    const currentTag = { name: '100' };
    const updatableTag = {
      name: '100',
      update: vi.fn().mockResolvedValue(undefined),
    };
    const entryOne = {
      unpublish: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const entryTwo = {
      unpublish: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const contentType = {
      unpublish: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      getTag: vi.fn().mockResolvedValueOnce(currentTag).mockResolvedValueOnce(updatableTag),
      getEntries: vi.fn().mockResolvedValue({
        items: [
          {
            sys: { id: '100' },
            fields: { state: { 'en-US': STATE_SUCCESS } },
          },
          {
            sys: { id: '200' },
            fields: { state: { 'en-US': STATE_SUCCESS } },
          },
        ],
      }),
      getEntry: vi.fn().mockResolvedValueOnce(entryOne).mockResolvedValueOnce(entryTwo),
      getContentType: vi.fn().mockResolvedValue(contentType),
    };

    getEnvironment.mockResolvedValue(client);
    getDefaultLocale.mockResolvedValue('en-US');

    await migrateToTagStorage({
      migrationContentTypeId: 'contentful-migrations',
      fieldId: 'migration',
    });

    expect(updatableTag.name).toBe('200');
    expect(updatableTag.update).toHaveBeenCalled();
    expect(entryOne.delete).toHaveBeenCalled();
    expect(entryTwo.delete).toHaveBeenCalled();
    expect(contentType.unpublish).toHaveBeenCalled();
    expect(contentType.delete).toHaveBeenCalled();
    expect(progressBar.start).toHaveBeenCalledWith(2, 0);
  });

  it('reads migration versions from entries and tags', async () => {
    getMigrationItems.mockResolvedValue([{ sys: { id: '100' } }, { sys: { id: '200' } }]);

    await expect(getMigrationVersions({})).resolves.toEqual([100, 200]);
    await expect(getLatestVersion({ storage: STORAGE_CONTENT })).resolves.toBe(200);
  });

  it('falls back from tags to legacy content fields when resolving versions', async () => {
    const client = {
      getTag: vi.fn().mockRejectedValue(new Error('missing tag')),
      getEntries: vi.fn().mockResolvedValue({
        items: [
          {
            fields: {
              migration: {
                'en-US': '321',
              },
            },
          },
        ],
      }),
    };

    getEnvironment.mockResolvedValue(client);
    getDefaultLocale.mockResolvedValue('en-US');

    await expect(
      getMigrationVersionFromTag({
        contentTypeId: 'legacy-config',
        fieldId: 'migration',
      })
    ).resolves.toBe(321);
  });

  it('reads the latest tag version when content storage is not in use', async () => {
    const client = {
      getTag: vi.fn().mockResolvedValue({ name: '444' }),
    };
    getEnvironment.mockResolvedValue(client);

    await expect(
      getLatestVersion({
        storage: STORAGE_TAG,
        fieldId: 'migration',
      })
    ).resolves.toBe(444);
  });

  it('extracts numeric versions from migration file names', () => {
    expect(getVersionFromFile('/tmp/123456-create-article.js')).toBe(123456);
    expect(getVersionFromFile('/tmp/no-version.js')).toBeUndefined();
  });

  it('finds unexecuted tag-based migrations in sorted order', async () => {
    const directory = await makeTempDir();
    const files = await writeMigrationFiles(directory, [['300-third.js'], ['100-first.js'], ['200-second.js']]);
    const client = {
      getTag: vi.fn().mockResolvedValue({ name: '150' }),
    };

    getEnvironment.mockResolvedValue(client);

    await expect(
      getNewMigrations({
        directory,
        storage: STORAGE_TAG,
        fieldId: 'migration',
      })
    ).resolves.toEqual([files[2], files[0]]);
  });

  it('filters already executed content-storage migrations', async () => {
    const directory = await makeTempDir();
    const files = await writeMigrationFiles(directory, [['100-first.js'], ['200-second.js'], ['300-third.js']]);

    getMigrationItems.mockResolvedValue([{ sys: { id: '100' } }, { sys: { id: '300' } }]);

    await expect(
      getNewMigrations({
        directory,
        storage: STORAGE_CONTENT,
        migrationContentTypeId: 'contentful-migrations',
      })
    ).resolves.toEqual([files[1]]);
  });

  it('returns all migrations when the initial content model migration is scheduled', async () => {
    const directory = await makeTempDir();
    const files = await writeMigrationFiles(directory, [
      ['100-init.js', "migration.createContentType('contentful-migrations')\n"],
      ['200-second.js', '// later migration\n'],
    ]);

    getMigrationItems.mockRejectedValue(new Error('missing content type'));

    await expect(
      getNewMigrations({
        directory,
        storage: STORAGE_CONTENT,
        migrationContentTypeId: 'contentful-migrations',
      })
    ).resolves.toEqual(files);
  });

  it('exits when content storage is missing and there is no bootstrap migration', async () => {
    const directory = await makeTempDir();
    await writeMigrationFiles(directory, [['100-init.js', '// unrelated migration\n']]);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getMigrationItems.mockRejectedValue(new Error('missing content type'));

    await expect(
      getNewMigrations({
        directory,
        storage: STORAGE_CONTENT,
        migrationContentTypeId: 'contentful-migrations',
      })
    ).rejects.toThrow('exit');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

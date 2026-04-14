import { vi } from 'vitest';
import { STORAGE_TAG, STORAGE_CONTENT, STATE_SUCCESS } from './config';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

describe('version helpers', () => {
  let storeMigration;
  let getEnvironment;
  let versionAdd;
  let versionDelete;

  beforeEach(() => {
    vi.clearAllMocks();
    storeMigration = vi.fn();
    getEnvironment = vi.fn();
    ({ versionAdd, versionDelete } = loadCjsModule('./lib/version.js', {
      './backend': { storeMigration },
      './contentful': { getEnvironment },
    }));
  });

  it('adds a migration entry for content storage', async () => {
    await versionAdd('/tmp/migrations/123456-create-page.js', { storage: STORAGE_CONTENT });

    expect(storeMigration).toHaveBeenCalledWith(
      {
        version: '123456',
        name: '123456-create-page.js',
        state: STATE_SUCCESS,
        message: 'Manually added',
      },
      { storage: STORAGE_CONTENT }
    );
  });

  it('deletes a migration entry for content storage', async () => {
    const deleteEntry = vi.fn().mockResolvedValue(undefined);
    getEnvironment.mockResolvedValue({
      getEntry: vi.fn().mockResolvedValue({ delete: deleteEntry }),
    });

    await versionDelete('/tmp/migrations/123456-create-page.js', { storage: STORAGE_CONTENT });

    expect(getEnvironment).toHaveBeenCalledWith({ storage: STORAGE_CONTENT });
    expect(deleteEntry).toHaveBeenCalled();
  });

  it('rejects the version command for tag storage', async () => {
    await expect(versionAdd('123-create-page.js', { storage: STORAGE_TAG })).rejects.toThrow(
      'The version command is not available for the "tag" storage'
    );
    await expect(versionDelete('123-create-page.js', { storage: STORAGE_TAG })).rejects.toThrow(
      'The version command is not available for the "tag" storage'
    );
  });
});

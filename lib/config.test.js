import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { getConfig, STORAGE_CONTENT, STORAGE_TAG, STATE_SUCCESS, STATE_FAILURE } from './config';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

const createTempProject = async (migrations) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'contentful-config-'));
  await fs.writeFile(
    path.join(cwd, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-project',
        version: '1.0.0',
        migrations,
      },
      null,
      2
    )
  );
  return cwd;
};

describe('config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads migration config from package.json and applies defaults', async () => {
    const cwd = await createTempProject({
      storage: STORAGE_CONTENT,
      fieldId: 'migration',
    });

    const result = await getConfig({
      cwd,
      environmentId: 'staging',
    });

    expect(result.storage).toBe(STORAGE_CONTENT);
    expect(result.fieldId).toBe('migration');
    expect(result.environmentId).toBe('staging');
    expect(result.host).toBe('api.contentful.com');
    expect(result.directory).toBe(path.join(cwd, 'migrations'));
    expect(result.missingStorageModel).toBe(false);
  });

  it('does not flag missing storage when tag storage is selected', async () => {
    const cwd = await createTempProject({
      storage: STORAGE_TAG,
    });

    const result = await getConfig({ cwd });

    expect(result.storage).toBe(STORAGE_TAG);
    expect(result.missingStorageModel).toBe(false);
  });

  it('skips the prompt when yes is set', async () => {
    const Confirm = vi.fn();
    const { confirm } = loadCjsModule('./lib/config.js', {
      enquirer: { Confirm },
    });

    await expect(confirm({ yes: true })).resolves.toBe(true);
    expect(Confirm).not.toHaveBeenCalled();
  });

  it('runs a confirmation prompt when interaction is required', async () => {
    const run = vi.fn().mockResolvedValue(false);
    const Confirm = vi.fn(function MockConfirm() {
      return { run };
    });
    const { confirm } = loadCjsModule('./lib/config.js', {
      enquirer: { Confirm },
    });

    await expect(confirm({ message: 'Ship it?' })).resolves.toBe(false);

    expect(Confirm).toHaveBeenCalledWith({
      name: 'check',
      message: 'Ship it?',
      initial: true,
    });
    expect(run).toHaveBeenCalled();
  });

  it('exports storage and state constants', () => {
    expect(STORAGE_CONTENT).toBe('content');
    expect(STORAGE_TAG).toBe('tag');
    expect(STATE_SUCCESS).toBe('success');
    expect(STATE_FAILURE).toBe('failure');
  });
});

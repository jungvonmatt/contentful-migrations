import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

const makeTempProject = async (packageJson = { name: 'fixture-project', version: '1.0.0' }) => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'contentful-migration-'));
  await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify(packageJson, null, 2));
  return cwd;
};

const withCwd = async (cwd, fn) => {
  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    return await fn();
  } finally {
    process.chdir(previousCwd);
  }
};

describe('migration helpers', () => {
  let fsExtra;
  let prettier;
  let runMigration;
  let getContentTypes;
  let generateMigrationScript;
  let getEnvironment;
  let getOrganizationId;
  let confirm;
  let storeMigration;
  let getNewMigrations;
  let getVersionFromFile;
  let createMigration;
  let fetchMigration;
  let executeMigration;
  let runMigrations;

  beforeEach(() => {
    vi.clearAllMocks();
    fsExtra = {
      outputFile: vi.fn().mockResolvedValue(undefined),
    };
    prettier = {
      resolveConfig: vi.fn().mockResolvedValue({ semi: false }),
      format: vi.fn((content) => content),
    };
    runMigration = vi.fn();
    getContentTypes = vi.fn();
    generateMigrationScript = vi.fn();
    getEnvironment = vi.fn();
    getOrganizationId = vi.fn();
    confirm = vi.fn();
    storeMigration = vi.fn();
    getNewMigrations = vi.fn();
    getVersionFromFile = vi.fn();

    ({ createMigration, fetchMigration, executeMigration, runMigrations } = loadCjsModule('./lib/migration.js', {
      'fs-extra': fsExtra,
      prettier,
      'contentful-migration/built/bin/cli': { runMigration },
      'contentful-cli/dist/lib/cmds/space_cmds/generate_cmds/migration': {
        getContentTypes,
        generateMigrationScript,
      },
      './contentful': {
        getEnvironment,
        getOrganizationId,
      },
      './config': {
        confirm,
        STATE_SUCCESS: 'success',
        STATE_FAILURE: 'failure',
      },
      './backend': {
        storeMigration,
        getNewMigrations,
        getVersionFromFile,
      },
    }));
  });

  it('creates a blank migration file with the wrapper header', async () => {
    const cwd = await makeTempProject();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123456);

    await withCwd(cwd, () => createMigration({ directory: '/tmp/migrations' }));

    expect(fsExtra.outputFile).toHaveBeenCalledWith(
      path.join('/tmp/migrations', '123456-migration.js'),
      expect.stringContaining("const { withHelpers } = require('@jungvonmatt/contentful-migrations');")
    );
    expect(prettier.format).toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('falls back to default prettier settings when config resolution fails', async () => {
    const cwd = await makeTempProject();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(100);
    prettier.resolveConfig.mockRejectedValueOnce(new Error('missing config'));

    await withCwd(cwd, () => createMigration({ directory: '/tmp/migrations', verbose: true }));

    expect(prettier.format).toHaveBeenLastCalledWith(expect.any(String), { parser: 'babel' });

    nowSpy.mockRestore();
  });

  it('fetches migration files and rewrites default locale references', async () => {
    const cwd = await makeTempProject({
      name: 'fixture-project',
      version: '1.0.0',
      type: 'module',
    });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(200);
    const client = { id: 'environment-client' };
    getEnvironment.mockResolvedValue(client);
    getContentTypes.mockResolvedValue([{ sys: { id: 'article' } }]);
    generateMigrationScript.mockResolvedValue(
      Buffer.from("module.exports = function (migration) {\n  field.defaultValue({ 'de-DE': 'Example' })\n};\n")
    );

    await withCwd(cwd, () =>
      fetchMigration({
        directory: '/tmp/migrations',
        contentType: ['article'],
      })
    );

    expect(getContentTypes).toHaveBeenCalledWith(client, 'article');
    expect(fsExtra.outputFile).toHaveBeenCalledWith(
      path.join('/tmp/migrations', '200-create-article-migration.cjs'),
      expect.stringContaining('const defaultLocale = await helpers.locale.getDefaultLocale();')
    );
    expect(fsExtra.outputFile).toHaveBeenCalledWith(
      path.join('/tmp/migrations', '200-create-article-migration.cjs'),
      expect.stringContaining('[defaultLocale.code]')
    );

    nowSpy.mockRestore();
  });

  it('wraps generated migrations even when there is no default value', async () => {
    const cwd = await makeTempProject();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(201);
    getEnvironment.mockResolvedValue({});
    getContentTypes.mockResolvedValue([{ sys: { id: 'article' } }]);
    generateMigrationScript.mockResolvedValue(Buffer.from('module.exports = function (migration) {\n};\n'));

    await withCwd(cwd, () =>
      fetchMigration({
        directory: '/tmp/migrations',
      })
    );

    expect(fsExtra.outputFile).toHaveBeenCalledWith(
      path.join('/tmp/migrations', '201-create-article-migration.js'),
      expect.stringContaining('module.exports = withHelpers(async function (migration, context, helpers) {')
    );

    nowSpy.mockRestore();
  });

  it('executes a migration and stores success metadata', async () => {
    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getOrganizationId.mockResolvedValue('org-1');
    getVersionFromFile.mockReturnValue(123);
    confirm.mockResolvedValue(true);

    await expect(
      executeMigration('123-create-article.js', {
        managementToken: 'token',
        spaceId: 'space-1',
        requestBatchSize: 50,
        host: 'api.eu.contentful.com',
      })
    ).resolves.toBe(123);

    expect(runMigration).toHaveBeenCalledWith({
      filePath: path.resolve('123-create-article.js'),
      accessToken: 'token',
      spaceId: 'space-1',
      environmentId: 'preview',
      organizationId: 'org-1',
      requestBatchSize: 50,
      yes: true,
      host: 'api.eu.contentful.com',
    });
    expect(storeMigration).toHaveBeenCalledWith(
      {
        version: 123,
        name: '123-create-article.js',
        state: 'success',
      },
      expect.any(Object)
    );
  });

  it('short-circuits migration execution when the user does not confirm', async () => {
    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getOrganizationId.mockResolvedValue('org-1');
    getVersionFromFile.mockReturnValue(123);
    confirm.mockResolvedValue(false);

    await expect(
      executeMigration('123-create-article.js', { managementToken: 'token', spaceId: 'space-1' })
    ).resolves.toBeUndefined();

    expect(runMigration).not.toHaveBeenCalled();
  });

  it('stores failure details when the migration runner throws', async () => {
    const error = {
      errors: [{ message: 'First failure' }, { message: 'Second failure' }],
    };
    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getOrganizationId.mockResolvedValue('org-1');
    getVersionFromFile.mockReturnValue(456);
    confirm.mockResolvedValue(true);
    runMigration.mockRejectedValue(error);

    await expect(
      executeMigration('456-update-article.js', {
        managementToken: 'token',
        spaceId: 'space-1',
      })
    ).rejects.toBe(error);

    expect(storeMigration).toHaveBeenCalledWith(
      {
        version: 456,
        name: '456-update-article.js',
        state: 'failure',
        message: 'First failure\nSecond failure',
      },
      expect.any(Object)
    );
  });

  it('exits for invalid migration file names', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getOrganizationId.mockResolvedValue('org-1');
    getVersionFromFile.mockReturnValue(undefined);

    await expect(
      executeMigration('invalid-name.js', {
        managementToken: 'token',
        spaceId: 'space-1',
      })
    ).rejects.toThrow('exit');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('runs all new migrations and continues when bail is disabled', async () => {
    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getNewMigrations.mockResolvedValue(['100-first.js', '200-second.js']);
    getVersionFromFile.mockImplementation((file) => Number.parseInt(file, 10));
    confirm.mockResolvedValue(true);
    runMigration.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'));

    await expect(
      runMigrations({
        managementToken: 'token',
        spaceId: 'space-1',
        bail: false,
      })
    ).resolves.toBeUndefined();

    expect(runMigration).toHaveBeenCalledTimes(2);
  });

  it('rethrows migration failures when bail is enabled', async () => {
    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getNewMigrations.mockResolvedValue(['100-first.js', '200-second.js']);
    getVersionFromFile.mockImplementation((file) => Number.parseInt(file, 10));
    confirm.mockResolvedValue(true);
    runMigration.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'));

    await expect(
      runMigrations({
        managementToken: 'token',
        spaceId: 'space-1',
        bail: true,
      })
    ).rejects.toThrow('boom');
  });

  it('logs and rethrows migration discovery errors', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('missing content type');

    getEnvironment.mockResolvedValue({ sys: { id: 'preview' } });
    getNewMigrations.mockRejectedValue(error);

    await expect(runMigrations({ managementToken: 'token', spaceId: 'space-1' })).rejects.toBe(error);

    expect(logSpy).toHaveBeenCalledWith('missing content type');

    logSpy.mockRestore();
  });
});

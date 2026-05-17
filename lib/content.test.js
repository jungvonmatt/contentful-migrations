import { vi } from 'vitest';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

const createEntry = (id) => ({
  sys: { id },
  fields: {},
});

describe('transferContent', () => {
  let prompt;
  let contentfulImport;
  let getContent;
  let getContentId;
  let getLinkedAssets;
  let getLinkedEntries;
  let diff;
  let buildTree;
  let getLatestVersion;
  let confirm;
  let transferContent;

  beforeEach(() => {
    vi.clearAllMocks();
    prompt = vi.fn();
    contentfulImport = vi.fn();
    getContent = vi.fn();
    getContentId = vi.fn((node) => node?.sys?.id);
    getLinkedAssets = vi.fn();
    getLinkedEntries = vi.fn();
    diff = vi.fn();
    buildTree = vi.fn();
    getLatestVersion = vi.fn();
    confirm = vi.fn();

    ({ transferContent } = loadCjsModule('./lib/content.js', {
      inquirer: { prompt },
      'contentful-import': contentfulImport,
      './contentful': {
        getContent,
        getContentId,
        getLinkedAssets,
        getLinkedEntries,
      },
      './diff': { diff },
      './tree': { buildTree },
      './backend': { getLatestVersion },
      './config': { confirm },
    }));
  });

  it('rejects when source and destination environments are on different migration versions', async () => {
    getLatestVersion.mockResolvedValueOnce(100).mockResolvedValueOnce(200);

    await expect(
      transferContent({
        sourceEnvironmentId: 'preview',
        destEnvironmentId: 'master',
      }),
    ).rejects.toThrow('Different migration states detected.');
  });

  it('stops early when there is no content to transfer', async () => {
    getLatestVersion.mockResolvedValue(100);
    getContent
      .mockResolvedValueOnce({
        entries: [],
        assets: [],
        filteredEntries: [],
        contentTypes: [],
      })
      .mockResolvedValueOnce({
        entries: [],
        assets: [],
        contentTypes: [],
      });
    getLinkedAssets.mockReturnValue([]);

    await transferContent({
      sourceEnvironmentId: 'preview',
      destEnvironmentId: 'master',
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(contentfulImport).not.toHaveBeenCalled();
  });

  it('resolves conflicts, renders a tree, and imports filtered content', async () => {
    const sourceEntry = createEntry('entry-1');
    const linkedEntry = createEntry('entry-2');
    const destEntry = createEntry('entry-1');
    const asset = createEntry('asset-1');

    getLatestVersion.mockResolvedValue(100);
    getContent
      .mockResolvedValueOnce({
        entries: [sourceEntry, linkedEntry],
        assets: [asset],
        filteredEntries: [sourceEntry],
        contentTypes: [{ sys: { id: 'article' } }],
      })
      .mockResolvedValueOnce({
        entries: [destEntry],
        assets: [asset],
        contentTypes: [{ sys: { id: 'article' } }],
      });
    diff.mockImplementation((source, dest) => {
      if (!dest) {
        return undefined;
      }

      return {
        name: dest.sys.id,
      };
    });
    prompt.mockResolvedValue({
      'entry-1': true,
      'entry-2': true,
      'asset-1': true,
    });
    getLinkedEntries.mockReturnValue([linkedEntry]);
    getLinkedAssets.mockReturnValue([asset]);
    buildTree.mockReturnValue('content-tree');
    confirm.mockResolvedValue(true);

    await transferContent({
      sourceEnvironmentId: 'preview',
      destEnvironmentId: 'master',
      spaceId: 'space-id',
      managementToken: 'token',
      contentType: 'article',
      diffConflicts: true,
      verbose: true,
    });

    expect(getLinkedEntries).toHaveBeenCalledWith([sourceEntry], [sourceEntry, linkedEntry], {
      includeIds: ['entry-2'],
    });
    expect(buildTree).toHaveBeenCalledWith({
      contentTypes: [{ sys: { id: 'article' } }],
      entries: [sourceEntry, linkedEntry],
      assets: [asset],
    });
    expect(contentfulImport).toHaveBeenCalledWith({
      spaceId: 'space-id',
      managementToken: 'token',
      environmentId: 'master',
      skipContentModel: true,
      content: {
        entries: [sourceEntry, linkedEntry],
        assets: [asset],
      },
    });
  });

  it('logs import errors after confirming an overwrite run', async () => {
    const sourceEntry = createEntry('entry-1');
    const destEntry = createEntry('entry-1');
    const asset = createEntry('asset-1');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    getLatestVersion.mockResolvedValue(100);
    getContent
      .mockResolvedValueOnce({
        entries: [sourceEntry],
        assets: [asset],
        contentTypes: [{ sys: { id: 'article' } }],
      })
      .mockResolvedValueOnce({
        entries: [destEntry],
        assets: [asset],
        contentTypes: [{ sys: { id: 'article' } }],
      });
    diff.mockReturnValue({ name: 'entry-1' });
    getLinkedAssets.mockReturnValue([asset]);
    confirm.mockResolvedValue(true);
    contentfulImport.mockRejectedValue(new Error('Import failed'));

    await transferContent({
      sourceEnvironmentId: 'preview',
      destEnvironmentId: 'master',
      spaceId: 'space-id',
      managementToken: 'token',
      forceOverwrite: true,
    });

    expect(contentfulImport).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Import failed');

    logSpy.mockRestore();
  });
});

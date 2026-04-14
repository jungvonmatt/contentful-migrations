import { vi } from 'vitest';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

describe('buildTree', () => {
  it('renders linked entries and assets as an ascii tree', () => {
    const { buildTree } = loadCjsModule('./lib/tree.js', {
      './contentful': {
        getNodeName: vi.fn((node) => node.label),
        getContentTypeId: vi.fn((node) => node.contentTypeId),
        getContentId: vi.fn((node) => node.sys.id),
      },
    });

    const article = {
      sys: { id: 'entry-1' },
      contentTypeId: 'article',
      label: '[Article] Root',
      fields: {
        hero: {
          'en-US': { sys: { type: 'Link', linkType: 'Asset', id: 'asset-1' } },
        },
        related: {
          'en-US': [{ sys: { type: 'Link', linkType: 'Entry', id: 'entry-2' } }],
        },
      },
    };
    const related = {
      sys: { id: 'entry-2' },
      contentTypeId: 'article',
      label: '[Article] Child',
      fields: {},
    };
    const asset = {
      sys: { id: 'asset-1' },
      contentTypeId: 'asset',
      label: '[Asset] Hero image',
      fields: {},
    };

    const tree = buildTree({
      entries: [article, related],
      assets: [asset],
      contentTypes: [{ sys: { id: 'article' } }],
    });

    expect(tree).toContain('[Article] Root');
    expect(tree).toContain('[Article] Child');
    expect(tree).toContain('[Asset] Hero image');
  });
});

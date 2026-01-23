const { buildTree } = require('./tree');

jest.mock('ascii-tree', () => ({
  generate: (input) => `ASCII_TREE:\n${input}`,
}));

describe('buildTree', () => {
  const createEntry = (id, contentTypeId, fields = {}) => ({
    sys: {
      id,
      contentType: {
        sys: { id: contentTypeId },
      },
    },
    fields,
  });

  const createAsset = (id, fields = {}) => ({
    sys: { id },
    fields,
  });

  const createContentType = (id, name, displayField = 'name') => ({
    sys: { id },
    name,
    displayField,
  });

  describe('basic tree building', () => {
    it('should build tree with single entry', () => {
      const entries = [createEntry('entry1', 'article', { name: { 'en-US': 'Article 1' } })];
      const contentTypes = [createContentType('article', 'Article')];

      const result = buildTree({ entries, assets: [], contentTypes });

      expect(result).toContain('Article 1');
      expect(result).toContain('ASCII_TREE');
    });

    it('should build tree with multiple entries', () => {
      const entries = [
        createEntry('entry1', 'article', { name: { 'en-US': 'Article 1' } }),
        createEntry('entry2', 'article', { name: { 'en-US': 'Article 2' } }),
      ];
      const contentTypes = [createContentType('article', 'Article')];

      const result = buildTree({ entries, assets: [], contentTypes });

      expect(result).toContain('Article 1');
      expect(result).toContain('Article 2');
    });

    it('should build tree with linked entries', () => {
      const entries = [
        createEntry('entry1', 'article', {
          name: { 'en-US': 'Article 1' },
          author: {
            'en-US': {
              sys: { type: 'Link', linkType: 'Entry', id: 'entry2' },
            },
          },
        }),
        createEntry('entry2', 'author', { name: { 'en-US': 'Author 1' } }),
      ];
      const contentTypes = [createContentType('article', 'Article'), createContentType('author', 'Author')];

      const result = buildTree({ entries, assets: [], contentTypes });

      expect(result).toContain('Article 1');
      expect(result).toContain('Author 1');
    });

    it('should build tree with assets', () => {
      const assets = [createAsset('asset1', { title: { 'en-US': 'Image 1' } })];
      const entries = [
        createEntry('entry1', 'article', {
          name: { 'en-US': 'Article 1' },
          image: {
            'en-US': {
              sys: { type: 'Link', linkType: 'Asset', id: 'asset1' },
            },
          },
        }),
      ];
      const contentTypes = [createContentType('article', 'Article')];

      const result = buildTree({ entries, assets, contentTypes });

      expect(result).toContain('Article 1');
      expect(result).toContain('Image 1');
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', () => {
      const result = buildTree({ entries: [], assets: [], contentTypes: [] });

      expect(result).toBe('');
    });

    it('should handle undefined data', () => {
      const result = buildTree({});

      expect(result).toBe('');
    });

    it('should handle entries without content types', () => {
      const entries = [createEntry('entry1', 'article', { name: { 'en-US': 'Article 1' } })];

      const result = buildTree({ entries, assets: [], contentTypes: [] });

      // Entry shows up but content type is undefined
      expect(result).toContain('Article 1');
      expect(result).toContain('undefined');
    });

    it('should handle circular references without infinite loop', () => {
      // In circular references, both entries reference each other
      // The tree builder will show both as root nodes since they're in a cycle
      const entries = [
        createEntry('entry1', 'article', {
          name: { 'en-US': 'Article 1' },
          related: {
            'en-US': {
              sys: { type: 'Link', linkType: 'Entry', id: 'entry2' },
            },
          },
        }),
        createEntry('entry2', 'article', {
          name: { 'en-US': 'Article 2' },
          related: {
            'en-US': {
              sys: { type: 'Link', linkType: 'Entry', id: 'entry1' },
            },
          },
        }),
      ];
      const contentTypes = [createContentType('article', 'Article')];

      // Should not throw or hang due to infinite recursion
      expect(() => buildTree({ entries, assets: [], contentTypes })).not.toThrow();
    });

    it('should handle arrays of links', () => {
      const entries = [
        createEntry('entry1', 'article', {
          name: { 'en-US': 'Article 1' },
          tags: {
            'en-US': [
              { sys: { type: 'Link', linkType: 'Entry', id: 'tag1' } },
              { sys: { type: 'Link', linkType: 'Entry', id: 'tag2' } },
            ],
          },
        }),
        createEntry('tag1', 'tag', { name: { 'en-US': 'Tag 1' } }),
        createEntry('tag2', 'tag', { name: { 'en-US': 'Tag 2' } }),
      ];
      const contentTypes = [createContentType('article', 'Article'), createContentType('tag', 'Tag')];

      const result = buildTree({ entries, assets: [], contentTypes });

      expect(result).toContain('Article 1');
      expect(result).toContain('Tag 1');
      expect(result).toContain('Tag 2');
    });

    it('should handle entries with title field fallback', () => {
      const entries = [
        createEntry('entry1', 'article', {
          title: { 'en-US': 'Article Title' },
        }),
      ];
      const contentTypes = [createContentType('article', 'Article', 'name')];

      const result = buildTree({ entries, assets: [], contentTypes });

      // Falls back to title when displayField (name) doesn't exist
      expect(result).toContain('Article Title');
    });

    it('should use displayField when available', () => {
      const entries = [
        createEntry('entry1', 'article', {
          title: { 'en-US': 'Article Title' },
          name: { 'en-US': 'Article Name' },
        }),
      ];
      const contentTypes = [createContentType('article', 'Article', 'title')];

      const result = buildTree({ entries, assets: [], contentTypes });

      expect(result).toContain('Article Title');
    });
  });
});

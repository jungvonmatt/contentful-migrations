const { diff } = require('./diff');
const {
  TYPE_SYMBOL,
  TYPE_TEXT,
  TYPE_RICHTEXT,
  TYPE_NUMBER,
  TYPE_DATE,
  TYPE_LOCATION,
  TYPE_ARRAY,
  TYPE_BOOLEAN,
  TYPE_LINK,
} = require('./contentful');

jest.mock('@contentful/rich-text-plain-text-renderer', () => ({
  documentToPlainTextString: (doc) => {
    return doc?.content?.[0]?.content?.[0]?.value || '';
  },
}));

describe('diff', () => {
  const createEntry = (id, contentTypeId, fields = {}) => ({
    sys: {
      id,
      contentType: {
        sys: { id: contentTypeId },
      },
      updatedAt: '2024-01-01T00:00:00Z',
    },
    fields,
  });

  const createContentType = (id, name, fields = []) => ({
    sys: { id },
    name,
    displayField: 'name',
    fields,
  });

  describe('basic diffing', () => {
    it('should return undefined when entries are identical', () => {
      const entry = createEntry('entry1', 'article', {
        name: { 'en-US': 'Test Article' },
      });

      const contentTypes = [createContentType('article', 'Article', [{ id: 'name', name: 'Name', type: TYPE_SYMBOL }])];

      const result = diff(entry, entry, contentTypes);

      expect(result).toBeUndefined();
    });

    it('should detect changes in Symbol fields', () => {
      const source = createEntry('entry1', 'article', {
        name: { 'en-US': 'New Name' },
      });

      const dest = createEntry('entry1', 'article', {
        name: { 'en-US': 'Old Name' },
      });

      const contentTypes = [createContentType('article', 'Article', [{ id: 'name', name: 'Name', type: TYPE_SYMBOL }])];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
      expect(result.name).toBe('entry1');
    });

    it('should detect changes in Text fields', () => {
      const source = createEntry('entry1', 'article', {
        description: { 'en-US': 'New description' },
      });

      const dest = createEntry('entry1', 'article', {
        description: { 'en-US': 'Old description' },
      });

      const contentTypes = [
        createContentType('article', 'Article', [{ id: 'description', name: 'Description', type: TYPE_TEXT }]),
      ];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in Number fields', () => {
      const source = createEntry('entry1', 'article', {
        count: { 'en-US': 10 },
      });

      const dest = createEntry('entry1', 'article', {
        count: { 'en-US': 5 },
      });

      const contentTypes = [
        createContentType('article', 'Article', [{ id: 'count', name: 'Count', type: TYPE_NUMBER }]),
      ];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in Boolean fields', () => {
      const source = createEntry('entry1', 'article', {
        published: { 'en-US': true },
      });

      const dest = createEntry('entry1', 'article', {
        published: { 'en-US': false },
      });

      const contentTypes = [
        createContentType('article', 'Article', [{ id: 'published', name: 'Published', type: TYPE_BOOLEAN }]),
      ];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in Date fields', () => {
      const source = createEntry('entry1', 'article', {
        date: { 'en-US': '2024-01-01' },
      });

      const dest = createEntry('entry1', 'article', {
        date: { 'en-US': '2023-01-01' },
      });

      const contentTypes = [createContentType('article', 'Article', [{ id: 'date', name: 'Date', type: TYPE_DATE }])];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in Location fields', () => {
      const source = createEntry('entry1', 'article', {
        location: { 'en-US': { lat: 10, lon: 20 } },
      });

      const dest = createEntry('entry1', 'article', {
        location: { 'en-US': { lat: 0, lon: 0 } },
      });

      const contentTypes = [
        createContentType('article', 'Article', [{ id: 'location', name: 'Location', type: TYPE_LOCATION }]),
      ];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in Link fields', () => {
      const source = createEntry('entry1', 'article', {
        author: {
          'en-US': {
            sys: { id: 'author2', type: 'Link', linkType: 'Entry' },
          },
        },
      });

      const dest = createEntry('entry1', 'article', {
        author: {
          'en-US': {
            sys: { id: 'author1', type: 'Link', linkType: 'Entry' },
          },
        },
      });

      const contentTypes = [
        createContentType('article', 'Article', [{ id: 'author', name: 'Author', type: TYPE_LINK, linkType: 'Entry' }]),
      ];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in Array fields', () => {
      const source = createEntry('entry1', 'article', {
        tags: {
          'en-US': [
            { sys: { id: 'tag1', type: 'Link', linkType: 'Entry' } },
            { sys: { id: 'tag2', type: 'Link', linkType: 'Entry' } },
          ],
        },
      });

      const dest = createEntry('entry1', 'article', {
        tags: {
          'en-US': [{ sys: { id: 'tag1', type: 'Link', linkType: 'Entry' } }],
        },
      });

      const contentTypes = [createContentType('article', 'Article', [{ id: 'tags', name: 'Tags', type: TYPE_ARRAY }])];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should detect changes in RichText fields', () => {
      const source = createEntry('entry1', 'article', {
        body: {
          'en-US': {
            content: [
              {
                content: [{ value: 'New content' }],
              },
            ],
          },
        },
      });

      const dest = createEntry('entry1', 'article', {
        body: {
          'en-US': {
            content: [
              {
                content: [{ value: 'Old content' }],
              },
            ],
          },
        },
      });

      const contentTypes = [
        createContentType('article', 'Article', [{ id: 'body', name: 'Body', type: TYPE_RICHTEXT }]),
      ];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing content types', () => {
      const source = createEntry('entry1', 'article', {
        name: { 'en-US': 'New Name' },
      });

      const dest = createEntry('entry1', 'article', {
        name: { 'en-US': 'Old Name' },
      });

      const result = diff(source, dest, []);

      expect(result).toBeDefined();
    });

    it('should handle undefined fields', () => {
      const source = createEntry('entry1', 'article', {
        name: { 'en-US': 'Name' },
      });

      const dest = createEntry('entry1', 'article', {});

      const contentTypes = [createContentType('article', 'Article', [{ id: 'name', name: 'Name', type: TYPE_SYMBOL }])];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should handle empty source value', () => {
      const source = createEntry('entry1', 'article', {
        name: { 'en-US': '' },
      });

      const dest = createEntry('entry1', 'article', {
        name: { 'en-US': 'Old Name' },
      });

      const contentTypes = [createContentType('article', 'Article', [{ id: 'name', name: 'Name', type: TYPE_SYMBOL }])];

      const result = diff(source, dest, contentTypes);

      expect(result).toBeDefined();
    });

    it('should handle null content types', () => {
      const source = createEntry('entry1', 'article', {
        name: { 'en-US': 'New Name' },
      });

      const dest = createEntry('entry1', 'article', {
        name: { 'en-US': 'Old Name' },
      });

      const result = diff(source, dest, null);

      expect(result).toBeDefined();
    });
  });
});

const { getContentTypeId, getEnvironmentId, getContentId, getContentName } = require('./contentful');

describe('contentful utilities', () => {
  describe('getContentTypeId', () => {
    it('should extract content type ID from node', () => {
      const node = {
        sys: {
          contentType: {
            sys: {
              id: 'article',
            },
          },
        },
      };

      expect(getContentTypeId(node)).toBe('article');
    });

    it('should return undefined for node without content type', () => {
      const node = {
        sys: {},
      };

      expect(getContentTypeId(node)).toBeUndefined();
    });

    it('should handle null node', () => {
      expect(getContentTypeId(null)).toBeUndefined();
    });

    it('should handle undefined node', () => {
      expect(getContentTypeId()).toBeUndefined();
    });
  });

  describe('getEnvironmentId', () => {
    it('should extract environment ID from node', () => {
      const node = {
        sys: {
          environment: {
            sys: {
              id: 'master',
            },
          },
        },
      };

      expect(getEnvironmentId(node)).toBe('master');
    });

    it('should return undefined for node without environment', () => {
      const node = {
        sys: {},
      };

      expect(getEnvironmentId(node)).toBeUndefined();
    });

    it('should handle null node', () => {
      expect(getEnvironmentId(null)).toBeUndefined();
    });

    it('should handle undefined node', () => {
      expect(getEnvironmentId()).toBeUndefined();
    });
  });

  describe('getContentId', () => {
    it('should extract ID from node', () => {
      const node = {
        sys: {
          id: 'entry-123',
        },
      };

      expect(getContentId(node)).toBe('entry-123');
    });

    it('should return undefined for node without sys', () => {
      const node = {};

      expect(getContentId(node)).toBeUndefined();
    });

    it('should handle null node', () => {
      expect(getContentId(null)).toBeUndefined();
    });

    it('should handle undefined node', () => {
      expect(getContentId()).toBeUndefined();
    });
  });

  describe('getContentName', () => {
    it('should extract name from displayField', () => {
      const node = {
        sys: { id: 'entry-1' },
        fields: {
          internalName: { 'en-US': 'Internal Name' },
          title: { 'en-US': 'My Title' },
          name: { 'en-US': 'My Name' },
        },
      };

      expect(getContentName(node, 'internalName')).toBe('Internal Name');
    });

    it('should fallback to name field when displayField not found', () => {
      const node = {
        sys: { id: 'entry-1' },
        fields: {
          name: { 'en-US': 'My Name' },
        },
      };

      expect(getContentName(node, 'nonexistent')).toBe('My Name');
    });

    it('should fallback to title field', () => {
      const node = {
        sys: { id: 'entry-1' },
        fields: {
          title: { 'en-US': 'My Title' },
        },
      };

      expect(getContentName(node, 'nonexistent')).toBe('My Title');
    });

    it('should fallback to id field', () => {
      const node = {
        sys: { id: 'entry-1' },
        fields: {
          id: { 'en-US': 'custom-id' },
        },
      };

      expect(getContentName(node, 'nonexistent')).toBe('custom-id');
    });

    it('should fallback to sys.id when no fields match', () => {
      const node = {
        sys: { id: 'entry-1' },
        fields: {},
      };

      expect(getContentName(node, 'nonexistent')).toBe('entry-1');
    });

    it('should return "unknown" when sys.id is missing', () => {
      const node = {
        sys: {},
        fields: {},
      };

      expect(getContentName(node, 'nonexistent')).toBe('unknown');
    });

    it('should skip non-string values', () => {
      const node = {
        sys: { id: 'entry-1' },
        fields: {
          name: { 'en-US': { complex: 'object' } },
          title: { 'en-US': 'My Title' },
        },
      };

      expect(getContentName(node, 'name')).toBe('My Title');
    });

    it('should handle node without fields', () => {
      const node = {
        sys: { id: 'entry-1' },
      };

      expect(getContentName(node, 'name')).toBe('entry-1');
    });
  });
});

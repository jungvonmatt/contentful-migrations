const { getValidationHelpers } = require('./validation');

describe('getValidationHelpers', () => {
  const getTestContentType = () => ({
    fields: [
      {
        id: 'selectWithOtherValidationProps',
        type: 'Text',
        items: [],
        validations: [
          {
            foo: 'test',
          },
          {
            in: ['foo', 'bar', 'baz'],
            message: 'Some message',
          },
        ],
      },
      {
        id: 'select',
        type: 'Text',
        items: [],
        validations: [
          {
            in: ['foo', 'bar', 'baz'],
          },
        ],
      },
      {
        id: 'reference',
        type: 'Text',
        validations: [
          {
            linkContentType: ['foo', 'bar', 'baz'],
          },
        ],
      },
      {
        id: 'string-array',
        type: 'Array',
        items: [],
      },
    ],
  });

  const context = {
    makeRequest: () => Promise.resolve(getTestContentType()),
  };

  let resultValidation;

  const migration = {
    editContentType: () => ({
      editField: () => ({
        validations: (validationObject) => {
          resultValidation = validationObject;
        },
      }),
    }),
  };

  beforeEach(() => {
    resultValidation = undefined;
  });

  describe('addInValues', () => {
    it('should add values at the end', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.addInValues('some-content-type', 'selectWithOtherValidationProps', 'bat');
      expect(resultValidation).toEqual([
        {
          foo: 'test',
        },
        {
          in: ['foo', 'bar', 'baz', 'bat'],
          message: 'Some message',
        },
      ]);
    });

    it('should only add new values', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.addInValues('some-content-type', 'select', ['bat', 'foo', 'test']);
      expect(resultValidation).toEqual([
        {
          in: ['foo', 'bar', 'baz', 'bat', 'test'],
        },
      ]);
    });

    it('should add new values sorted', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.addInValues('some-content-type', 'select', ['bat', 'foo', 'test'], { mode: 'sorted' });
      expect(resultValidation).toEqual([
        {
          in: ['bar', 'bat', 'baz', 'foo', 'test'],
        },
      ]);
    });
  });

  describe('removeInValues', () => {
    it('should remove values', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.removeInValues('some-content-type', 'select', ['foo', 'baz']);
      expect(resultValidation).toEqual([
        {
          in: ['bar'],
        },
      ]);
    });
  });

  describe('modifyInValues', () => {
    it('should modify values with custom function', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.modifyInValues('some-content-type', 'select', (values) => {
        const result = values.slice(0, values.length - 1); // remove bar
        result.push('test');
        return result;
      });
      expect(resultValidation).toEqual([
        {
          in: ['foo', 'bar', 'test'],
        },
      ]);
    });
  });

  describe('addLinkContentTypeValues', () => {
    it('should add values at the end', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.addLinkContentTypeValues('some-content-type', 'reference', 'bat');
      expect(resultValidation).toEqual([
        {
          linkContentType: ['foo', 'bar', 'baz', 'bat'],
        },
      ]);
    });
  });

  describe('removeLinkContentTypeValues', () => {
    it('should remove values', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.removeLinkContentTypeValues('some-content-type', 'reference', ['foo', 'baz']);
      expect(resultValidation).toEqual([
        {
          linkContentType: ['bar'],
        },
      ]);
    });
  });

  describe('modifyLinkContentTypeValues', () => {
    it('should modify unique values with custom function', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.modifyLinkContentTypeValues('some-content-type', 'reference', (values) => {
        const result = values.slice(0, values.length - 1); // remove bar
        result.push('test');
        result.push('foo'); // should be removed since it exists
        return result;
      });
      expect(resultValidation).toEqual([
        {
          linkContentType: ['foo', 'bar', 'test'],
        },
      ]);
    });
  });
});

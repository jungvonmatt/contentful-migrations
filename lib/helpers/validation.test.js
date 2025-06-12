const { getValidationHelpers } = require('./validation');

describe('getValidationHelpers', () => {
  const getTestContentType = () => ({
    fields: [
      {
        id: 'selectWithOtherValidationProps',
        type: 'Text',
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
        id: 'string',
        type: 'Text',
      },
      {
        id: 'string-array',
        type: 'Array',
        items: [],
      },
      {
        id: 'richTextNoValidations',
        type: 'RichText',
      },
      {
        id: 'richTextFullValidations',
        type: 'RichText',
        validations: [
          {
            enabledMarks: ['bold', 'italic'],
          },
          {
            enabledNodeTypes: [
              'blockquote',
              'embedded-entry-block',
              'hyperlink',
              'entry-hyperlink',
              'embedded-entry-inline',
            ],
          },
          {
            nodes: {
              'embedded-entry-block': [
                {
                  linkContentType: ['foo', 'baz'],
                },
              ],
              'embedded-entry-inline': [
                {
                  linkContentType: ['foo'],
                },
              ],
              'entry-hyperlink': [
                {
                  linkContentType: ['bar'],
                },
              ],
            },
          },
        ],
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

    it('should add values where none where defined', async () => {
      const validations = getValidationHelpers(migration, context);
      await validations.addInValues('some-content-type', 'string', 'foo');
      expect(resultValidation).toEqual([
        {
          in: ['foo'],
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

  describe('richText', () => {
    describe('addEnabledMarksValue', () => {
      it('should add values at the end', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.addEnabledMarksValue('some-content-type', 'richTextFullValidations', 'code');
        expect(resultValidation).toContainEqual({
          enabledMarks: ['bold', 'italic', 'code'],
        });
      });
    });

    describe('removeEnabledMarksValue', () => {
      it('should remove values', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.removeEnabledMarksValue('some-content-type', 'richTextFullValidations', 'bold');
        expect(resultValidation).toContainEqual({
          enabledMarks: ['italic'],
        });
      });
    });

    describe('modifyEnabledMarksValue', () => {
      it('should modify unique values with custom function', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.modifyEnabledMarksValue('some-content-type', 'richTextFullValidations', (values) => {
          const result = values.slice(0, values.length - 1); // remove italic
          result.push('code');
          result.push('bold'); // should be removed since it exists
          return result;
        });
        expect(resultValidation).toContainEqual({
          enabledMarks: ['bold', 'code'],
        });
      });
    });

    describe('addEnabledNodeTypeValue', () => {
      it('should add values at the end', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.addEnabledNodeTypeValue('some-content-type', 'richTextFullValidations', 'hr');
        expect(resultValidation).toContainEqual({
          enabledNodeTypes: [
            'blockquote',
            'embedded-entry-block',
            'hyperlink',
            'entry-hyperlink',
            'embedded-entry-inline',
            'hr',
          ],
        });
      });
    });

    describe('removeEnabledNodeTypeValue', () => {
      it('should remove values', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.removeEnabledNodeTypeValue(
          'some-content-type',
          'richTextFullValidations',
          'blockquote'
        );
        expect(resultValidation).toContainEqual({
          enabledNodeTypes: ['embedded-entry-block', 'hyperlink', 'entry-hyperlink', 'embedded-entry-inline'],
        });
      });
    });

    describe('modifyEnabledNodeTypeValue', () => {
      it('should modify unique values with custom function', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.modifyEnabledNodeTypeValue(
          'some-content-type',
          'richTextFullValidations',
          (values) => {
            const result = values.slice(0, values.length - 1); // remove embedded-entry-inline
            result.push('hr');
            result.push('blockquote'); // should be removed since it exists
            return result;
          }
        );
        expect(resultValidation).toContainEqual({
          enabledNodeTypes: [
            'blockquote',
            'embedded-entry-block',
            'hyperlink',
            'entry-hyperlink',
            'hr',
          ],
        });
      });
    });

    describe('addNodeContentTypeValues', () => {
      it('should add values at the end', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.addNodeContentTypeValues(
          'some-content-type',
          'richTextFullValidations',
          'embedded-entry-block',
          'bar'
        );
        console.log('### ', resultValidation.find((v) => v.nodes))
        expect(resultValidation.find((v) => v.nodes).nodes['embedded-entry-block']).toEqual([{
          linkContentType: ['foo', 'baz', 'bar'],
        }]);
      });
    });

    describe('removeNodeContentTypeValues', () => {
      it('should remove values', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.removeNodeContentTypeValues(
          'some-content-type',
          'richTextFullValidations',
          'blockquote'
        );
        expect(resultValidation).toContainEqual({
          enabledNodeTypes: ['embedded-entry-block', 'hyperlink', 'entry-hyperlink', 'embedded-entry-inline'],
        });
      });
    });

    describe('modifyNodeContentTypeValues', () => {
      it('should modify unique values with custom function', async () => {
        const validations = getValidationHelpers(migration, context);
        await validations.richText.modifyNodeContentTypeValues(
          'some-content-type',
          'richTextFullValidations',
          (values) => {
            const result = values.slice(0, values.length - 1); // remove embedded-entry-inline
            result.push('hr');
            result.push('blockquote'); // should be removed since it exists
            return result;
          }
        );
        expect(resultValidation).toContainEqual({
          enabledNodeTypes: [
            'blockquote',
            'embedded-entry-block',
            'hyperlink',
            'entry-hyperlink',
            'hr',
          ],
        });
      });
    });
  });
});

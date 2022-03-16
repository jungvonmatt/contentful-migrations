const {TYPE_LINK, TYPE_ARRAY} = require('../contentful')
/**
 * Adds utils for the migration
 *
 * Example:
 * const { withUtils } = require('@jungvonmatt/contentful-migrations');
 *
 * module.exports = withUtils(async function (migration, context, utils) {
 *
 *   ...
 *
 *   const ct = await utils.getContentType('contentTypeId');
 *   const field = await utils.getField('contentTypeId', 'fieldId');
 *
 * });
 *
 */
 const getMigrationHelper = (migration, context) => {
  const { makeRequest } = context;

  return {
    async getContentType(contentTypeId) {
      const { sys } = await makeRequest({
        method: 'GET',
        url: `/content_types/${contentTypeId}`,
      });

      if (sys.type === 'ContentType' && sys.id === contentTypeId) {
        return migration.editContentType(contentTypeId);
      }

      return migration.createContentType(contentTypeId);
    },

    async getField(contentType, fieldId) {
      const { fields } = await makeRequest({
        method: 'GET',
        url: `/content_types/${contentType.id}`,
      });

      if ((fields || []).some(field => field.id === fieldId)) {
        return contentType.editField(fieldId);
      }

      return contentType.createField(fieldId);
    }
  };
};

module.exports.getMigrationHelper = getMigrationHelper;

const { TYPE_LINK, TYPE_ARRAY } = require('../contentful');

/**
 * Adds utils for the migration
 *
 * Example:
 * const { getValidationHelpers } = require('@jungvonmatt/contentful-migrations');
 *
 * module.exports = async function (migration, context) {
 *   const validationHelper = getValidationHelpers(migration, context);
 *   ...
 *
 *   await validationHelper.addLinkContentTypeValues('contentTypeId', 'fieldId', ['value']);
 *   await validationHelper.addInValues('contentTypeId', 'fieldId', ['value']);
 *   await validationHelper.removeLinkContentTypeValues('contentTypeId', 'fieldId', ['value']);
 *   await validationHelper.removeInValues('contentTypeId', 'fieldId', ['value']);
 *
 * };
 *
 */
const getValidationHelpers = (migration, context) => {
  const { makeRequest } = context;

  const addValidationValues = (validations, key, values = []) =>
    validations.map((validation) => {
      if (validation?.[key]) {
        if (!Array.isArray(values)) {
          values = [values];
        }
        if (!Array.isArray(validation[key])) {
          throw new Error(
            `addValidationValues can only be used on arrays. validation.${key} is typeof ${typeof validation[key]}`
          );
        }
        validation[key] = [...new Set([...validation[key], ...values])];
      }

      return validation;
    });

  const removeValidationValues = (validations, key, values = []) =>
    validations.map((validation) => {
      if (validation?.[key]) {
        if (!Array.isArray(values)) {
          values = [values];
        }
        if (!Array.isArray(validation[key])) {
          throw new Error(
            `removeValidationValues can only be used on arrays. validation.${key} is typeof ${typeof validation[key]}`
          );
        }
        validation[key] = validation[key].filter((x) => !values.includes(x));
      }

      return validation;
    });

  const modifyValidationValuesForType = async (validationKey, method, contentTypeId, fieldId, typeIds) => {
    // Fetch content type
    const { fields } = await makeRequest({
      method: 'GET',
      url: `/content_types/${contentTypeId}`,
    });

    const { type, items = {}, validations = [] } = fields?.find((field) => field.id === fieldId) ?? {};

    if (type === TYPE_ARRAY) {
      const ct = migration.editContentType(contentTypeId);
      ct.editField(fieldId).items({ ...items, validations: method(items?.validations ?? [], validationKey, typeIds) });
    } else {
      const ct = migration.editContentType(contentTypeId);
      ct.editField(fieldId).validations(method(validations ?? [], validationKey, typeIds));
    }
  };

  return {
    async addLinkContentTypeValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('linkContentType', addValidationValues, contentTypeId, fieldId, values);
    },

    async addInValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('in', addValidationValues, contentTypeId, fieldId, values);
    },

    async removeLinkContentTypeValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('linkContentType', removeValidationValues, contentTypeId, fieldId, values);
    },

    async removeInValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('in', removeValidationValues, contentTypeId, fieldId, values);
    },
  };
};

module.exports.getValidationHelpers = getValidationHelpers;

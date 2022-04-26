const { TYPE_ARRAY } = require('../contentful');
const { addValues, unique } = require('./validation.utils');

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
 *   await validationHelper.addLinkContentTypeValues('contentTypeId', 'fieldId', ['some-content-type']);
 *   await validationHelper.addInValues('contentTypeId', 'fieldId', ['value']);
 *   await validationHelper.removeLinkContentTypeValues('contentTypeId', 'fieldId', ['some-content-type']);
 *   await validationHelper.removeInValues('contentTypeId', 'fieldId', ['value']);
 *
 * };
 *
 */
const getValidationHelpers = (migration, context) => {
  const { makeRequest } = context;

  const addValidationValues = (existingValues, newValues = []) => unique([...existingValues, ...newValues]);

  const removeValidationValues = (existingValues, newValues = []) =>
    existingValues.filter((x) => !newValues.includes(x));

  const modifyValidations = (validations, method, key, values) =>
    validations.map((validation) => {
      if (validation?.[key]) {
        if (!Array.isArray(values)) {
          values = [values];
        }
        if (!Array.isArray(validation[key])) {
          throw new Error(
            `modifying validation properties is only supported on arrays. validation.${key} is typeof ${typeof validation[
              key
            ]}`
          );
        }
        validation[key] = method(validation[key], values);
      }

      return validation;
    });

  const modifyValidationValuesForType = async (validationKey, method, contentTypeId, fieldId, values) => {
    // Fetch content type
    const { fields } = await makeRequest({
      method: 'GET',
      url: `/content_types/${contentTypeId}`,
    });

    const { type, items = {}, validations = [] } = fields?.find((field) => field.id === fieldId) ?? {};
    if (type === undefined) {
      throw new Error(`Content type ${contentTypeId} has no field ${fieldId}`);
    }

    if (type === TYPE_ARRAY) {
      const ct = migration.editContentType(contentTypeId);
      ct.editField(fieldId).items({
        ...items,
        validations: modifyValidations(items?.validations, method, validationKey, values),
      });
    } else {
      const ct = migration.editContentType(contentTypeId);
      ct.editField(fieldId).validations(modifyValidations(validations, method, validationKey, values));
    }
  };

  return {
    /**
     * Add the specified values to the list of allowed content type values
     */
    async addLinkContentTypeValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('linkContentType', addValidationValues, contentTypeId, fieldId, values);
    },

    /**
     * Add the specified values to the list of allowed values
     * @param {string} options.mode The mode how to add the values (sorted, start, end, before, after)
     * @param {string|undefined} options.ref The reference value for mode "before" and "after"
     */
    async addInValues(contentTypeId, fieldId, values, options = {}) {
      const addValuesWithOptions = (existingValues, newValues = []) => addValues(existingValues, newValues, options);
      await modifyValidationValuesForType('in', addValuesWithOptions, contentTypeId, fieldId, values);
    },

    /**
     * Remove the specified values from the list of allowed content type values
     */
    async removeLinkContentTypeValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('linkContentType', removeValidationValues, contentTypeId, fieldId, values);
    },

    /**
     * Remove the specified values from the list of allowed values
     */
    async removeInValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType('in', removeValidationValues, contentTypeId, fieldId, values);
    },

    /**
     * Modifies the list of allowed content types by calling the valueMappingFunction with the existing values and
     * setting the result as the new value list.
     */
    async modifyLinkContentTypeValues(contentTypeId, fieldId, valueMappingFunction) {
      const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
      await modifyValidationValuesForType('linkContentType', uniqueMappingFunction, contentTypeId, fieldId, []);
    },

    /**
     * Modifies the list of allowed values by calling the valueMappingFunction with the existing values and setting the
     * result as the new value list.
     */
    async modifyInValues(contentTypeId, fieldId, valueMappingFunction) {
      const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
      await modifyValidationValuesForType('in', uniqueMappingFunction, contentTypeId, fieldId, []);
    },
  };
};

module.exports.getValidationHelpers = getValidationHelpers;

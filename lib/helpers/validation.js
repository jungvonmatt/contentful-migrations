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

  /**
   * Ensure the complete key path is available.
   * If more than two keys are given the first node is treated as an Object.
   * Return the container node, which should be an array.
   * @param root {Object} The root container (the validations array)
   * @param keyPath {string[]} The names of the nodes that must exist
   * @return {Array} A tuple with the container object and the last key.
   */
  const ensureObjectPath = (root, keyPath) => {
    let container = undefined;
    let node = root;
    keyPath.forEach((key, index) => {
      container = node;
      const isObjectNode = keyPath.length > 2 && index === 0;
      if (Array.isArray(node)) {
        let entry = node.find((someEntry) => someEntry[key]);
        if (!entry) {
          entry = { [key]: isObjectNode ? {} : [] };
          node.push(entry);
        }
        container = entry;
        node = entry[key];
      } else {
        if (!node[key]) {
          node[key] = isObjectNode ? {} : [];
        }
        node = node[key];
      }
    });
    return [container, keyPath[keyPath.length - 1]];
  };

  /**
   * Modify a validation property.
   * @param validations The list of validation entries
   * @param {function} method The modification function
   * @param {string[]} keyPaths The key paths where the first is the id of the validation root.
   * @param {string | string[]} values
   * @returns {*}
   */
  const modifyValidations = (validations = [], method, keyPaths, values) => {
    const [containerObject, validationKey] = ensureObjectPath(validations, keyPaths);

    containerObject[validationKey] = method(containerObject[validationKey], values);

    return validations;
  };

  const modifyValidationValuesForType = async (validationKeyPaths, method, contentTypeId, fieldId, valueOrValues) => {
    const values = Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues];

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
        validations: modifyValidations(items?.validations, method, validationKeyPaths, values),
      });
    } else {
      const ct = migration.editContentType(contentTypeId);
      ct.editField(fieldId).validations(modifyValidations(validations, method, validationKeyPaths, values));
    }
  };

  return {
    /**
     * Add the specified values to the list of allowed content type values
     */
    async addLinkContentTypeValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType(['linkContentType'], addValidationValues, contentTypeId, fieldId, values);
    },

    /**
     * Add the specified values to the list of allowed values
     * @param {string} options.mode The mode how to add the values (sorted, start, end, before, after)
     * @param {string|undefined} options.ref The reference value for mode "before" and "after"
     */
    async addInValues(contentTypeId, fieldId, values, options = {}) {
      const addValuesWithOptions = (existingValues, newValues = []) => addValues(existingValues, newValues, options);
      await modifyValidationValuesForType(['in'], addValuesWithOptions, contentTypeId, fieldId, values);
    },

    /**
     * Remove the specified values from the list of allowed content type values
     */
    async removeLinkContentTypeValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType(['linkContentType'], removeValidationValues, contentTypeId, fieldId, values);
    },

    /**
     * Remove the specified values from the list of allowed values
     */
    async removeInValues(contentTypeId, fieldId, values) {
      await modifyValidationValuesForType(['in'], removeValidationValues, contentTypeId, fieldId, values);
    },

    /**
     * Modifies the list of allowed content types by calling the valueMappingFunction with the existing values and
     * setting the result as the new value list.
     */
    async modifyLinkContentTypeValues(contentTypeId, fieldId, valueMappingFunction) {
      const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
      await modifyValidationValuesForType(['linkContentType'], uniqueMappingFunction, contentTypeId, fieldId, []);
    },

    /**
     * Modifies the list of allowed values by calling the valueMappingFunction with the existing values and setting the
     * result as the new value list.
     */
    async modifyInValues(contentTypeId, fieldId, valueMappingFunction) {
      const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
      await modifyValidationValuesForType(['in'], uniqueMappingFunction, contentTypeId, fieldId, []);
    },

    richText: {
      async addEnabledMarksValues(contentTypeId, fieldId, values) {
        await modifyValidationValuesForType(['enabledMarks'], addValidationValues, contentTypeId, fieldId, values);
      },
      async removeEnabledMarksValues(contentTypeId, fieldId, values) {
        await modifyValidationValuesForType(['enabledMarks'], removeValidationValues, contentTypeId, fieldId, values);
      },
      async modifyEnabledMarksValues(contentTypeId, fieldId, valueMappingFunction) {
        const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
        await modifyValidationValuesForType(['enabledMarks'], uniqueMappingFunction, contentTypeId, fieldId, []);
      },

      async addEnabledNodeTypeValues(contentTypeId, fieldId, values) {
        await modifyValidationValuesForType(['enabledNodeTypes'], addValidationValues, contentTypeId, fieldId, values);
      },
      async removeEnabledNodeTypeValues(contentTypeId, fieldId, values) {
        await modifyValidationValuesForType(
          ['enabledNodeTypes'],
          removeValidationValues,
          contentTypeId,
          fieldId,
          values
        );
      },
      async modifyEnabledNodeTypeValues(contentTypeId, fieldId, valueMappingFunction) {
        const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
        await modifyValidationValuesForType(['enabledNodeTypes'], uniqueMappingFunction, contentTypeId, fieldId, []);
      },

      async addNodeContentTypeValues(contentTypeId, fieldId, nodeType, values) {
        await modifyValidationValuesForType(
          ['nodes', nodeType, 'linkContentType'],
          addValidationValues,
          contentTypeId,
          fieldId,
          values
        );
      },
      async removeNodeContentTypeValues(contentTypeId, fieldId, nodeType, values) {
        await modifyValidationValuesForType(
          ['nodes', nodeType, 'linkContentType'],
          removeValidationValues,
          contentTypeId,
          fieldId,
          values
        );
      },
      async modifyNodeContentTypeValues(contentTypeId, fieldId, nodeType, valueMappingFunction) {
        const uniqueMappingFunction = (values) => unique(valueMappingFunction(values));
        await modifyValidationValuesForType(
          ['nodes', nodeType, 'linkContentType'],
          uniqueMappingFunction,
          contentTypeId,
          fieldId,
          []
        );
      },
    },
  };
};

module.exports.getValidationHelpers = getValidationHelpers;

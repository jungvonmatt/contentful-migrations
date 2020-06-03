/* eslint-env node */

/**
 * Initial contentful migration
 * Adds the migration field to the config content-type
 * DO NOT DELETE !!!
 */
module.exports = async function (migration, { makeRequest }) {
  // Make a request to  check if the content-type or the field already exists
  const { items } =
    (await makeRequest({
      method: 'GET',
      url: '/content_types?sys.id[in]=config',
    })) || {};

  const [contentType] = items || [];
  const { fields } = contentType || {};
  const fieldExists = (fields || []).some((field) => field.id === 'migration');

  if (!fieldExists) {
    const ct = contentType
      ? migration.editContentType('config')
      : migration.createContentType('config', { name: 'config' });

    ct.createField('migration', {
      name: 'Migration Version',
      type: 'Symbol',
      localized: false,
      required: false,
      validations: [],
      disabled: true,
      omitted: false,
    });
  }
};

/**
 * Adds helpers for the migration
 *
 * Example:
 * const { withHelpers } = require('@jungvonmatt/contentful-migrations');
 *
 * module.exports = withHelpers(async (migration, context, helpers) => {
 *
 *   ...
 *
 * });
 *
 */
const { getValidationHelpers } = require('./lib/helpers/validation');
const { getLocaleHelpers } = require('./lib/helpers/locale');

// Export wrapper
module.exports.withHelpers = (cb) => (migration, context) => {
  const locale = getLocaleHelpers(migration, context);
  const validation = getValidationHelpers(migration, context);

  return cb(migration, context, { locale, validation });
};

module.exports.getValidationHelpers = getValidationHelpers;
module.exports.getLocaleHelpers = getLocaleHelpers;

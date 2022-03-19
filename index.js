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
 const { getValidationHelper } = require('./lib/helpers/validation');
 const { getLocaleHelper } = require('./lib/helpers/locale');

 // Export wrapper
 module.exports.withHelpers = (cb) => (migration, context) => {
   const locale = getLocaleHelper(migration, context);
   const validation = getValidationHelper(migration, context);

   return cb(migration, context, { locale, validation });
 };

 module.exports.getValidationHelper = getValidationHelper;
 module.exports.getLocaleHelper = getLocaleHelper;

/**
 * Adds utils for the migration
 *
 * Example:
 * const withUtils = require('@jungvonmatt/contentful-migrations/utils');
 *
 * module.exports = withUtils(async (migration, context, utils) => {
 *
 *   ...
 *
 * });
 *
 */
 const { getValidationHelper } = require('./lib/utils/validation');
 const { getLocaleHelper } = require('./lib/utils/locale');
 const { getMigrationHelper } = require('./lib/utils/migration');

 // Export wrapper
 module.exports.withUtils = (cb) => (migration, context) => {
   const localeHelper = getLocaleHelper(migration, context);
   const validationHelper = getValidationHelper(migration, context);
   const migrationHelper = getMigrationHelper(migration, context);
   return cb(migration, context, { ...localeHelper, ...validationHelper, ...migrationHelper });
 };

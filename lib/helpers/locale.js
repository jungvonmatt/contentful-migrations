/**
 * Adds utils for the migration
 *
 * Example:
 * const { getLocaleHelpers } = require('@jungvonmatt/contentful-migrations');
 *
 * module.exports = async function (migration, context) {
 *   const localeHelper = getLocaleHelpers(migration, context);
 *   ...
 *
 *   await localeHelper.getLocales();
 *   await localeHelper.getDefaultLocale();
 *
 * };
 *
 */
const getLocaleHelpers = (migration, context) => {
  const { makeRequest } = context;

  const getLocales = async () => {
    const { items: locales } = await makeRequest({
      method: 'GET',
      url: '/locales',
    });

    return locales;
  };

  const getDefaultLocale = async () => {
    // Fetch locale
    const locales = await getLocales();

    return locales.find((locale) => locale.default);
  };

  return {
    getLocales,
    getDefaultLocale,
  };
};

module.exports.getLocaleHelpers = getLocaleHelpers;

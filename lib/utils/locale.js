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
 *   await utils.getLocales();
 *   await utils.getDefaultLocale();
 *
 * });
 *
 */
 const getLocaleHelper = (migration, context) => {
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
    getDefaultLocale
  };
};

module.exports.getLocaleHelper = getLocaleHelper;

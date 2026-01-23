const { getLocaleHelpers } = require('./locale');

describe('getLocaleHelpers', () => {
  const mockLocales = [
    { code: 'en-US', name: 'English (US)', default: true },
    { code: 'de-DE', name: 'German', default: false },
    { code: 'fr-FR', name: 'French', default: false },
  ];

  let mockMakeRequest;
  let context;
  let migration;

  beforeEach(() => {
    mockMakeRequest = jest.fn();
    context = { makeRequest: mockMakeRequest };
    migration = {};
  });

  describe('getLocales', () => {
    it('should fetch and return all locales', async () => {
      mockMakeRequest.mockResolvedValue({ items: mockLocales });

      const helpers = getLocaleHelpers(migration, context);
      const result = await helpers.getLocales();

      expect(mockMakeRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: '/locales',
      });
      expect(result).toEqual(mockLocales);
    });

    it('should handle empty locale list', async () => {
      mockMakeRequest.mockResolvedValue({ items: [] });

      const helpers = getLocaleHelpers(migration, context);
      const result = await helpers.getLocales();

      expect(result).toEqual([]);
    });

    it('should handle request errors', async () => {
      const error = new Error('API request failed');
      mockMakeRequest.mockRejectedValue(error);

      const helpers = getLocaleHelpers(migration, context);

      await expect(helpers.getLocales()).rejects.toThrow('API request failed');
    });
  });

  describe('getDefaultLocale', () => {
    it('should return the default locale', async () => {
      mockMakeRequest.mockResolvedValue({ items: mockLocales });

      const helpers = getLocaleHelpers(migration, context);
      const result = await helpers.getDefaultLocale();

      expect(result).toEqual({ code: 'en-US', name: 'English (US)', default: true });
    });

    it('should handle no default locale', async () => {
      const localesWithoutDefault = [
        { code: 'en-US', name: 'English (US)', default: false },
        { code: 'de-DE', name: 'German', default: false },
      ];
      mockMakeRequest.mockResolvedValue({ items: localesWithoutDefault });

      const helpers = getLocaleHelpers(migration, context);
      const result = await helpers.getDefaultLocale();

      expect(result).toBeUndefined();
    });

    it('should handle request errors', async () => {
      const error = new Error('API request failed');
      mockMakeRequest.mockRejectedValue(error);

      const helpers = getLocaleHelpers(migration, context);

      await expect(helpers.getDefaultLocale()).rejects.toThrow('API request failed');
    });
  });
});

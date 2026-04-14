import { vi } from 'vitest';
import { getLocaleHelpers } from './locale';

describe('getLocaleHelpers', () => {
  it('loads locales from the migration context', async () => {
    const makeRequest = vi.fn().mockResolvedValue({
      items: [
        { code: 'en-US', default: true },
        { code: 'de-DE', default: false },
      ],
    });

    const helpers = getLocaleHelpers({}, { makeRequest });
    const locales = await helpers.getLocales();

    expect(makeRequest).toHaveBeenCalledWith({
      method: 'GET',
      url: '/locales',
    });
    expect(locales).toEqual([
      { code: 'en-US', default: true },
      { code: 'de-DE', default: false },
    ]);
  });

  it('returns the default locale from the locale list', async () => {
    const helpers = getLocaleHelpers(
      {},
      {
        makeRequest: vi.fn().mockResolvedValue({
          items: [
            { code: 'de-DE', default: false },
            { code: 'en-US', default: true },
          ],
        }),
      }
    );

    await expect(helpers.getDefaultLocale()).resolves.toEqual({ code: 'en-US', default: true });
  });
});

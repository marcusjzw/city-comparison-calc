import { describe, expect, it } from 'vitest';
import { isSupportedCurrency } from '../data/currencies';
import {
  currencyForLocales,
  currencyForTimeZone,
  detectCurrency,
} from './detectCurrency';

describe('time zone signal', () => {
  it('maps the seeded cities to their own currencies', () => {
    expect(currencyForTimeZone('Australia/Sydney')).toBe('AUD');
    expect(currencyForTimeZone('Asia/Singapore')).toBe('SGD');
    expect(currencyForTimeZone('America/Los_Angeles')).toBe('USD');
  });

  it('maps every eurozone zone it knows to EUR, not to a national currency', () => {
    for (const zone of ['Europe/Berlin', 'Europe/Paris', 'Europe/Dublin', 'Europe/Madrid']) {
      expect(currencyForTimeZone(zone)).toBe('EUR');
    }
  });

  it('covers the zones behind each supported currency', () => {
    expect(currencyForTimeZone('Europe/London')).toBe('GBP');
    expect(currencyForTimeZone('America/Toronto')).toBe('CAD');
    expect(currencyForTimeZone('Asia/Tokyo')).toBe('JPY');
    expect(currencyForTimeZone('Asia/Kolkata')).toBe('INR');
    expect(currencyForTimeZone('Pacific/Auckland')).toBe('NZD');
    expect(currencyForTimeZone('America/Sao_Paulo')).toBe('BRL');
    expect(currencyForTimeZone('America/Mexico_City')).toBe('MXN');
    expect(currencyForTimeZone('Europe/Zurich')).toBe('CHF');
  });

  it('accepts the legacy aliases browsers still report', () => {
    expect(currencyForTimeZone('Asia/Calcutta')).toBe('INR');
    expect(currencyForTimeZone('US/Pacific')).toBe('USD');
  });

  it('declines zones it does not cover rather than guessing', () => {
    expect(currencyForTimeZone('Africa/Lagos')).toBeNull();
    expect(currencyForTimeZone('Asia/Dubai')).toBeNull();
    expect(currencyForTimeZone('UTC')).toBeNull();
    expect(currencyForTimeZone('')).toBeNull();
    expect(currencyForTimeZone(null)).toBeNull();
  });

  it('only ever returns a currency the FX layer can quote', () => {
    for (const zone of ['Europe/Sofia', 'Europe/Podgorica', 'America/Nuuk', 'Asia/Macau']) {
      const currency = currencyForTimeZone(zone);
      expect(currency && isSupportedCurrency(currency)).toBe(true);
    }
  });
});

describe('locale signal', () => {
  it('reads the region subtag', () => {
    expect(currencyForLocales(['en-GB'])).toBe('GBP');
    expect(currencyForLocales(['de-DE'])).toBe('EUR');
    expect(currencyForLocales(['fr-CH'])).toBe('CHF');
  });

  it('handles a script subtag between language and region', () => {
    expect(currencyForLocales(['zh-Hant-HK'])).toBe('HKD');
    expect(currencyForLocales(['sr-Latn-ME'])).toBe('EUR');
  });

  it('skips locales with no region and takes the first that has one', () => {
    expect(currencyForLocales(['en', 'fr', 'ja-JP'])).toBe('JPY');
  });

  it('skips regions it cannot quote rather than stopping there', () => {
    // ar-AE is a real region whose currency is off the list; nb-NO follows.
    expect(currencyForLocales(['ar-AE', 'nb-NO'])).toBe('NOK');
  });

  it('returns null when nothing resolves', () => {
    expect(currencyForLocales(['en'])).toBeNull();
    expect(currencyForLocales([])).toBeNull();
    expect(currencyForLocales(null)).toBeNull();
  });
});

describe('detectCurrency', () => {
  it('prefers the time zone, because it reports place and locale reports language', () => {
    // An Australian running a US-English desktop in Sydney wants AUD.
    const result = detectCurrency({
      timeZone: 'Australia/Sydney',
      locales: ['en-US'],
    });
    expect(result).toEqual({ currency: 'AUD', via: 'timezone' });
  });

  it('falls back to the locale when the zone is unknown', () => {
    const result = detectCurrency({ timeZone: 'Africa/Lagos', locales: ['en-GB'] });
    expect(result).toEqual({ currency: 'GBP', via: 'locale' });
  });

  it('falls back to the locale when there is no zone at all', () => {
    const result = detectCurrency({ timeZone: null, locales: ['ko-KR'] });
    expect(result).toEqual({ currency: 'KRW', via: 'locale' });
  });

  it('defaults to USD when neither signal resolves', () => {
    expect(detectCurrency({ timeZone: 'UTC', locales: ['en'] })).toEqual({
      currency: 'USD',
      via: 'fallback',
    });
    expect(detectCurrency({})).toEqual({ currency: 'USD', via: 'fallback' });
  });

  it('always returns a quotable currency, whatever it is handed', () => {
    const inputs = [
      { timeZone: 'Antarctica/Troll', locales: ['xx-YY'] },
      { timeZone: 'nonsense', locales: ['', '-', 'en-'] },
      { timeZone: undefined, locales: undefined },
    ];
    for (const input of inputs) {
      expect(isSupportedCurrency(detectCurrency(input).currency)).toBe(true);
    }
  });
});

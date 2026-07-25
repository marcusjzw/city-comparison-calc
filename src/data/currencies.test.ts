import { describe, expect, it } from 'vitest';
import { rateToHome } from '../engine/fx';
import { CITIES } from './cities';
import {
  coerceCurrency,
  CURRENCY_CODES,
  CURRENCY_OPTIONS,
  FALLBACK_CURRENCY,
  isSupportedCurrency,
} from './currencies';
import { SEED_FX, seedFor } from './fx';

/**
 * Frankfurter's published set, as of the last check against
 * https://api.frankfurter.dev/v1/currencies. Offering a currency outside this
 * list would mean the dropdown accepts a choice the app cannot then quote, so
 * the catalogue is pinned against it here rather than discovered in production.
 */
const FRANKFURTER_SUPPORTED = new Set([
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
  'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
  'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

describe('the currency catalogue', () => {
  it('offers exactly twenty', () => {
    expect(CURRENCY_OPTIONS).toHaveLength(20);
  });

  it('has no duplicate codes', () => {
    expect(new Set(CURRENCY_CODES).size).toBe(CURRENCY_CODES.length);
  });

  it('offers nothing the rate provider cannot quote', () => {
    const unquotable = CURRENCY_CODES.filter((c) => !FRANKFURTER_SUPPORTED.has(c));
    expect(unquotable).toEqual([]);
  });

  it('describes every entry well enough to pick from', () => {
    for (const option of CURRENCY_OPTIONS) {
      expect(option.code).toMatch(/^[A-Z]{3}$/);
      expect(option.name.length).toBeGreaterThan(0);
      expect(option.symbol.length).toBeGreaterThan(0);
      expect(option.places.length).toBeGreaterThan(0);
    }
  });

  it('includes the fallback, and every currency the seeded cities pay in', () => {
    expect(isSupportedCurrency(FALLBACK_CURRENCY)).toBe(true);
    for (const city of CITIES) {
      expect(isSupportedCurrency(city.currency)).toBe(true);
    }
  });

  it('coerces anything unrecognised to the fallback', () => {
    expect(coerceCurrency('GBP')).toBe('GBP');
    expect(coerceCurrency('XYZ')).toBe(FALLBACK_CURRENCY);
    expect(coerceCurrency('')).toBe(FALLBACK_CURRENCY);
    expect(coerceCurrency(null)).toBe(FALLBACK_CURRENCY);
    expect(coerceCurrency(undefined)).toBe(FALLBACK_CURRENCY);
  });
});

describe('seed rates for an arbitrary base', () => {
  it('reproduces the brief exactly when the base is AUD', () => {
    expect(seedFor('AUD')).toBe(SEED_FX);
  });

  it('builds a real table for every currency on offer', () => {
    for (const code of CURRENCY_CODES) {
      const table = seedFor(code);
      expect(table.homeCurrency).toBe(code);
      expect(table.perHome[code]).toBe(1);
    }
  });

  /**
   * The guarantee the UI leans on: whatever the reader picks, every city can be
   * converted without `rateToHome` throwing mid-render. This is the offline and
   * provider-down path, so it has to hold without a network.
   */
  it('can price every city against every offered currency', () => {
    for (const code of CURRENCY_CODES) {
      const table = seedFor(code);
      for (const city of CITIES) {
        expect(() => rateToHome(table, city.currency)).not.toThrow();
        expect(rateToHome(table, city.currency)).toBeGreaterThan(0);
      }
    }
  });

  it('stays self-consistent across bases', () => {
    // One Australian dollar is worth the same in USD whichever way it is asked.
    const audPerUsd = rateToHome(seedFor('AUD'), 'USD');
    const usdPerAud = rateToHome(seedFor('USD'), 'AUD');
    expect(audPerUsd * usdPerAud).toBeCloseTo(1, 10);
  });

  it('keeps the brief’s cross rates when rebased through USD', () => {
    // A$1 = US$0.71 and A$1 = S$0.90, expressed from a USD base.
    expect(rateToHome(seedFor('USD'), 'AUD')).toBeCloseTo(0.71, 10);
    expect(rateToHome(seedFor('USD'), 'SGD')).toBeCloseTo(0.71 / 0.9, 10);
  });

  it('never labels one currency’s numbers as another’s', () => {
    // The failure this guards: falling back to the AUD seed for a GBP reader.
    expect(seedFor('GBP').homeCurrency).toBe('GBP');
    expect(seedFor('JPY').homeCurrency).toBe('JPY');
  });
});

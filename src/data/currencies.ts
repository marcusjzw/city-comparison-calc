/**
 * The currencies this calculator will report in.
 *
 * Twenty is a deliberate ceiling, not a shortage. Every entry has to clear two
 * bars: it is somewhere a reader of this app plausibly earns, saves or moves
 * to, and Frankfurter publishes a rate for it. The second bar is the hard one —
 * the ECB reference set covers thirty currencies, so AED, SAR, TWD and VND are
 * absent no matter how relevant they are. Adding one means finding a second
 * rate source, which is a bigger decision than this list.
 *
 * `places` is what the dropdown searches and shows. People pick a currency by
 * thinking of a country, so the country is the label and the code is the
 * confirmation, not the other way round.
 */

export interface CurrencyOption {
  code: string;
  /** The currency's own name, for the caption under the control. */
  name: string;
  /** Prefix used when rendering money. Dollars are disambiguated on purpose. */
  symbol: string;
  /**
   * Where it is legal tender. This is the option label, so it stays short —
   * a native `<select>` is sized by its longest option, and one verbose entry
   * would stretch the control across the header.
   */
  places: string;
  /** The longer version, shown in the caption once the currency is chosen. */
  detail?: string;
}

/**
 * Ordered by relevance to this app's question — where a salaried professional
 * comparing offers is most likely to be standing — not alphabetically. The
 * first five cover the overwhelming majority of sessions.
 */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', name: 'United States Dollar', symbol: 'US$', places: 'United States' },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    places: 'Eurozone',
    detail: 'Germany, France, Spain, the Netherlands, Ireland and 15 more',
  },
  { code: 'GBP', name: 'British Pound', symbol: '£', places: 'United Kingdom' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', places: 'Australia' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', places: 'Canada' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', places: 'Singapore' },
  {
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF ',
    places: 'Switzerland',
    detail: 'Switzerland and Liechtenstein',
  },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', places: 'Japan' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', places: 'Hong Kong' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', places: 'New Zealand' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', places: 'India' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥', places: 'China' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', places: 'South Korea' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr ', places: 'Sweden' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr ', places: 'Norway' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr ', places: 'Denmark' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł ', places: 'Poland' },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', places: 'Israel' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', places: 'Brazil' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', places: 'Mexico' },
];

/** The one currency that is always a valid answer, whatever detection returns. */
export const FALLBACK_CURRENCY = 'USD';

export const CURRENCY_CODES: string[] = CURRENCY_OPTIONS.map((c) => c.code);

const BY_CODE = new Map(CURRENCY_OPTIONS.map((c) => [c.code, c]));

export function currencyOption(code: string): CurrencyOption | undefined {
  return BY_CODE.get(code);
}

export function isSupportedCurrency(code: string): boolean {
  return BY_CODE.has(code);
}

/**
 * Narrow an arbitrary string — a shared URL, a stale localStorage entry, a
 * detection result — to something the FX layer can actually quote.
 */
export function coerceCurrency(code: string | null | undefined): string {
  return code && BY_CODE.has(code) ? code : FALLBACK_CURRENCY;
}

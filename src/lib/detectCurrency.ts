import { coerceCurrency, isSupportedCurrency } from '../data/currencies';

/**
 * Guessing which currency a reader thinks in, without asking them for anything.
 *
 * Deliberately *not* the Geolocation API. That throws a permission prompt on
 * first paint, most people decline it, it needs a reverse-geocoding round trip
 * to turn a lat/long into a country, and it is broken in exactly the case that
 * matters — someone on a plane or a holiday still wants their own currency.
 * Two signals already on the page do the job better and for free:
 *
 *  1. The IANA time zone. This tracks where the machine is configured to be,
 *     which for a settled person is where they live and earn.
 *  2. The locale's region subtag. `en-GB` says Britain; a bare `en` says
 *     nothing, which is why this is the second signal rather than the first.
 *
 * Time zone wins because it reports place, and locale reports language
 * preference: an Australian running a US-English desktop in Sydney reports
 * `en-US` with `Australia/Sydney`, and AUD is the better answer for them.
 *
 * Every path ends at a currency the FX layer can quote. When neither signal
 * resolves — an unmapped zone, a locale with no region, a hardened browser
 * that reports UTC — the answer is USD.
 */

export type DetectionSource = 'timezone' | 'locale' | 'fallback';

export interface Detection {
  currency: string;
  via: DetectionSource;
}

/**
 * IANA zone to currency, covering the countries whose currency is on the list.
 * Legacy aliases are included because browsers still report some of them.
 */
const ZONE_CURRENCY: Record<string, string> = {
  // United States
  'America/New_York': 'USD',
  'America/Detroit': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Phoenix': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Anchorage': 'USD',
  'America/Juneau': 'USD',
  'America/Boise': 'USD',
  'America/Indiana/Indianapolis': 'USD',
  'America/Kentucky/Louisville': 'USD',
  'America/North_Dakota/Center': 'USD',
  'America/Puerto_Rico': 'USD',
  'Pacific/Honolulu': 'USD',
  'Pacific/Guam': 'USD',
  'US/Eastern': 'USD',
  'US/Central': 'USD',
  'US/Mountain': 'USD',
  'US/Pacific': 'USD',

  // Eurozone
  'Europe/Amsterdam': 'EUR',
  'Europe/Andorra': 'EUR',
  'Europe/Athens': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Bratislava': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Dublin': 'EUR',
  'Europe/Helsinki': 'EUR',
  'Europe/Lisbon': 'EUR',
  'Europe/Ljubljana': 'EUR',
  'Europe/Luxembourg': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Malta': 'EUR',
  'Europe/Monaco': 'EUR',
  'Europe/Nicosia': 'EUR',
  'Europe/Paris': 'EUR',
  'Europe/Podgorica': 'EUR',
  'Europe/Riga': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/San_Marino': 'EUR',
  'Europe/Sofia': 'EUR',
  'Europe/Tallinn': 'EUR',
  'Europe/Vatican': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Vilnius': 'EUR',
  'Europe/Zagreb': 'EUR',
  'Atlantic/Azores': 'EUR',
  'Atlantic/Canary': 'EUR',
  'Atlantic/Madeira': 'EUR',

  // United Kingdom
  'Europe/London': 'GBP',
  'Europe/Belfast': 'GBP',
  'Europe/Guernsey': 'GBP',
  'Europe/Isle_of_Man': 'GBP',
  'Europe/Jersey': 'GBP',
  'GB': 'GBP',

  // Australia
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Australia/Adelaide': 'AUD',
  'Australia/Hobart': 'AUD',
  'Australia/Darwin': 'AUD',
  'Australia/Canberra': 'AUD',
  'Australia/Broken_Hill': 'AUD',
  'Australia/Lindeman': 'AUD',
  'Australia/Lord_Howe': 'AUD',
  'Antarctica/Macquarie': 'AUD',
  'Indian/Christmas': 'AUD',
  'Indian/Cocos': 'AUD',

  // Canada
  'America/Toronto': 'CAD',
  'America/Montreal': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Edmonton': 'CAD',
  'America/Winnipeg': 'CAD',
  'America/Halifax': 'CAD',
  'America/Moncton': 'CAD',
  'America/Regina': 'CAD',
  'America/St_Johns': 'CAD',
  'America/Whitehorse': 'CAD',
  'America/Yellowknife': 'CAD',
  'America/Iqaluit': 'CAD',
  'America/Dawson_Creek': 'CAD',

  // Singapore, Hong Kong, Japan, Korea, China, India, Israel
  'Asia/Singapore': 'SGD',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Tokyo': 'JPY',
  'Asia/Seoul': 'KRW',
  'Asia/Shanghai': 'CNY',
  'Asia/Chongqing': 'CNY',
  'Asia/Harbin': 'CNY',
  'Asia/Urumqi': 'CNY',
  'Asia/Kashgar': 'CNY',
  'Asia/Macau': 'HKD',
  'Asia/Kolkata': 'INR',
  'Asia/Calcutta': 'INR',
  'Asia/Jerusalem': 'ILS',
  'Asia/Tel_Aviv': 'ILS',
  'Asia/Gaza': 'ILS',
  'Asia/Hebron': 'ILS',

  // Switzerland
  'Europe/Zurich': 'CHF',
  'Europe/Vaduz': 'CHF',
  'Europe/Busingen': 'CHF',

  // Nordics
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Arctic/Longyearbyen': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Atlantic/Faroe': 'DKK',
  'America/Godthab': 'DKK',
  'America/Nuuk': 'DKK',

  // Poland
  'Europe/Warsaw': 'PLN',

  // New Zealand
  'Pacific/Auckland': 'NZD',
  'Pacific/Chatham': 'NZD',

  // Brazil
  'America/Sao_Paulo': 'BRL',
  'America/Bahia': 'BRL',
  'America/Fortaleza': 'BRL',
  'America/Recife': 'BRL',
  'America/Maceio': 'BRL',
  'America/Belem': 'BRL',
  'America/Santarem': 'BRL',
  'America/Manaus': 'BRL',
  'America/Boa_Vista': 'BRL',
  'America/Porto_Velho': 'BRL',
  'America/Rio_Branco': 'BRL',
  'America/Cuiaba': 'BRL',
  'America/Campo_Grande': 'BRL',
  'America/Araguaina': 'BRL',
  'America/Noronha': 'BRL',

  // Mexico
  'America/Mexico_City': 'MXN',
  'America/Monterrey': 'MXN',
  'America/Merida': 'MXN',
  'America/Cancun': 'MXN',
  'America/Chihuahua': 'MXN',
  'America/Hermosillo': 'MXN',
  'America/Mazatlan': 'MXN',
  'America/Matamoros': 'MXN',
  'America/Ojinaga': 'MXN',
  'America/Tijuana': 'MXN',
  'America/Bahia_Banderas': 'MXN',
};

/**
 * ISO 3166-1 alpha-2 to currency, for the locale signal. Territories that use
 * a listed currency without issuing it, or peg tightly to one, are included:
 * someone in Jersey, Puerto Rico or Macau gets a usable answer for free.
 */
const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', PR: 'USD', GU: 'USD', VI: 'USD', AS: 'USD', MP: 'USD',
  EC: 'USD', SV: 'USD', PA: 'USD', TL: 'USD',

  AT: 'EUR', BE: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR',
  FR: 'EUR', DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR',
  LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR',
  SI: 'EUR', ES: 'EUR', BG: 'EUR', AD: 'EUR', MC: 'EUR', SM: 'EUR',
  VA: 'EUR', ME: 'EUR', XK: 'EUR',

  GB: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP',

  AU: 'AUD', NR: 'AUD', KI: 'AUD', TV: 'AUD', CX: 'AUD', CC: 'AUD', NF: 'AUD',

  CA: 'CAD',
  SG: 'SGD',
  CH: 'CHF', LI: 'CHF',
  JP: 'JPY',
  HK: 'HKD', MO: 'HKD',
  NZ: 'NZD', CK: 'NZD', NU: 'NZD', PN: 'NZD', TK: 'NZD',
  IN: 'INR',
  CN: 'CNY',
  KR: 'KRW',
  SE: 'SEK',
  NO: 'NOK', SJ: 'NOK',
  DK: 'DKK', FO: 'DKK', GL: 'DKK',
  PL: 'PLN',
  IL: 'ILS', PS: 'ILS',
  BR: 'BRL',
  MX: 'MXN',
};

/** The currency for an IANA zone, or null if it is not one we cover. */
export function currencyForTimeZone(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  const mapped = ZONE_CURRENCY[timeZone];
  return mapped && isSupportedCurrency(mapped) ? mapped : null;
}

/** The region subtag of a BCP 47 tag, uppercased. `en-GB` and `en-Latn-GB` both give GB. */
function regionOf(locale: string): string | null {
  const parts = locale.split(/[-_]/);
  for (const part of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
    if (/^\d{3}$/.test(part)) return part; // UN M49, e.g. es-419. Not mapped, but not a script.
  }
  return null;
}

/** The currency for the first locale carrying a region we recognise. */
export function currencyForLocales(locales: readonly string[] | null | undefined): string | null {
  if (!locales) return null;
  for (const locale of locales) {
    const region = regionOf(locale);
    const mapped = region ? REGION_CURRENCY[region] : undefined;
    if (mapped && isSupportedCurrency(mapped)) return mapped;
  }
  return null;
}

export interface DetectionInput {
  timeZone?: string | null;
  locales?: readonly string[] | null;
}

/** Time zone, then locale region, then USD. Pure, so the tests can drive it. */
export function detectCurrency({ timeZone, locales }: DetectionInput): Detection {
  const byZone = currencyForTimeZone(timeZone);
  if (byZone) return { currency: byZone, via: 'timezone' };

  const byLocale = currencyForLocales(locales);
  if (byLocale) return { currency: byLocale, via: 'locale' };

  return { currency: coerceCurrency(null), via: 'fallback' };
}

/**
 * The same thing, reading the browser. Every lookup here is wrapped, because a
 * currency default is never worth a blank page: locked-down and headless
 * browsers do throw from `Intl` and `navigator`.
 */
export function detectCurrencyFromEnvironment(): Detection {
  let timeZone: string | null = null;
  let locales: readonly string[] | null = null;

  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    // Leave it null and let the locale signal try.
  }

  try {
    locales = navigator.languages?.length
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : null;
  } catch {
    // Same again. `detectCurrency` returns USD when both signals are empty.
  }

  return detectCurrency({ timeZone, locales });
}

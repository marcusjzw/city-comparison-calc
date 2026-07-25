import { currencyOption } from '../data/currencies';

/**
 * Currency prefixes are hand-set. `Intl` renders AUD, SGD, USD, CAD, NZD and
 * HKD all as a bare "$", which is precisely the ambiguity a cross-border
 * calculator exists to remove — every dollar here says whose dollar it is.
 *
 * Anything off the supported list falls back to its ISO code, which is
 * unambiguous even when it is not pretty.
 */
export function symbolFor(currency: string): string {
  return currencyOption(currency)?.symbol ?? `${currency} `;
}

const grouped = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

export function money(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  return `${sign}${symbolFor(currency)}${grouped.format(Math.abs(Math.round(value)))}`;
}

/** For the hero numbers, where four significant figures is plenty. */
export function moneyCompact(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${symbolFor(currency)}${(abs / 1e6).toFixed(2)}m`;
  if (abs >= 10_000) return `${sign}${symbolFor(currency)}${Math.round(abs / 1000)}k`;
  return money(value, currency);
}

export function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Infinity is rendered honestly. Clamping it to a big number and pretending is
 * how a calculator becomes actively harmful.
 */
export function years(value: number): string {
  if (!Number.isFinite(value)) return 'never at this rate';
  if (value === 0) return 'already there';
  return `${value.toFixed(1)} years`;
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function inkFor(currency: string): string {
  return `var(--ink-${currency}, var(--ink-default))`;
}

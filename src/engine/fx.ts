/**
 * FX is the one figure this app fetches at runtime rather than shipping, since
 * it genuinely changes daily. Everything downstream takes a plain number, so
 * the engine never knows where the rate came from and tests can parameterise it.
 */

export interface FxTable {
  homeCurrency: string;
  /** Units of each currency per one unit of the home currency. */
  perHome: Record<string, number>;
  /** ISO timestamp of the quote. */
  asOf: string;
  source: string;
}

/** Units of home currency per one unit of `currency`. */
export function rateToHome(fx: FxTable, currency: string): number {
  if (currency === fx.homeCurrency) return 1;
  const per = fx.perHome[currency];
  if (!per) throw new Error(`No FX quote for ${currency} against ${fx.homeCurrency}`);
  return 1 / per;
}

export function toHome(fx: FxTable, amount: number, currency: string): number {
  return amount * rateToHome(fx, currency);
}

/** Apply a "what if the rate moves" shift, as a signed fraction. */
export function shiftFx(fx: FxTable, currency: string, shift: number): FxTable {
  if (currency === fx.homeCurrency || shift === 0) return fx;
  return {
    ...fx,
    perHome: { ...fx.perHome, [currency]: fx.perHome[currency] * (1 + shift) },
  };
}

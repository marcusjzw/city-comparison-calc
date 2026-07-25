import type { ForwardResult } from '../engine/types';
import { money, percent, symbolFor } from '../lib/format';
import { Disclosure } from './Disclosure';

const plain = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

/**
 * The tax drill-down: the full bracket walk, band by band, with the taxpayer's
 * income marked on the ladder. Every figure on the card should be traceable to
 * arithmetic the user can check, or they will not believe any of it.
 *
 * The currency symbol is stated once in the column head rather than on every
 * cell — at three cards across, the repetition is what breaks the layout.
 */
export function BracketLadder({
  result,
  ink,
}: {
  result: ForwardResult;
  ink: string;
}) {
  const currency = result.currency;
  const unit = symbolFor(currency).trim();
  const notes = result.rules.filter(
    (rule): rule is typeof rule & { note: string } => Boolean(rule.note),
  );

  return (
    <div className="space-y-5">
      {result.rules.map((rule) => (
        <div key={rule.id}>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="font-sans text-[12.5px] font-medium text-ink">
              {rule.label}
            </h4>
            <span className="tnum font-mono text-[12.5px]" style={{ color: ink }}>
              {money(rule.amount, currency)}
            </span>
          </div>

          {rule.deduction > 0 && (
            <p className="mt-1 font-mono text-[10.5px] text-muted">
              {rule.bands ? 'less' : 'above'} {plain.format(rule.deduction)} → on{' '}
              {plain.format(rule.appliedTo)}
            </p>
          )}

          {rule.bands ? (
            <table className="mt-2 w-full table-fixed border-collapse font-mono text-[10.5px]">
              <thead>
                <tr className="text-muted">
                  <th className="w-1/2 py-1 text-left font-normal">Band, {unit}</th>
                  <th className="py-1 text-right font-normal">Rate</th>
                  <th className="py-1 text-right font-normal">Tax</th>
                </tr>
              </thead>
              <tbody>
                {rule.bands.map((band, index) => {
                  const reached = band.taxed > 0;
                  const isTop =
                    reached &&
                    (index === rule.bands!.length - 1 ||
                      rule.bands![index + 1].taxed === 0);
                  return (
                    <tr
                      key={index}
                      className={reached ? 'text-ink' : 'text-muted/45'}
                      style={isTop ? { color: ink } : undefined}
                    >
                      <td className="tnum py-[3px] whitespace-nowrap">
                        {plain.format(band.from)}–
                        {band.to === null ? '∞' : plain.format(band.to)}
                        {isTop && <span className="ml-1 opacity-70">←</span>}
                      </td>
                      <td className="tnum py-[3px] text-right">
                        {percent(band.rate, (band.rate * 100) % 1 === 0 ? 0 : 1)}
                      </td>
                      <td className="tnum py-[3px] text-right">
                        {reached ? plain.format(Math.round(band.tax)) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="mt-1 font-mono text-[10.5px] text-muted">
              {plain.format(rule.appliedTo)} at flat rate
            </p>
          )}

        </div>
      ))}

      <div className="flex items-baseline justify-between gap-2 border-t border-line pt-3">
        <span className="font-sans text-[12px] text-muted">Total tax</span>
        <span className="tnum font-mono text-[12.5px] text-ink">
          {money(result.totalTax, currency)} · {percent(result.effectiveTaxRate)}
        </span>
      </div>

      {/* Caveats are available, not in the way. Anyone reading a bracket walk
          will open them; nobody needs them between the bands. */}
      {notes.length > 0 && (
        <Disclosure summary="Notes">
          <ul className="space-y-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className="font-sans text-[10.5px] leading-relaxed text-muted"
              >
                <span className="text-ink">{note.label}.</span> {note.note}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

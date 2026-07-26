import { useId } from 'react';
import { CURRENCY_OPTIONS } from '../data/currencies';
import { inkFor, symbolFor } from '../lib/format';

interface Props {
  value: string;
  /** True once a live quote has replaced the seed table. */
  live: boolean;
  onChange: (currency: string) => void;
}

/**
 * The currency every comparison is reported in.
 *
 * A native `<select>` on purpose. Twenty options is well inside what the
 * platform control handles gracefully, and it brings type-ahead, keyboard
 * navigation, and the correct mobile picker with it — none of which a hand-
 * rolled listbox would get right for free.
 *
 * The option list already spells out the code and where it spends, so the line
 * that used to sit underneath restating the currency's full name is gone. The
 * one caveat that survives is the seed-rate warning: quoting a stale table as
 * though it were a live rate is the kind of quiet wrongness this app exists to
 * avoid, so it stays and it is the only thing down there.
 */
export function CurrencySelector({ value, live, onChange }: Props) {
  const id = useId();

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-baseline gap-2">
        <label htmlFor={id} className="eyebrow">
          Show me in
        </label>

        <div className="flex items-baseline gap-1.5">
          <span
            aria-hidden="true"
            className="font-mono text-[13px]"
            style={{ color: inkFor(value) }}
          >
            {symbolFor(value).trim()}
          </span>
          <select
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="border-b border-line bg-transparent pb-[2px] font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code} className="bg-plate">
                {option.code} · {option.places}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!live && (
        <p className="font-mono text-[10px] text-faint sm:text-right">
          seed rates, not a live quote
        </p>
      )}
    </div>
  );
}

import { useId } from 'react';
import { CURRENCY_OPTIONS, currencyOption } from '../data/currencies';
import type { Detection } from '../lib/detectCurrency';
import { inkFor, symbolFor } from '../lib/format';

interface Props {
  value: string;
  detection: Detection;
  /** True once a live quote has replaced the seed table. */
  live: boolean;
  onChange: (currency: string) => void;
}

const VIA_LABEL: Record<Detection['via'], string> = {
  timezone: 'matched to your time zone',
  locale: 'matched to your language region',
  fallback: 'default — we could not tell where you are',
};

/**
 * The currency every comparison is reported in.
 *
 * A native `<select>` on purpose. Twenty options is well inside what the
 * platform control handles gracefully, and it brings type-ahead, keyboard
 * navigation, and the correct mobile picker with it — none of which a hand-
 * rolled listbox would get right for free.
 *
 * The line underneath is the part that matters. Software that quietly guesses
 * where you are and reformats your money is unnerving; software that says it
 * guessed, and how, is just helpful. The note disappears the moment the reader
 * picks for themselves, because from then on it is their choice, not our guess.
 */
export function CurrencySelector({ value, detection, live, onChange }: Props) {
  const id = useId();
  const selected = currencyOption(value);
  const showDetectionNote = value === detection.currency && detection.via !== 'fallback';

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

      <p className="max-w-[42ch] font-sans text-[10.5px] leading-relaxed text-faint sm:text-right">
        {selected?.name ?? value}
        {selected?.detail && ` · ${selected.detail}`}
        {showDetectionNote && ` · ${VIA_LABEL[detection.via]}`}
        {!live && ' · rates are seed values, not a live quote'}
      </p>
    </div>
  );
}

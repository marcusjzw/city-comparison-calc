import { useId } from 'react';

interface FieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
}

/** A labelled numeric input. Mono, tabular, right-aligned so digits line up. */
export function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1000,
  hint,
}: FieldProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-sans text-[12px] text-muted">
          {label}
        </label>
        <div className="flex items-baseline gap-1">
          {prefix && <span className="font-mono text-[12px] text-muted">{prefix}</span>}
          <input
            id={id}
            type="number"
            inputMode="numeric"
            value={Number.isFinite(value) ? Math.round(value) : 0}
            step={step}
            onChange={(event) => onChange(Number(event.target.value))}
            className="tnum w-28 border-b border-line bg-transparent pb-[2px] text-right font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          />
          {suffix && <span className="font-mono text-[12px] text-muted">{suffix}</span>}
        </div>
      </div>
      {hint && <p className="mt-1 font-sans text-[10.5px] leading-relaxed text-faint">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-sans text-[12px] text-muted">
          {label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`h-[18px] w-[34px] shrink-0 border transition-colors ${
            checked ? 'border-ink bg-ink/80' : 'border-line bg-transparent'
          }`}
        >
          <span
            className={`block h-[12px] w-[12px] translate-y-[2px] transition-transform ${
              checked ? 'translate-x-[18px] bg-ground' : 'translate-x-[3px] bg-muted'
            }`}
          />
        </button>
      </div>
      {hint && <p className="mt-1 font-sans text-[10.5px] leading-relaxed text-faint">{hint}</p>}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

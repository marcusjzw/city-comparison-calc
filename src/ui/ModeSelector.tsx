import { motion } from 'motion/react';
import type { Mode } from '../engine/scenario';

const MODES: { id: Mode; label: string; blurb: string }[] = [
  {
    id: 'lifestyle',
    label: 'Lifestyle parity',
    blurb: 'Same standard of living.',
  },
  {
    id: 'savings',
    label: 'Savings parity',
    blurb: 'Same annual savings, in home currency.',
  },
  {
    id: 'goal',
    label: 'Goal',
    blurb: 'Your number, by your date.',
  },
];

export function ModeSelector({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div>
      <div role="tablist" aria-label="Comparison mode" className="flex flex-wrap gap-1">
        {MODES.map((entry) => {
          const selected = entry.id === mode;
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onChange(entry.id)}
              className={`relative px-4 py-2 font-mono text-[12px] tracking-wide transition-colors ${
                selected ? 'text-ground' : 'text-muted hover:text-ink'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="mode-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  className="absolute inset-0 bg-ink"
                />
              )}
              <span className="relative">{entry.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 font-sans text-[13px] text-muted">{active.blurb}</p>
    </div>
  );
}

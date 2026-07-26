import { motion } from 'motion/react';
import type { Mode } from '../engine/scenario';

/* Labels say what you get, not what the model is called: "lifestyle parity" is
   the engine's word for it, "live the same" is the reader's. */
const MODES: { id: Mode; label: string; blurb: string }[] = [
  {
    id: 'lifestyle',
    label: 'Live the same',
    blurb: 'Keep the standard of living you have now.',
  },
  {
    id: 'savings',
    label: 'Save the same',
    blurb: 'Put away the same amount each year, back home.',
  },
  {
    id: 'goal',
    label: 'Hit a number',
    blurb: 'Reach a savings target by a date you pick.',
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
      <div
        role="tablist"
        aria-label="Comparison mode"
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-plate/50 p-1"
      >
        {MODES.map((entry) => {
          const selected = entry.id === mode;
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onChange(entry.id)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 font-mono text-[11.5px] whitespace-nowrap tracking-wide transition-colors ${
                selected ? 'text-ground' : 'text-muted hover:text-ink'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="mode-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-ink"
                />
              )}
              <span className="relative">{entry.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 max-w-prose font-sans text-[13.5px] leading-relaxed text-muted">
        {active.blurb}
      </p>
    </div>
  );
}

import { useLayoutEffect, useRef } from 'react';
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
    label: 'Reach a savings goal',
    blurb: 'Land on a savings target by a date you pick.',
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
  const buttonRefs = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});
  const pillRef = useRef<HTMLSpanElement>(null);

  // The pill used to be a Framer Motion `layoutId` element, re-measured and
  // re-positioned by JS on every animation frame. That JS has to share the
  // main thread with everything else a mode switch kicks off (the whole
  // comparison recomputing, every city card re-rendering), so under any load
  // the slide would stutter or skip. A plain CSS transition on `transform` is
  // handed to the compositor once and then runs on its own — the pill still
  // glides even while the rest of the page is busy.
  useLayoutEffect(() => {
    const button = buttonRefs.current[mode];
    const pill = pillRef.current;
    if (!button || !pill) return;
    pill.style.width = `${button.offsetWidth}px`;
    pill.style.height = `${button.offsetHeight}px`;
    pill.style.transform = `translate(${button.offsetLeft}px, ${button.offsetTop}px)`;
  }, [mode]);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Comparison mode"
        className="relative inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-plate/50 p-1"
      >
        <span
          ref={pillRef}
          aria-hidden
          className="absolute top-0 left-0 rounded-full bg-ink transition-[transform,width,height] duration-300 ease-out"
        />
        {MODES.map((entry) => {
          const selected = entry.id === mode;
          return (
            <button
              key={entry.id}
              ref={(el) => {
                buttonRefs.current[entry.id] = el;
              }}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => onChange(entry.id)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 font-mono text-[11.5px] whitespace-nowrap tracking-wide transition-colors ${
                selected ? 'text-ground' : 'text-muted hover:text-ink'
              }`}
            >
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

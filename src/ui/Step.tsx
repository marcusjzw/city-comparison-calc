/**
 * A numbered step.
 *
 * The page used to explain its own reading order in a paragraph ("set your
 * situation on the left, pick what you're optimising for, read it off the
 * cards"). Numbering the three surfaces says the same thing structurally, and
 * a number in a circle survives skimming in a way a sentence does not.
 */
export function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full border border-line font-mono text-[11px] text-muted"
        >
          {n}
        </span>
        <h2 className="font-display text-[18px] leading-none text-ink">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
      </div>
      {hint && (
        <p className="mt-1.5 ml-[31px] font-sans text-[12px] leading-relaxed text-muted">
          {hint}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

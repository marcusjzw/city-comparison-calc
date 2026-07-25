import type { ReactNode } from 'react';

/**
 * Everything the model assumes is available, and none of it is in the way.
 *
 * Plain <details>: keyboard reachable and open-by-default for print and for
 * anyone who has turned off JavaScript's cleverness. No animation, because a
 * disclosure opening is not a quantity changing.
 */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group ${className ?? ''}`}>
      <summary className="cursor-pointer list-none font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase marker:content-none hover:text-ink">
        <span className="inline-block w-3 transition-transform group-open:rotate-90">
          ›
        </span>
        {summary}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

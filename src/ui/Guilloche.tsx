import { useMemo } from 'react';

/**
 * The engraved rosette that sits behind everything, at the opacity of a
 * watermark. Guilloché line-work is what actual banknotes use to be hard to
 * copy; here it is doing the quieter job of making the surface feel like
 * security paper rather than a grey SaaS page.
 *
 * Pure geometry, drawn once, never animated.
 */
function rosette(
  cx: number,
  cy: number,
  R: number,
  r: number,
  d: number,
  turns: number,
  steps: number,
): string {
  const points: string[] = [];
  const ratio = (R - r) / r;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(ratio * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(ratio * t);
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(' ');
}

export function Guilloche({ className }: { className?: string }) {
  const paths = useMemo(
    () => [
      { d: rosette(150, 210, 220, 47, 150, 47, 3200), stroke: 'var(--ink-AUD)' },
      { d: rosette(880, 120, 170, 31, 120, 31, 2400), stroke: 'var(--ink-SGD)' },
      { d: rosette(920, 700, 260, 59, 190, 59, 3600), stroke: 'var(--ink-USD)' },
    ],
    [],
  );

  return (
    <svg
      className={className}
      viewBox="0 0 1000 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill="none"
          stroke={path.stroke}
          strokeWidth={0.4}
          opacity={0.5}
        />
      ))}
    </svg>
  );
}

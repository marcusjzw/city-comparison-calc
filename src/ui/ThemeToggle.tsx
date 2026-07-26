import type { Theme } from '../state/useTheme';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Sun and moon share one dial rather than swapping icons: the rays fold back
 * into the disc and a second disc slides in to carve a crescent out of it, so
 * the toggle reads as one object turning over instead of two glyphs
 * dissolving into each other.
 */
export function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-ink"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <g
          style={{
            transformOrigin: '8px 8px',
            transform: isDark ? 'rotate(35deg) scale(0.8)' : 'rotate(0deg) scale(1)',
            transition: 'transform 700ms cubic-bezier(0.65, 0, 0.35, 1)',
          }}
        >
          {RAY_ANGLES.map((angle) => (
            <line
              key={angle}
              x1={8}
              y1={2}
              x2={8}
              y2={3.4}
              stroke="currentColor"
              strokeWidth={1.3}
              strokeLinecap="round"
              transform={`rotate(${angle} 8 8)`}
              style={{
                opacity: isDark ? 0 : 1,
                transition: 'opacity 500ms ease',
              }}
            />
          ))}
          <circle cx={8} cy={8} r={3.1} fill="currentColor" />
        </g>
        {/* Slides over the disc to carve the crescent; only present in dark mode. */}
        <circle
          cx={isDark ? 6.1 : 15}
          cy={isDark ? 5.1 : 2}
          r={3.6}
          fill="var(--color-ground)"
          style={{ transition: 'cx 700ms cubic-bezier(0.65, 0, 0.35, 1), cy 700ms cubic-bezier(0.65, 0, 0.35, 1)' }}
        />
      </svg>
    </button>
  );
}

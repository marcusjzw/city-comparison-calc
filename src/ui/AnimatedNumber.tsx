import { useEffect, useRef } from 'react';
import { useMotionValueEvent, useReducedMotion, useSpring } from 'motion/react';

interface Props {
  value: number;
  format: (value: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A number that springs to its new value instead of cutting to it.
 *
 * Written straight to the DOM node rather than through React state: at 60fps a
 * re-render per frame is waste, and tabular figures mean the text can change
 * width-for-width without moving anything around it.
 *
 * Non-finite values (an unreachable goal) bypass the spring entirely — there
 * is nothing to animate toward and "never at this rate" is not a quantity.
 */
export function AnimatedNumber({ value, format, className, style }: Props) {
  const reduceMotion = useReducedMotion();
  const finite = Number.isFinite(value);
  const spring = useSpring(finite ? value : 0, {
    stiffness: 140,
    damping: 22,
    mass: 0.7,
    restDelta: 0.5,
  });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!finite) return;
    if (reduceMotion) spring.jump(value);
    else spring.set(value);
  }, [value, finite, reduceMotion, spring]);

  useMotionValueEvent(spring, 'change', (latest) => {
    if (ref.current && finite) ref.current.textContent = format(latest);
  });

  return (
    <span ref={ref} className={`tnum ${className ?? ''}`} style={style}>
      {format(value)}
    </span>
  );
}

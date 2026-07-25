import { useRef, useState } from 'react';
import { useAnimationFrame, useReducedMotion } from 'motion/react';

/**
 * Spring-integrates a fixed-length vector of numbers.
 *
 * The ribbon morphs between configurations rather than cutting between them,
 * which means every stream width has to be a continuously animated quantity,
 * not a CSS transition on a path. Integrating the whole vector in one frame
 * callback keeps that to a single re-render per frame no matter how many
 * streams there are, and the geometry is recomputed from the settled values.
 *
 * Critically damped by default: overshoot on a money figure reads as a wrong
 * number for a few frames, which is worse than looking slightly stiff.
 */
export function useSpringVector(
  target: number[],
  { stiffness = 150, damping = 0.95, from = 0 } = {},
): number[] {
  const reduceMotion = useReducedMotion();
  const [values, setValues] = useState<number[]>(() =>
    reduceMotion ? target : target.map(() => from),
  );

  const state = useRef({
    position: reduceMotion ? [...target] : target.map(() => from),
    velocity: target.map(() => 0),
  });
  const latestTarget = useRef(target);
  latestTarget.current = target;

  useAnimationFrame((_time, deltaMs) => {
    const goal = latestTarget.current;
    const { position, velocity } = state.current;

    // Length can change if a city adds a stream. Grow in place from the goal.
    while (position.length < goal.length) {
      position.push(goal[position.length]);
      velocity.push(0);
    }

    if (reduceMotion) {
      if (goal.some((v, i) => v !== position[i])) {
        state.current.position = [...goal];
        setValues([...goal]);
      }
      return;
    }

    const dt = Math.min(deltaMs, 32) / 1000;
    const c = 2 * Math.sqrt(stiffness) * damping;
    let moving = false;

    for (let i = 0; i < goal.length; i++) {
      const displacement = position[i] - goal[i];
      velocity[i] += (-stiffness * displacement - c * velocity[i]) * dt;
      position[i] += velocity[i] * dt;
      if (Math.abs(position[i] - goal[i]) > 1e-4 || Math.abs(velocity[i]) > 1e-4) {
        moving = true;
      } else {
        position[i] = goal[i];
        velocity[i] = 0;
      }
    }

    if (moving) setValues([...position]);
  });

  return values;
}

import { useMemo } from 'react';

/** Decorative twinkling stars used behind the globe, astro map and landing. */
export function Starfield({ count = 110 }: { count?: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2.2 + 0.8,
        delay: Math.random() * 4,
        duration: 1.8 + Math.random() * 3,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: 0.4,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

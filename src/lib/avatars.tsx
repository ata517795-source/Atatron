/**
 * Original avatar art — hand-drawn SVG characters created for Wanderworld.
 * No copyrighted characters; everything below is drawn from scratch.
 */
import type { JSX } from 'react';

export interface AvatarDef {
  id: string;
  name: string;
  kind: 'animal' | 'hero';
  bg: string;
}

const Eyes = ({ y = 30, dx = 9, r = 3.2, color = '#1f2430' }: { y?: number; dx?: number; r?: number; color?: string }) => (
  <>
    <circle cx={32 - dx} cy={y} r={r} fill={color} />
    <circle cx={32 + dx} cy={y} r={r} fill={color} />
    <circle cx={32 - dx + 1.2} cy={y - 1.2} r={1} fill="#fff" />
    <circle cx={32 + dx + 1.2} cy={y - 1.2} r={1} fill="#fff" />
  </>
);

const Smile = ({ y = 40, w = 7, color = '#1f2430' }: { y?: number; w?: number; color?: string }) => (
  <path d={`M ${32 - w} ${y} Q 32 ${y + 5} ${32 + w} ${y}`} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
);

const faces: Record<string, JSX.Element> = {
  fox: (
    <>
      <path d="M14 22 L10 8 L24 15 Z" fill="#e86b3f" />
      <path d="M50 22 L54 8 L40 15 Z" fill="#e86b3f" />
      <path d="M14 22 L12 12 L22 17 Z" fill="#fbe5d6" />
      <path d="M50 22 L52 12 L42 17 Z" fill="#fbe5d6" />
      <circle cx="32" cy="34" r="20" fill="#f07b47" />
      <path d="M32 54 A20 20 0 0 0 52 36 Q 42 52 32 54" fill="#e86b3f" opacity="0.5" />
      <ellipse cx="32" cy="43" rx="11" ry="9" fill="#fbe5d6" />
      <Eyes y={31} />
      <ellipse cx="32" cy="41" rx="3" ry="2.4" fill="#3b2b23" />
      <Smile y={46} w={5} />
    </>
  ),
  panda: (
    <>
      <circle cx="15" cy="16" r="8" fill="#2b2b33" />
      <circle cx="49" cy="16" r="8" fill="#2b2b33" />
      <circle cx="32" cy="34" r="20" fill="#f7f4ef" />
      <ellipse cx="23" cy="31" rx="6" ry="7.5" fill="#2b2b33" transform="rotate(-15 23 31)" />
      <ellipse cx="41" cy="31" rx="6" ry="7.5" fill="#2b2b33" transform="rotate(15 41 31)" />
      <Eyes y={31} r={2.4} color="#fff" />
      <circle cx="23" cy="31" r="1.2" fill="#1f2430" />
      <circle cx="41" cy="31" r="1.2" fill="#1f2430" />
      <ellipse cx="32" cy="41" rx="3" ry="2.2" fill="#2b2b33" />
      <Smile y={45} w={5} />
    </>
  ),
  owl: (
    <>
      <path d="M15 15 L20 6 L25 15 Z" fill="#8a5a33" />
      <path d="M49 15 L44 6 L39 15 Z" fill="#8a5a33" />
      <circle cx="32" cy="34" r="20" fill="#a06c3e" />
      <circle cx="23" cy="31" r="9" fill="#f3e3c3" />
      <circle cx="41" cy="31" r="9" fill="#f3e3c3" />
      <circle cx="23" cy="31" r="4" fill="#2b2415" />
      <circle cx="41" cy="31" r="4" fill="#2b2415" />
      <circle cx="24.4" cy="29.6" r="1.3" fill="#fff" />
      <circle cx="42.4" cy="29.6" r="1.3" fill="#fff" />
      <path d="M32 36 L28 42 L36 42 Z" fill="#f0a03c" />
      <path d="M20 48 Q 32 54 44 48" stroke="#7c5028" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  penguin: (
    <>
      <circle cx="32" cy="33" r="20" fill="#28303f" />
      <ellipse cx="32" cy="38" rx="13" ry="12" fill="#f2f5f7" />
      <Eyes y={30} dx={8} />
      <path d="M32 33 L26 39 L38 39 Z" fill="#f5a13c" />
      <path d="M27 42 Q 32 45 37 42" stroke="#d8862c" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  lion: (
    <>
      <circle cx="32" cy="33" r="24" fill="#c96f2f" />
      <circle cx="32" cy="33" r="24" fill="none" stroke="#a85723" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="32" cy="34" r="17" fill="#f2b04a" />
      <circle cx="17" cy="20" r="4.5" fill="#f2b04a" />
      <circle cx="47" cy="20" r="4.5" fill="#f2b04a" />
      <Eyes y={31} dx={8} />
      <ellipse cx="32" cy="39" rx="3.4" ry="2.6" fill="#6b3d1e" />
      <path d="M32 41 L32 45 M32 45 Q 27 49 24 45 M32 45 Q 37 49 40 45" stroke="#6b3d1e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  frog: (
    <>
      <circle cx="20" cy="16" r="8" fill="#57b656" />
      <circle cx="44" cy="16" r="8" fill="#57b656" />
      <circle cx="20" cy="15" r="4.5" fill="#fff" />
      <circle cx="44" cy="15" r="4.5" fill="#fff" />
      <circle cx="20" cy="15" r="2.2" fill="#1f2430" />
      <circle cx="44" cy="15" r="2.2" fill="#1f2430" />
      <path d="M12 34 a20 18 0 1 0 40 0 a20 15 0 0 0 -40 0" fill="#63c261" />
      <circle cx="24" cy="33" r="2" fill="#3c8f42" />
      <circle cx="40" cy="33" r="2" fill="#3c8f42" />
      <path d="M22 41 Q 32 49 42 41" stroke="#2e6f33" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  koala: (
    <>
      <circle cx="13" cy="22" r="10" fill="#9aa3b2" />
      <circle cx="51" cy="22" r="10" fill="#9aa3b2" />
      <circle cx="13" cy="22" r="5" fill="#e8b7c4" />
      <circle cx="51" cy="22" r="5" fill="#e8b7c4" />
      <circle cx="32" cy="34" r="19" fill="#aeb7c5" />
      <Eyes y={31} dx={9} />
      <ellipse cx="32" cy="39" rx="4.5" ry="6" fill="#3a3f4a" />
      <Smile y={49} w={5} />
    </>
  ),
  cat: (
    <>
      <path d="M14 24 L11 8 L26 14 Z" fill="#7d6bd9" />
      <path d="M50 24 L53 8 L38 14 Z" fill="#7d6bd9" />
      <path d="M15 21 L13.5 12 L22 15.5 Z" fill="#f3c9e0" />
      <path d="M49 21 L50.5 12 L42 15.5 Z" fill="#f3c9e0" />
      <circle cx="32" cy="34" r="20" fill="#8f7ee6" />
      <Eyes y={32} />
      <path d="M32 38 L29.5 41 L34.5 41 Z" fill="#f3c9e0" />
      <path d="M32 41 Q 28 45 25 42 M32 41 Q 36 45 39 42" stroke="#4d3f8f" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 36 L22 37 M12 42 L22 41 M52 36 L42 37 M52 42 L42 41" stroke="#e6ddff" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  explorer: (
    <>
      <circle cx="32" cy="36" r="17" fill="#eeb98c" />
      <path d="M10 26 Q 32 20 54 26 L 54 30 Q 32 25 10 30 Z" fill="#b98a4e" />
      <path d="M16 26 Q 16 10 32 10 Q 48 10 48 26 Q 32 21 16 26" fill="#cfa05e" />
      <path d="M16 24 Q 32 19 48 24" stroke="#8f6a35" strokeWidth="2.5" fill="none" />
      <Eyes y={36} dx={7} />
      <Smile y={44} w={6} />
      <circle cx="32" cy="13" r="1.6" fill="#8f6a35" />
    </>
  ),
  astronaut: (
    <>
      <circle cx="32" cy="32" r="22" fill="#e9edf5" />
      <circle cx="32" cy="32" r="15" fill="#25304a" />
      <circle cx="32" cy="34" r="12" fill="#eeb98c" />
      <Eyes y={32} dx={6} />
      <Smile y={39} w={5} />
      <path d="M14 32 a18 18 0 0 1 36 0" fill="none" stroke="#ffb347" strokeWidth="2.5" />
      <circle cx="52" cy="40" r="3" fill="#ff6b57" />
      <circle cx="12" cy="40" r="3" fill="#ff6b57" />
    </>
  ),
  aviator: (
    <>
      <circle cx="32" cy="36" r="17" fill="#eeb98c" />
      <path d="M15 34 Q 15 13 32 13 Q 49 13 49 34 L 44 34 Q 44 22 32 22 Q 20 22 20 34 Z" fill="#8a5a33" />
      <rect x="17" y="27" width="30" height="9" rx="4.5" fill="#5b442a" />
      <circle cx="25" cy="31.5" r="5" fill="#cfe3f0" stroke="#3e2f1d" strokeWidth="2" />
      <circle cx="39" cy="31.5" r="5" fill="#cfe3f0" stroke="#3e2f1d" strokeWidth="2" />
      <Smile y={45} w={6} />
      <path d="M12 33 L17 30 M52 33 L47 30" stroke="#8a5a33" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  captain: (
    <>
      <circle cx="32" cy="37" r="16" fill="#eeb98c" />
      <path d="M14 28 Q 32 22 50 28 L 50 32 Q 32 27 14 32 Z" fill="#1f2a44" />
      <path d="M18 28 Q 18 14 32 14 Q 46 14 46 28 Q 32 23 18 28" fill="#f2f5f7" />
      <path d="M18 27 Q 32 22 46 27" stroke="#d9b64c" strokeWidth="2" fill="none" />
      <circle cx="32" cy="18" r="2.4" fill="#d9b64c" />
      <Eyes y={36} dx={7} />
      <path d="M24 45 Q 32 51 40 45 Q 36 48 32 48 Q 28 48 24 45" fill="#e5e9ee" />
      <Smile y={44} w={4} />
    </>
  ),
};

export const AVATARS: AvatarDef[] = [
  { id: 'fox', name: 'Fennec the Fox', kind: 'animal', bg: '#3d2a5e' },
  { id: 'panda', name: 'Bamboo the Panda', kind: 'animal', bg: '#2a4a5e' },
  { id: 'owl', name: 'Atlas the Owl', kind: 'animal', bg: '#2f3d63' },
  { id: 'penguin', name: 'Pip the Penguin', kind: 'animal', bg: '#274a63' },
  { id: 'lion', name: 'Sol the Lion', kind: 'animal', bg: '#5e3a2a' },
  { id: 'frog', name: 'Hopscotch the Frog', kind: 'animal', bg: '#254a3a' },
  { id: 'koala', name: 'Kip the Koala', kind: 'animal', bg: '#3a4258' },
  { id: 'cat', name: 'Nova the Cat', kind: 'animal', bg: '#46295e' },
  { id: 'explorer', name: 'Sunny the Explorer', kind: 'hero', bg: '#5e4a2a' },
  { id: 'astronaut', name: 'Comet the Astronaut', kind: 'hero', bg: '#232d52' },
  { id: 'aviator', name: 'Skye the Aviator', kind: 'hero', bg: '#503a28' },
  { id: 'captain', name: 'Marina the Captain', kind: 'hero', bg: '#1f3a52' },
];

export const avatarById = new Map(AVATARS.map((a) => [a.id, a]));

export function AvatarIcon({ id, size = 48, className }: { id: string; size?: number; className?: string }) {
  const def = avatarById.get(id) ?? AVATARS[0];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={def.name}
    >
      <circle cx="32" cy="32" r="31" fill={def.bg} />
      {faces[def.id] ?? faces.fox}
    </svg>
  );
}

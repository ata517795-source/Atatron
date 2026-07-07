/**
 * Original explorer characters for Wanderworld — realistic traveller figures
 * drawn from scratch as layered SVG (no copyrighted characters).
 *
 * Three renderings share one palette:
 *   • AvatarIcon    — front head-and-shoulders portrait (picker + header)
 *   • ExplorerStanding — front full figure (picker preview)
 *   • WalkingExplorer  — back-view full body, JS-animated walk / run / photo
 */
import { useEffect, useRef } from 'react';

export type Gait = 'idle' | 'walk' | 'run' | 'photo';

export interface AvatarDef {
  id: string;
  name: string;
  kind: 'explorer';
  skin: string;
  skinShade: string;
  hair: string;
  hairStyle: 'short' | 'bun' | 'ponytail' | 'curly';
  hat: 'none' | 'cap' | 'brim' | 'beanie';
  hatColor: string;
  jacket: string;
  jacketShade: string;
  pants: string;
  pack: string;
  packAccent: string;
  shoe: string;
  bg: string;
}

export const AVATARS: AvatarDef[] = [
  { id: 'sunny', name: 'Sunny Vale', kind: 'explorer', skin: '#e7b48c', skinShade: '#d59d73', hair: '#5b3f28', hairStyle: 'short', hat: 'brim', hatColor: '#b89b6a', jacket: '#c67b5c', jacketShade: '#a9603f', pants: '#5d5140', pack: '#7a8b6f', packAccent: '#5c6b52', shoe: '#463b30', bg: '#2a2622' },
  { id: 'marco', name: 'Marco Reyes', kind: 'explorer', skin: '#d59f72', skinShade: '#bd8659', hair: '#2e2620', hairStyle: 'short', hat: 'cap', hatColor: '#33465e', jacket: '#4a6b6b', jacketShade: '#375252', pants: '#3b414d', pack: '#b0703f', packAccent: '#8a5530', shoe: '#2c2620', bg: '#1f2a2e' },
  { id: 'aria', name: 'Aria Lindqvist', kind: 'explorer', skin: '#efc7a0', skinShade: '#dcae85', hair: '#3a2a1e', hairStyle: 'ponytail', hat: 'none', hatColor: '#000000', jacket: '#a86b7a', jacketShade: '#8a5462', pants: '#575263', pack: '#d3a568', packAccent: '#b3854a', shoe: '#3a3038', bg: '#2e2430' },
  { id: 'kai', name: 'Kai Mensah', kind: 'explorer', skin: '#a9784f', skinShade: '#8f6340', hair: '#1a1512', hairStyle: 'short', hat: 'beanie', hatColor: '#6b7a5c', jacket: '#d0b06a', jacketShade: '#b0924f', pants: '#484036', pack: '#5c6b7a', packAccent: '#455260', shoe: '#282420', bg: '#26261f' },
  { id: 'nadia', name: 'Nadia Amari', kind: 'explorer', skin: '#e4bb95', skinShade: '#cfa279', hair: '#241c14', hairStyle: 'bun', hat: 'brim', hatColor: '#c9a06a', jacket: '#6b8b7a', jacketShade: '#527065', pants: '#3b3842', pack: '#b56a5c', packAccent: '#8f5044', shoe: '#312c26', bg: '#222a26' },
  { id: 'theo', name: 'Theo Bianchi', kind: 'explorer', skin: '#c68e5f', skinShade: '#a97444', hair: '#3a2a1a', hairStyle: 'curly', hat: 'cap', hatColor: '#7a5c3f', jacket: '#4a5c7a', jacketShade: '#374863', pants: '#484842', pack: '#c9a86a', packAccent: '#a5854c', shoe: '#2c2620', bg: '#1f2530' },
  { id: 'luca', name: 'Luca Moreno', kind: 'explorer', skin: '#eec7a0', skinShade: '#d9ac82', hair: '#4a3320', hairStyle: 'short', hat: 'none', hatColor: '#000000', jacket: '#b5764a', jacketShade: '#955b34', pants: '#383e46', pack: '#7a8b9a', packAccent: '#5f6f7d', shoe: '#312e28', bg: '#2a2420' },
  { id: 'mira', name: 'Mira Okonkwo', kind: 'explorer', skin: '#b07a52', skinShade: '#966239', hair: '#1a1410', hairStyle: 'ponytail', hat: 'beanie', hatColor: '#a86b6a', jacket: '#5c7a6b', jacketShade: '#456055', pants: '#423e48', pack: '#d3b36a', packAccent: '#b0904c', shoe: '#2c2824', bg: '#232823' },
];

export const avatarById = new Map(AVATARS.map((a) => [a.id, a]));
export const characterById = avatarById;

// ─── back-of-head hair + hat ─────────────────────────────────────────────────

function HairBack({ d }: { d: AvatarDef }) {
  const { hair, hairStyle } = d;
  return (
    <g>
      {/* hair mass covering the back of the head */}
      <path d="M35 40 Q35 24 50 24 Q65 24 65 40 Q65 50 60 53 L40 53 Q35 50 35 40 Z" fill={hair} />
      {hairStyle === 'bun' && <circle cx="50" cy="24" r="7" fill={hair} />}
      {hairStyle === 'ponytail' && (
        <path d="M50 30 Q58 40 55 62 Q52 70 48 62 Q46 44 50 30 Z" fill={hair} />
      )}
      {hairStyle === 'curly' && (
        <g fill={hair}>
          <circle cx="38" cy="30" r="6" />
          <circle cx="50" cy="26" r="7" />
          <circle cx="62" cy="30" r="6" />
          <circle cx="36" cy="42" r="5" />
          <circle cx="64" cy="42" r="5" />
        </g>
      )}
    </g>
  );
}

function HatBack({ d }: { d: AvatarDef }) {
  if (d.hat === 'none') return null;
  if (d.hat === 'cap') {
    return (
      <g>
        <path d="M34 39 Q34 22 50 22 Q66 22 66 39 Q50 33 34 39 Z" fill={d.hatColor} />
        {/* adjustable back strap detail */}
        <rect x="45" y="37" width="10" height="5" rx="1.5" fill={d.hatColor} />
        <rect x="48.5" y="38" width="3" height="3" rx="1" fill="rgba(0,0,0,0.35)" />
      </g>
    );
  }
  if (d.hat === 'beanie') {
    return (
      <g>
        <path d="M33 42 Q33 22 50 22 Q67 22 67 42 Q50 36 33 42 Z" fill={d.hatColor} />
        <rect x="33" y="40" width="34" height="5" rx="2.5" fill={d.hatColor} />
        <path d="M37 43 L37 30 M44 44 L44 27 M50 44 L50 26 M56 44 L56 27 M63 43 L63 30" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
      </g>
    );
  }
  // brim (safari / bucket)
  return (
    <g>
      <ellipse cx="50" cy="41" rx="24" ry="7" fill={d.hatColor} />
      <path d="M35 41 Q35 21 50 21 Q65 21 65 41 Z" fill={d.hatColor} />
      <ellipse cx="50" cy="41" rx="24" ry="7" fill="rgba(0,0,0,0.10)" />
      <path d="M35 39 Q35 21 50 21 Q65 21 65 39 Z" fill={d.hatColor} />
    </g>
  );
}

// ─── front hair + hat + face ─────────────────────────────────────────────────

function HairFront({ d }: { d: AvatarDef }) {
  const { hair, hairStyle } = d;
  return (
    <g fill={hair}>
      {/* hairline framing the forehead */}
      <path d="M35 40 Q34 25 50 25 Q66 25 65 40 Q60 31 50 30 Q40 31 35 40 Z" />
      {hairStyle === 'bun' && <circle cx="50" cy="24" r="5.5" />}
      {hairStyle === 'ponytail' && (
        <>
          <path d="M35 40 Q33 33 36 46 Q33 44 34 38 Z" />
          <path d="M65 40 Q67 33 64 46 Q67 44 66 38 Z" />
        </>
      )}
      {hairStyle === 'curly' && (
        <g>
          <circle cx="38" cy="31" r="5" />
          <circle cx="50" cy="27" r="6" />
          <circle cx="62" cy="31" r="5" />
        </g>
      )}
    </g>
  );
}

function HatFront({ d }: { d: AvatarDef }) {
  if (d.hat === 'none') return null;
  if (d.hat === 'cap') {
    return (
      <g>
        <path d="M34 39 Q34 23 50 23 Q66 23 66 39 Q50 33 34 39 Z" fill={d.hatColor} />
        <path d="M33 39 Q22 40 21 44 Q34 44 50 41 Z" fill={d.hatColor} />
        <path d="M33 39 Q22 40 21 44 Q34 44 50 41 Z" fill="rgba(0,0,0,0.12)" />
      </g>
    );
  }
  if (d.hat === 'beanie') {
    return (
      <g>
        <path d="M33 41 Q33 23 50 23 Q67 23 67 41 Q50 35 33 41 Z" fill={d.hatColor} />
        <rect x="33" y="39" width="34" height="5.5" rx="2.75" fill={d.hatColor} />
      </g>
    );
  }
  return (
    <g>
      <path d="M35 40 Q35 22 50 22 Q65 22 65 40 Z" fill={d.hatColor} />
      <ellipse cx="50" cy="41" rx="25" ry="7.5" fill={d.hatColor} />
      <ellipse cx="50" cy="41" rx="25" ry="7.5" fill="rgba(0,0,0,0.10)" />
      <path d="M50 22 Q65 22 65 40 L35 40 Q35 22 50 22Z" fill={d.hatColor} />
      <path d="M37 40 L63 40" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
    </g>
  );
}

function Face({ d }: { d: AvatarDef }) {
  return (
    <g>
      {/* soft cheek shading */}
      <ellipse cx="42" cy="46" rx="3" ry="2" fill={d.skinShade} opacity="0.4" />
      <ellipse cx="58" cy="46" rx="3" ry="2" fill={d.skinShade} opacity="0.4" />
      {/* eyes */}
      <ellipse cx="44" cy="41" rx="1.7" ry="2.1" fill="#2a2320" />
      <ellipse cx="56" cy="41" rx="1.7" ry="2.1" fill="#2a2320" />
      <circle cx="44.6" cy="40.3" r="0.6" fill="#fff" />
      <circle cx="56.6" cy="40.3" r="0.6" fill="#fff" />
      {/* brows */}
      <path d="M41 37.5 Q44 36.3 47 37.5" stroke={d.hair} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M53 37.5 Q56 36.3 59 37.5" stroke={d.hair} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* nose + gentle smile */}
      <path d="M50 42 L49 46 Q50 47 51 46" stroke={d.skinShade} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M46 50 Q50 53 54 50" stroke="#9a5a48" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

// ─── shared limb primitives ──────────────────────────────────────────────────

function Backpack({ d }: { d: AvatarDef }) {
  return (
    <g>
      <path d="M40 60 Q40 57 43 57 L57 57 Q60 57 60 60" fill="none" stroke={d.packAccent} strokeWidth="3" strokeLinecap="round" />
      <rect x="31" y="60" width="38" height="52" rx="10" fill={d.pack} />
      <rect x="31" y="60" width="38" height="52" rx="10" fill="url(#packShade)" />
      <rect x="36" y="86" width="28" height="20" rx="6" fill={d.packAccent} opacity="0.55" />
      <line x1="34" y1="74" x2="66" y2="74" stroke={d.packAccent} strokeWidth="1.5" opacity="0.6" />
      <circle cx="50" cy="72" r="3" fill={d.packAccent} />
    </g>
  );
}

// ─── FRONT full figure (picker preview) ──────────────────────────────────────

function FrontFigure({ d }: { d: AvatarDef }) {
  return (
    <g>
      <ellipse cx="50" cy="167" rx="24" ry="4.5" fill="rgba(0,0,0,0.28)" />
      {/* legs */}
      <g>
        <rect x="41" y="100" width="9" height="48" rx="4" fill={d.pants} />
        <rect x="50" y="100" width="9" height="48" rx="4" fill={d.pants} />
        <rect x="39" y="145" width="13" height="9" rx="3.5" fill={d.shoe} />
        <rect x="48" y="145" width="13" height="9" rx="3.5" fill={d.shoe} />
      </g>
      {/* arms */}
      <g>
        <rect x="22" y="66" width="9" height="36" rx="4.5" fill={d.jacketShade} />
        <circle cx="26.5" cy="103" r="4.5" fill={d.skin} />
        <rect x="69" y="66" width="9" height="36" rx="4.5" fill={d.jacketShade} />
        <circle cx="73.5" cy="103" r="4.5" fill={d.skin} />
      </g>
      {/* torso / jacket */}
      <path d="M30 66 Q30 62 34 62 L66 62 Q70 62 70 66 L72 104 L28 104 Z" fill={d.jacket} />
      <path d="M28 104 L72 104 L70 66 Q70 62 66 62 L58 62 L50 70 L58 104 Z" fill={d.jacketShade} opacity="0.35" />
      <path d="M50 62 L45 70 L50 78 L55 70 Z" fill={d.jacketShade} opacity="0.6" />
      <line x1="50" y1="70" x2="50" y2="104" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
      {/* backpack straps over the shoulders */}
      <rect x="37" y="63" width="5" height="40" rx="2.5" fill={d.packAccent} />
      <rect x="58" y="63" width="5" height="40" rx="2.5" fill={d.packAccent} />
      <rect x="36.5" y="86" width="6" height="5" rx="1.5" fill={d.pack} />
      <rect x="57.5" y="86" width="6" height="5" rx="1.5" fill={d.pack} />
      {/* neck + head */}
      <rect x="45" y="53" width="10" height="10" rx="3" fill={d.skinShade} />
      <circle cx="50" cy="41" r="15" fill={d.skin} />
      <Face d={d} />
      <HairFront d={d} />
      <HatFront d={d} />
    </g>
  );
}

// ─── BACK full figure, animated (Street View third person) ───────────────────

export function WalkingExplorer({ id, gait, size = 190 }: { id: string; gait: Gait; size?: number }) {
  const d = avatarById.get(id) ?? AVATARS[0];
  const legL = useRef<SVGGElement>(null);
  const legR = useRef<SVGGElement>(null);
  const armL = useRef<SVGGElement>(null);
  const armR = useRef<SVGGElement>(null);
  const bob = useRef<SVGGElement>(null);
  const phase = useRef(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const cfg =
      gait === 'run'
        ? { spd: 12, leg: 34, arm: 26, bob: 4 }
        : gait === 'walk'
          ? { spd: 7.5, leg: 22, arm: 16, bob: 2.6 }
          : { spd: 2.4, leg: 2.5, arm: 3, bob: 1.1 };
    const lean = gait === 'run' ? 5 : gait === 'walk' ? 2 : 0;
    const posing = gait === 'photo';
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phase.current += dt * cfg.spd;
      const p = phase.current;
      if (legL.current) legL.current.style.transform = `rotate(${Math.sin(p) * cfg.leg}deg)`;
      if (legR.current) legR.current.style.transform = `rotate(${Math.sin(p + Math.PI) * cfg.leg}deg)`;
      if (armL.current)
        armL.current.style.transform = posing ? 'rotate(-46deg)' : `rotate(${Math.sin(p + Math.PI) * cfg.arm}deg)`;
      if (armR.current)
        armR.current.style.transform = posing ? 'rotate(46deg)' : `rotate(${Math.sin(p) * cfg.arm}deg)`;
      if (bob.current)
        bob.current.style.transform = `translateY(${-Math.abs(Math.sin(p)) * cfg.bob}px) rotate(${lean}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gait]);

  const pivot = { transformBox: 'fill-box' as const, transformOrigin: 'top center' };

  return (
    <svg
      viewBox="0 0 100 175"
      width={(size * 100) / 175}
      height={size}
      role="img"
      aria-label={`${d.name}, walking`}
    >
      <defs>
        <linearGradient id="packShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="168" rx={gait === 'idle' ? 22 : 20} ry="4.5" fill="rgba(0,0,0,0.32)" />
      <g ref={bob} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
        {/* legs (behind body) */}
        <g ref={legL} style={pivot}>
          <rect x="41" y="100" width="9" height="46" rx="4" fill={d.pants} />
          <rect x="39" y="143" width="13" height="9" rx="3.5" fill={d.shoe} />
        </g>
        <g ref={legR} style={pivot}>
          <rect x="50" y="100" width="9" height="46" rx="4" fill={d.pants} />
          <rect x="48" y="143" width="13" height="9" rx="3.5" fill={d.shoe} />
        </g>
        {/* torso */}
        <path d="M30 66 Q30 62 34 62 L66 62 Q70 62 70 66 L71 104 L29 104 Z" fill={d.jacket} />
        {/* arms */}
        <g ref={armL} style={pivot}>
          <rect x="22" y="66" width="9" height="36" rx="4.5" fill={d.jacket} />
          <circle cx="26.5" cy="103" r="4.5" fill={d.skin} />
        </g>
        <g ref={armR} style={pivot}>
          <rect x="69" y="66" width="9" height="36" rx="4.5" fill={d.jacket} />
          <circle cx="73.5" cy="103" r="4.5" fill={d.skin} />
        </g>
        {/* backpack (the hero detail from behind) */}
        <Backpack d={d} />
        {/* head */}
        <rect x="45" y="52" width="10" height="10" rx="3" fill={d.skinShade} />
        <circle cx="50" cy="41" r="15" fill={d.skin} />
        <HairBack d={d} />
        <HatBack d={d} />
      </g>
    </svg>
  );
}

// ─── front portrait / standing (UI) ──────────────────────────────────────────

export function ExplorerStanding({ id, size = 120 }: { id: string; size?: number }) {
  const d = avatarById.get(id) ?? AVATARS[0];
  return (
    <svg viewBox="0 0 100 175" width={(size * 100) / 175} height={size} role="img" aria-label={d.name}>
      <FrontFigure d={d} />
    </svg>
  );
}

export function AvatarIcon({ id, size = 48, className }: { id: string; size?: number; className?: string }) {
  const d = avatarById.get(id) ?? AVATARS[0];
  return (
    <svg
      width={size}
      height={size}
      viewBox="20 20 60 60"
      className={className}
      role="img"
      aria-label={d.name}
    >
      <circle cx="50" cy="50" r="30" fill={d.bg} />
      <clipPath id={`clip-${d.id}`}>
        <circle cx="50" cy="50" r="30" />
      </clipPath>
      <g clipPath={`url(#clip-${d.id})`}>
        {/* shoulders */}
        <path d="M28 80 Q30 62 50 62 Q70 62 72 80 Z" fill={d.jacket} />
        <rect x="37" y="63" width="5" height="18" rx="2.5" fill={d.packAccent} />
        <rect x="58" y="63" width="5" height="18" rx="2.5" fill={d.packAccent} />
        <rect x="45" y="53" width="10" height="11" rx="3" fill={d.skinShade} />
        <circle cx="50" cy="41" r="15" fill={d.skin} />
        <Face d={d} />
        <HairFront d={d} />
        <HatFront d={d} />
      </g>
    </svg>
  );
}

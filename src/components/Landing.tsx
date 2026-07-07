import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { AVATARS, AvatarIcon } from '../lib/avatars';
import { Starfield } from './Starfield';
import { registerExplorer } from '../lib/supabase';

export function Landing() {
  const setPlayer = useGame((s) => s.setPlayer);
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const ready = nickname.trim().length >= 2;

  const start = () => {
    if (!ready) return;
    const player = { id: crypto.randomUUID(), nickname: nickname.trim(), avatarId };
    setPlayer(player);
    void registerExplorer(player); // no-op unless Supabase is configured
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-y-auto bg-gradient-to-b from-dusk-950 via-dusk-900 to-[#3b1d4e] p-6">
      <Starfield count={140} />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-coral-600/25 to-transparent" aria-hidden />

      <div className="relative z-10 w-full max-w-xl animate-pop-in rounded-3xl border border-amber-glow/25 bg-dusk-900/85 p-8 shadow-[0_0_80px_rgba(255,107,87,0.25)] backdrop-blur">
        <div className="text-center">
          <div className="animate-float text-6xl" aria-hidden>🌍</div>
          <h1 className="mt-2 font-display text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gold-400 via-coral-400 to-amber-glow">
            Wanderworld
          </h1>
          <p className="mt-2 text-sm font-semibold text-gold-300/80">
            Roam a colorful Earth · step into real countries · collect 50 photos of the world
          </p>
        </div>

        <label className="mt-8 block text-sm font-extrabold uppercase tracking-wider text-amber-glow">
          Your explorer nickname
        </label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          maxLength={24}
          placeholder="e.g. CloudChaser"
          className="mt-2 w-full rounded-2xl border border-dusk-500 bg-dusk-800 px-4 py-3 text-lg font-bold text-white placeholder-white/30 outline-none transition focus:border-coral-400 focus:ring-2 focus:ring-coral-500/40"
        />

        <label className="mt-6 block text-sm font-extrabold uppercase tracking-wider text-amber-glow">
          Pick your avatar
        </label>
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAvatarId(a.id)}
              title={a.name}
              className={`group flex flex-col items-center gap-1 rounded-2xl p-2 transition ${
                avatarId === a.id
                  ? 'bg-coral-500/25 ring-2 ring-coral-400'
                  : 'hover:bg-white/5'
              }`}
            >
              <AvatarIcon id={a.id} size={56} className="transition group-hover:scale-110" />
              <span className="w-full truncate text-center text-[10px] font-bold text-white/60">
                {a.name.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/40">
          All avatars are original Wanderworld characters — pick your favorite!
        </p>

        <button
          onClick={start}
          disabled={!ready}
          className="mt-7 w-full rounded-2xl bg-gradient-to-r from-coral-500 to-amber-glow py-4 font-display text-2xl font-extrabold text-dusk-950 shadow-lg shadow-coral-600/40 transition enabled:hover:scale-[1.02] enabled:hover:shadow-coral-500/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start exploring! 🧭
        </button>
      </div>
    </div>
  );
}

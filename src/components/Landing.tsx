import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { AVATARS, AvatarIcon, ExplorerStanding } from '../lib/avatars';
import { registerExplorer } from '../lib/supabase';
import { sfx } from '../lib/sfx';

export function Landing() {
  const setPlayer = useGame((s) => s.setPlayer);
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const ready = nickname.trim().length >= 2;
  const selected = useMemo(() => AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0], [avatarId]);

  const start = () => {
    if (!ready) return;
    sfx.chime();
    const player = { id: crypto.randomUUID(), nickname: nickname.trim(), avatarId };
    setPlayer(player);
    void registerExplorer(player); // no-op unless Supabase is configured
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-ink-950">
      {/* cinematic golden-hour hero, built from layered gradients (always loads) */}
      <div className="absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, #2a3f52 0%, #3d5266 22%, #7b7a6a 46%, #c69a5f 66%, #a8703f 82%, #5c3a24 100%)',
          }}
        />
        {/* soft sun glow */}
        <div
          className="absolute left-1/2 top-[38%] h-[46vmax] w-[46vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,226,170,0.55) 0%, rgba(255,200,130,0.12) 45%, transparent 70%)' }}
        />
        {/* distant hills */}
        <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 420" preserveAspectRatio="none">
          <path d="M0 260 Q 240 200 480 250 T 960 235 T 1440 250 L1440 420 L0 420 Z" fill="#6e5a3e" opacity="0.55" />
          <path d="M0 300 Q 300 245 620 290 T 1180 285 T 1440 300 L1440 420 L0 420 Z" fill="#4a3927" opacity="0.7" />
          <path d="M0 350 Q 360 315 720 345 T 1440 345 L1440 420 L0 420 Z" fill="#2f2418" />
        </svg>
        {/* golden grass foreground texture */}
        <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: 'linear-gradient(0deg, rgba(30,20,12,0.9), transparent)' }} />
      </div>
      <div className="grain absolute inset-0" aria-hidden />

      {/* content */}
      <div className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col px-6 py-8">
        {/* wordmark */}
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl font-medium tracking-[0.35em] text-sand-100">
            WANDERWORLD
          </div>
          <div className="hidden text-xs font-medium uppercase tracking-[0.25em] text-sand-200/70 sm:block">
            A journey on foot
          </div>
        </div>

        {/* frosted card */}
        <div className="my-auto grid animate-fade-up gap-8 rounded-3xl border border-sand-100/15 bg-ink-950/35 p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md md:grid-cols-[1.1fr_0.9fr] md:p-12">
          {/* left: pitch + form */}
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">
              Real places · one step at a time
            </p>
            <h1 className="mt-4 font-display text-5xl font-light leading-[1.05] text-sand-50 md:text-6xl">
              An adventure
              <br />
              <span className="italic text-gold-300">designed just for you</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-sand-200/80">
              Choose your explorer, roam a living map of Earth, and step into real countries
              through Google Street View. Walk, run, and collect fifty photographs of the world.
            </p>

            <label className="mt-8 block text-[11px] font-semibold uppercase tracking-[0.2em] text-sand-200/70">
              Traveller name
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              maxLength={24}
              placeholder="e.g. Amara"
              className="mt-2 w-full border-b border-sand-100/25 bg-transparent pb-2 text-2xl font-light text-sand-50 placeholder-sand-200/25 outline-none transition focus:border-gold-300"
            />

            <button
              onClick={start}
              disabled={!ready}
              className="group mt-8 inline-flex w-fit items-center gap-3 rounded-full bg-sand-100 px-7 py-3.5 font-medium tracking-wide text-ink-950 transition enabled:hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Begin the journey
              <span className="transition-transform group-enabled:group-hover:translate-x-1">→</span>
            </button>
          </div>

          {/* right: chosen explorer + picker */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-ink-900/40 p-6">
            <div className="flex h-44 items-end justify-center">
              <ExplorerStanding id={selected.id} size={168} />
            </div>
            <div className="mt-1 text-center">
              <div className="font-display text-xl text-sand-50">{selected.name}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-sand-200/60">Explorer</div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    sfx.click();
                    setAvatarId(a.id);
                  }}
                  title={a.name}
                  aria-label={a.name}
                  className={`rounded-full p-0.5 transition ${
                    avatarId === a.id
                      ? 'ring-2 ring-gold-300'
                      : 'opacity-70 ring-1 ring-transparent hover:opacity-100'
                  }`}
                >
                  <AvatarIcon id={a.id} size={44} />
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] leading-4 text-sand-200/45">
              Original Wanderworld travellers — no two the same
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-sand-200/50">
          Live data from Wikidata, Wikipedia &amp; Open-Meteo · Street View imagery © Google
        </p>
      </div>
    </div>
  );
}

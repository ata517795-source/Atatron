import { useGame, PHOTO_GOAL } from '../store/gameStore';
import { fetchExplorers, supabaseEnabled } from '../lib/supabase';
import { useAsync } from '../lib/useAsync';
import { AvatarIcon, avatarById } from '../lib/avatars';

const MEDALS = ['🥇', '🥈', '🥉'];

export function ExplorersPanel() {
  const setExplorersOpen = useGame((s) => s.setExplorersOpen);
  const player = useGame((s) => s.player);
  const photos = useGame((s) => s.photos);
  const visited = useGame((s) => s.visited);

  const rows = useAsync(fetchExplorers, []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-dusk-950/85 p-4 backdrop-blur">
      <div className="flex max-h-[85vh] w-full max-w-lg animate-pop-in flex-col rounded-3xl border border-amber-glow/30 bg-dusk-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="font-display text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-coral-400">
            🧑‍🤝‍🧑 Explorers
          </h2>
          <button
            onClick={() => setExplorersOpen(false)}
            className="rounded-full bg-white/10 px-3 py-1 text-sm font-black text-white/75 transition hover:bg-coral-500/40"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* you, always */}
          {player && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-coral-500/25 to-amber-glow/15 p-3 ring-1 ring-coral-400/40">
              <AvatarIcon id={player.avatarId} size={46} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold text-white">
                  {player.nickname} <span className="text-xs font-bold text-coral-300">(you)</span>
                </div>
                <div className="text-xs font-bold text-white/60">
                  📸 {photos.length}/{PHOTO_GOAL} photos · 🌍 {visited.length} countries
                </div>
              </div>
              {photos.length >= PHOTO_GOAL && <span className="text-2xl">🏆</span>}
            </div>
          )}

          {!supabaseEnabled && (
            <p className="rounded-xl bg-dusk-800 p-3 text-xs font-semibold leading-5 text-white/55">
              Playing locally. To join a shared Explorers list with a photo leaderboard, configure{' '}
              <code className="text-gold-300">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-gold-300">VITE_SUPABASE_ANON_KEY</code> — see the README for the
              one-table setup.
            </p>
          )}

          {supabaseEnabled && (
            <>
              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-amber-glow">
                Photo leaderboard
              </h3>
              {rows.status === 'loading' && <div className="skeleton h-24 w-full" />}
              {rows.status === 'error' && (
                <p className="text-sm font-semibold text-white/40">Couldn't reach the shared list right now.</p>
              )}
              {rows.status === 'ok' &&
                (!rows.data || rows.data.length === 0 ? (
                  <p className="text-sm font-semibold text-white/40">
                    No explorers yet — you're the first! 🎉
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {rows.data.map((r, i) => (
                      <li
                        key={r.id}
                        className={`flex items-center gap-3 rounded-xl p-2 ${
                          r.id === player?.id ? 'bg-coral-500/20 ring-1 ring-coral-400/40' : 'bg-dusk-800/70'
                        }`}
                      >
                        <span className="w-7 text-center text-lg">{MEDALS[i] ?? `${i + 1}.`}</span>
                        <AvatarIcon id={avatarById.has(r.avatar_id) ? r.avatar_id : 'fox'} size={34} />
                        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-white/90">
                          {r.nickname}
                        </span>
                        <span className="text-xs font-bold text-gold-300">📸 {r.photos_count}</span>
                        <span className="text-xs font-bold text-white/50">🌍 {r.countries_count}</span>
                      </li>
                    ))}
                  </ol>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

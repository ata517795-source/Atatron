import { useGame, PHOTO_GOAL, type ViewMode } from './store/gameStore';
import { Landing } from './components/Landing';
import { GlobeView } from './components/GlobeView';
import { FlatMapView } from './components/FlatMapView';
import { AstroMapView } from './components/AstroMapView';
import { CountryPanel } from './components/CountryPanel';
import { StreetViewMode } from './components/StreetViewMode';
import { Album } from './components/Album';
import { ExplorersPanel } from './components/ExplorersPanel';
import { Celebration } from './components/Celebration';
import { AvatarIcon } from './lib/avatars';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'globe', label: 'Globe' },
  { id: 'flat', label: 'Map' },
  { id: 'astro', label: 'Astro' },
];

function WorldScreen() {
  const player = useGame((s) => s.player)!;
  const viewMode = useGame((s) => s.viewMode);
  const setViewMode = useGame((s) => s.setViewMode);
  const photos = useGame((s) => s.photos);
  const setAlbumOpen = useGame((s) => s.setAlbumOpen);
  const setExplorersOpen = useGame((s) => s.setExplorersOpen);
  const soundOn = useGame((s) => s.soundOn);
  const toggleSound = useGame((s) => s.toggleSound);
  const signOut = useGame((s) => s.signOut);
  const progress = Math.min(100, (photos.length / PHOTO_GOAL) * 100);

  return (
    <div className="flex h-full flex-col">
      <header className="z-30 flex items-center gap-4 border-b border-sand-100/10 bg-ink-900/80 px-5 py-2.5 backdrop-blur">
        <h1 className="font-display text-lg font-medium tracking-[0.28em] text-sand-100">
          WANDERWORLD
        </h1>

        <nav className="ml-1 flex items-center gap-1" aria-label="World view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`rounded-full px-3.5 py-1 text-sm tracking-wide transition ${
                viewMode === v.id
                  ? 'bg-sand-100 font-semibold text-ink-950'
                  : 'font-medium text-sand-200/55 hover:text-sand-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAlbumOpen(true)}
            className="group flex items-center gap-2.5 rounded-full border border-sand-100/12 px-3.5 py-1.5 text-sm font-medium text-sand-100 transition hover:border-gold-300/40 hover:bg-ink-800"
            title="Open your photo album"
          >
            <span className="text-gold-300">Album</span>
            <span className="text-sand-200/60">{photos.length}<span className="text-sand-200/30">/{PHOTO_GOAL}</span></span>
            <span className="h-1 w-14 overflow-hidden rounded-full bg-ink-700">
              <span
                className="block h-full rounded-full bg-gold-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </span>
          </button>
          <button
            onClick={() => setExplorersOpen(true)}
            className="rounded-full border border-sand-100/12 px-3.5 py-1.5 text-sm font-medium text-sand-200/70 transition hover:border-gold-300/40 hover:text-sand-100"
          >
            Explorers
          </button>
          <button
            onClick={toggleSound}
            className="rounded-full border border-sand-100/12 px-2.5 py-1.5 text-xs text-sand-200/60 transition hover:text-sand-100"
            title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundOn ? 'Sound ◉' : 'Sound ○'}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-full border border-sand-100/12 py-1 pl-1 pr-3 transition hover:border-gold-300/40"
            title={`${player.nickname} — click to sign out`}
          >
            <AvatarIcon id={player.avatarId} size={26} />
            <span className="max-w-28 truncate text-sm font-medium text-sand-100">{player.nickname}</span>
          </button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {viewMode === 'globe' && <GlobeView />}
        {viewMode === 'flat' && <FlatMapView />}
        {viewMode === 'astro' && <AstroMapView />}
        <CountryPanel />
      </main>
    </div>
  );
}

export default function App() {
  const player = useGame((s) => s.player);
  const insideCca3 = useGame((s) => s.insideCca3);
  const albumOpen = useGame((s) => s.albumOpen);
  const explorersOpen = useGame((s) => s.explorersOpen);
  const celebrationOpen = useGame((s) => s.celebrationOpen);

  if (!player) return <Landing />;
  return (
    <div className="h-full">
      <WorldScreen />
      {insideCca3 && <StreetViewMode key={insideCca3} cca3={insideCca3} />}
      {albumOpen && <Album />}
      {explorersOpen && <ExplorersPanel />}
      {celebrationOpen && <Celebration />}
    </div>
  );
}

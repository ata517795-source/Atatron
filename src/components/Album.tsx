import { useEffect, useMemo, useState } from 'react';
import { useGame, PHOTO_GOAL, type PhotoMeta } from '../store/gameStore';
import { deletePhotoData, loadPhotoData, photoFileName, CAMERA_STYLES } from '../lib/capture';
import { sfx } from '../lib/sfx';

function Polaroid({ meta, index }: { meta: PhotoMeta; index: number }) {
  const removePhoto = useGame((s) => s.removePhoto);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPhotoData(meta.id).then(
      (d) => alive && (d ? setDataUrl(d) : setMissing(true)),
      () => alive && setMissing(true),
    );
    return () => {
      alive = false;
    };
  }, [meta.id]);

  const rot = ((index * 7) % 5) - 2; // playful scatter
  return (
    <figure
      className="group relative animate-pop-in rounded-md bg-white p-2 pb-3 shadow-xl transition hover:z-10 hover:scale-105"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt={`${meta.place}, ${meta.country}`} className="w-full rounded-sm" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-sm bg-gray-200 text-3xl">
          {missing ? '🫥' : '⏳'}
        </div>
      )}
      <figcaption className="mt-1.5 px-1">
        <div className="truncate text-xs font-extrabold text-gray-800">{meta.place}</div>
        <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
          <span>
            {meta.country} · {new Date(meta.takenAt).toLocaleDateString()}
          </span>
          <span title={CAMERA_STYLES[meta.style]?.label}>{CAMERA_STYLES[meta.style]?.emoji}</span>
        </div>
      </figcaption>
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {dataUrl && (
          <a
            href={dataUrl}
            download={photoFileName(meta)}
            className="rounded-md bg-ink-900/85 px-1.5 py-0.5 text-xs"
            title="Download photo"
          >
            ⬇️
          </a>
        )}
        <button
          onClick={() => {
            void deletePhotoData(meta.id);
            removePhoto(meta.id);
            sfx.click();
          }}
          className="rounded-md bg-ink-900/85 px-1.5 py-0.5 text-xs"
          title="Delete photo"
        >
          🗑️
        </button>
      </div>
    </figure>
  );
}

export function Album() {
  const setAlbumOpen = useGame((s) => s.setAlbumOpen);
  const photos = useGame((s) => s.photos);
  const visited = useGame((s) => s.visited);
  const [countryFilter, setCountryFilter] = useState<string>('all');

  const countries = useMemo(
    () => [...new Set(photos.map((p) => p.country))].sort(),
    [photos],
  );
  const shown = countryFilter === 'all' ? photos : photos.filter((p) => p.country === countryFilter);
  const progress = Math.min(100, (photos.length / PHOTO_GOAL) * 100);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-ink-950/97 backdrop-blur">
      <header className="flex flex-wrap items-center gap-3 border-b border-gold-400/25 p-4">
        <h2 className="font-display text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-clay-400">
          📸 Your World Album
        </h2>
        <div className="flex items-center gap-2 text-sm font-extrabold text-gold-300">
          {photos.length}/{PHOTO_GOAL}
          <span className="h-2 w-40 overflow-hidden rounded-full bg-ink-800">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-clay-500 to-gold-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </span>
          <span className="text-white/50">· {visited.length} countries explored</span>
        </div>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="ml-auto rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm font-bold text-white/85 outline-none"
          aria-label="Filter by country"
        >
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setAlbumOpen(false)}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-black text-white/75 transition hover:bg-clay-500/40 hover:text-white"
        >
          ✕ Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {photos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="animate-float text-7xl" aria-hidden>📷</div>
            <p className="font-display text-2xl font-extrabold text-gold-300">No photos yet!</p>
            <p className="max-w-md text-sm font-semibold text-white/55">
              Click a country, hit <span className="text-clay-300">GO!</span>, and press the shutter to start
              filling your album. {PHOTO_GOAL} photos and you've seen the world! 🌍
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shown.map((p, i) => (
              <Polaroid key={p.id} meta={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

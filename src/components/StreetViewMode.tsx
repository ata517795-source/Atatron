import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { useGame, PHOTO_GOAL, type CameraStyle } from '../store/gameStore';
import { byCca3, type Country } from '../lib/countries';
import { fetchCountryLive, fetchLandmarks, type Landmark } from '../lib/wikidata';
import { useAsync } from '../lib/useAsync';
import { findPanorama, loadGoogleMaps, mapsKey } from '../lib/googleMaps';
import { AvatarIcon } from '../lib/avatars';
import { sfx } from '../lib/sfx';
import { CAMERA_STYLES, composePhoto } from '../lib/capture';
import { WORLD_FEATURES, countryOfFeature } from '../lib/worldGeo';
import { syncProgress } from '../lib/supabase';

interface Spawn {
  lat: number;
  lng: number;
  label: string;
  landmarks: Landmark[];
}

// ─── top-level: prepare spawn point, then pick street vs photo mode ──────────

export function StreetViewMode({ cca3 }: { cca3: string }) {
  const country = byCca3.get(cca3);
  const [forcePhotoMode, setForcePhotoMode] = useState(false);
  const [noCoverage, setNoCoverage] = useState(false);

  const prep = useAsync<Spawn>(async () => {
    if (!country) throw new Error('unknown country');
    let lat = country.latlng[0];
    let lng = country.latlng[1];
    let label = country.capital[0] ?? country.name;
    let landmarks: Landmark[] = [];
    try {
      const live = await fetchCountryLive(country.cca2);
      if (live.capital) {
        lat = live.capital.lat;
        lng = live.capital.lng;
        label = live.capital.name;
      }
      landmarks = await fetchLandmarks(live.qid).catch(() => []);
    } catch {
      /* fall back to the country centroid with no landmark list */
    }
    return { lat, lng, label, landmarks };
  }, [cca3]);

  if (!country) return null;

  if (prep.status !== 'ok') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-dusk-950">
        <div className="animate-float text-7xl" aria-hidden>🛸</div>
        <p className="font-display text-2xl font-extrabold text-gold-300">
          {prep.status === 'loading'
            ? `Teleporting to ${country.name} ${country.flagEmoji}…`
            : 'Teleport failed — one more try?'}
        </p>
        {prep.status === 'error' && <ExitButton />}
      </div>
    );
  }

  const useStreet = mapsKey && !forcePhotoMode;
  return useStreet ? (
    <StreetCore
      country={country}
      spawn={prep.data}
      onNoCoverage={() => {
        setNoCoverage(true);
        setForcePhotoMode(true);
      }}
    />
  ) : (
    <PhotoExplore country={country} spawn={prep.data} noCoverage={noCoverage} />
  );
}

function ExitButton({ label = '← Back to the world' }: { label?: string }) {
  const exitCountry = useGame((s) => s.exitCountry);
  return (
    <button
      onClick={() => {
        sfx.click();
        exitCountry();
      }}
      className="rounded-full bg-dusk-800 px-4 py-2 text-sm font-extrabold text-white/85 shadow transition hover:bg-coral-500 hover:text-dusk-950"
    >
      {label}
    </button>
  );
}

// ─── shared capture hook (photo album pipeline) ──────────────────────────────

function useCapture(country: Country) {
  const addPhoto = useGame((s) => s.addPhoto);
  const style = useGame((s) => s.cameraStyle);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(0);
  const [toast, setToastRaw] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setToast = useCallback((msg: string | null) => {
    setToastRaw(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (msg) toastTimer.current = setTimeout(() => setToastRaw(null), 3500);
  }, []);

  const capture = useCallback(
    async (srcUrl: string, place: string) => {
      if (capturing) return;
      setCapturing(true);
      sfx.shutter();
      setFlash((f) => f + 1);
      try {
        const { id } = await composePhoto({
          srcUrl,
          country: country.name,
          flagEmoji: country.flagEmoji,
          place,
          style,
        });
        addPhoto({ id, country: country.name, cca2: country.cca2, place, style, takenAt: Date.now() });
        const s = useGame.getState();
        sfx.chime();
        setToast(
          s.photos.length >= PHOTO_GOAL
            ? '🎉 That was photo 50 — you did it!'
            : `📸 Saved to album — ${s.photos.length}/${PHOTO_GOAL}`,
        );
        if (s.player) void syncProgress(s.player, s.photos.length, s.visited.length);
      } catch (err) {
        console.warn('capture failed:', err);
        setToast('😔 Capture failed — the image service refused this frame. Try again in a moment.');
      } finally {
        setCapturing(false);
      }
    },
    [capturing, country, style, addPhoto, setToast],
  );

  return { capture, capturing, flash, toast, setToast };
}

// ─── shared HUD bits ─────────────────────────────────────────────────────────

function CameraBar({
  onShutter,
  capturing,
}: {
  onShutter: () => void;
  capturing: boolean;
}) {
  const style = useGame((s) => s.cameraStyle);
  const setCameraStyle = useGame((s) => s.setCameraStyle);
  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-dusk-950/80 p-2 backdrop-blur">
      {(Object.keys(CAMERA_STYLES) as CameraStyle[]).map((k) => (
        <button
          key={k}
          onClick={() => {
            sfx.click();
            setCameraStyle(k);
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
            style === k ? 'bg-gold-400 text-dusk-950' : 'text-white/65 hover:text-white'
          }`}
          title={CAMERA_STYLES[k].label}
        >
          {CAMERA_STYLES[k].emoji} {CAMERA_STYLES[k].label}
        </button>
      ))}
      <button
        onClick={onShutter}
        disabled={capturing}
        className="ml-1 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-coral-400 to-coral-600 text-2xl shadow-lg shadow-coral-600/50 ring-4 ring-white/25 transition enabled:hover:scale-110 disabled:opacity-60"
        title="Capture photo (C)"
        aria-label="Capture photo"
      >
        {capturing ? '⏳' : '📸'}
      </button>
    </div>
  );
}

function TppAvatar() {
  const player = useGame((s) => s.player);
  if (!player) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center">
      <div className="animate-float drop-shadow-[0_12px_18px_rgba(0,0,0,0.55)]">
        <AvatarIcon id={player.avatarId} size={110} />
      </div>
      <span className="mt-1 rounded-full bg-dusk-950/75 px-3 py-0.5 text-xs font-extrabold text-gold-300">
        {player.nickname}
      </span>
    </div>
  );
}

function TeleportDrawer({
  landmarks,
  onPick,
  onClose,
  photoModeOnly,
}: {
  landmarks: Landmark[];
  onPick: (l: Landmark) => void;
  onClose: () => void;
  photoModeOnly: boolean;
}) {
  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-80 animate-fade-in flex-col border-l border-amber-glow/25 bg-dusk-900/95 backdrop-blur">
      <header className="flex items-center justify-between border-b border-white/10 p-3">
        <h3 className="font-display text-lg font-extrabold text-gold-300">🗼 Teleport to a landmark</h3>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 px-2 text-sm font-black text-white/70 hover:bg-coral-500/40"
          aria-label="Close teleport menu"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {landmarks.length === 0 && (
          <p className="p-3 text-sm font-semibold text-white/45">
            No landmark data available for this country.
          </p>
        )}
        {landmarks.map((l) => {
          const disabled = photoModeOnly && !l.imageUrl;
          return (
            <button
              key={l.qid}
              disabled={disabled}
              onClick={() => onPick(l)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition enabled:hover:bg-white/8 disabled:opacity-35"
              title={disabled ? 'No photo available for this one' : `Teleport to ${l.name}`}
            >
              {l.imageUrl ? (
                <img src={l.imageUrl} alt="" loading="lazy" className="h-12 w-16 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-dusk-700 text-xl">🗿</div>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/85">{l.name}</span>
              <span aria-hidden>→</span>
            </button>
          );
        })}
      </div>
      <p className="border-t border-white/10 p-2 text-center text-[10px] font-semibold text-white/35">
        Landmarks live from Wikidata · photos from Wikimedia Commons
      </p>
    </div>
  );
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 animate-pop-in rounded-2xl border border-amber-glow/40 bg-dusk-900/95 px-5 py-2.5 text-sm font-extrabold text-gold-300 shadow-xl">
      {msg}
    </div>
  );
}

/** White flash + fade used for spawning/teleporting and the camera shutter. */
function Flash({ trigger, color = 'bg-white' }: { trigger: number; color?: string }) {
  if (!trigger) return null;
  return <div key={trigger} className={`pointer-events-none absolute inset-0 z-40 ${color} teleport-flash`} />;
}

// ─── STREET MODE (real Google Street View) ───────────────────────────────────

function StreetCore({
  country,
  spawn,
  onNoCoverage,
}: {
  country: Country;
  spawn: Spawn;
  onNoCoverage: () => void;
}) {
  const exitCountry = useGame((s) => s.exitCountry);
  const panoRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);
  const panoObj = useRef<google.maps.StreetViewPanorama | null>(null);
  const mapObj = useRef<google.maps.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [placeLabel, setPlaceLabel] = useState(spawn.label);
  const [tpp, setTpp] = useState(false);
  const [mapBig, setMapBig] = useState(false);
  const [teleportOpen, setTeleportOpen] = useState(false);
  const [spawnFlash, setSpawnFlash] = useState(0);
  const keysDown = useRef<Set<string>>(new Set());
  const lastStep = useRef(0);
  const { capture, capturing, flash, toast, setToast } = useCapture(country);

  // boot the panorama + mini-map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        const data = await findPanorama(spawn.lat, spawn.lng);
        if (cancelled) return;
        if (!data?.location?.pano) {
          onNoCoverage();
          return;
        }
        const pano = new google.maps.StreetViewPanorama(panoRef.current!, {
          pano: data.location.pano,
          pov: { heading: 0, pitch: 0 },
          addressControl: false,
          linksControl: false,
          panControl: false,
          zoomControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
          showRoadLabels: true,
          clickToGo: true,
        });
        panoObj.current = pano;
        const map = new google.maps.Map(miniRef.current!, {
          center: data.location.latLng ?? { lat: spawn.lat, lng: spawn.lng },
          zoom: 15,
          disableDefaultUI: true,
          keyboardShortcuts: false,
          clickableIcons: false,
        });
        map.setStreetView(pano); // pegman follows the player
        mapObj.current = map;
        pano.addListener('position_changed', () => {
          const p = pano.getPosition();
          if (p) map.setCenter(p);
        });
        pano.addListener('pano_changed', () => {
          const loc = pano.getLocation();
          setPlaceLabel(loc?.shortDescription || loc?.description || spawn.label);
        });
        setStatus('ready');
        setSpawnFlash((f) => f + 1);
        sfx.whoosh();
      } catch (err) {
        console.warn('Street View boot failed:', err);
        if (!cancelled) onNoCoverage();
      }
    })();
    return () => {
      cancelled = true;
      panoObj.current = null;
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WASD movement / A-D turning / R run
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      keysDown.current.add(k);
      if (k === 'v') setTpp((t) => !t);
      if (k === 'c') void doCaptureRef.current();
      if (k === 'm') setMapBig((b) => !b);
      if (k === 'escape') exitCountry();
    };
    const up = (e: KeyboardEvent) => keysDown.current.delete(e.key.toLowerCase());
    const clear = () => keysDown.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);

    const iv = setInterval(() => {
      const pano = panoObj.current;
      if (!pano) return;
      const keys = keysDown.current;
      const pov = pano.getPov();
      if (keys.has('a')) pano.setPov({ ...pov, heading: (pov.heading - 4.2 + 360) % 360 });
      if (keys.has('d')) pano.setPov({ ...pov, heading: (pov.heading + 4.2) % 360 });

      let dir: number | null = null;
      if (keys.has('w') || keys.has('arrowup')) dir = 0;
      else if (keys.has('s') || keys.has('arrowdown')) dir = 180;
      if (dir === null) return;
      const run = keys.has('r') || keys.has('shift');
      const cooldown = run ? 240 : 640;
      const now = Date.now();
      if (now - lastStep.current < cooldown) return;

      const links = pano.getLinks() ?? [];
      const target = (pov.heading + dir + 360) % 360;
      let best: google.maps.StreetViewLink | null = null;
      let bestDelta = 361;
      for (const link of links) {
        if (!link?.pano || link.heading == null) continue;
        const delta = Math.abs(((((link.heading - target) % 360) + 540) % 360) - 180);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = link;
        }
      }
      if (best && bestDelta <= 80) {
        lastStep.current = now;
        pano.setPano(best.pano!);
        // walking forward: gently align the camera with the path
        if (dir === 0 && bestDelta > 20) {
          pano.setPov({ ...pov, heading: best.heading! });
        }
        sfx.step();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = useCallback(async () => {
    const pano = panoObj.current;
    if (!pano || !mapsKey) return;
    const panoId = pano.getPano();
    const pov = pano.getPov();
    const zoom = pano.getZoom() ?? 1;
    const fov = Math.min(120, Math.max(15, 180 / 2 ** zoom));
    const url =
      `https://maps.googleapis.com/maps/api/streetview?size=640x400&pano=${encodeURIComponent(panoId)}` +
      `&heading=${pov.heading.toFixed(1)}&pitch=${pov.pitch.toFixed(1)}&fov=${fov.toFixed(0)}&key=${mapsKey}`;
    // read the label straight from the panorama — the keydown handler holds a
    // stale closure, so state would lag behind the player's real position
    const loc = pano.getLocation();
    await capture(url, loc?.shortDescription || loc?.description || spawn.label);
  }, [capture, spawn.label]);
  const doCaptureRef = useRef(doCapture);
  doCaptureRef.current = doCapture;

  const teleportTo = useCallback(
    async (l: Landmark) => {
      const pano = panoObj.current;
      if (!pano) return;
      setTeleportOpen(false);
      sfx.whoosh();
      setSpawnFlash((f) => f + 1);
      const data = await findPanorama(l.lat, l.lng, [300, 2_000, 10_000]);
      if (data?.location?.pano) {
        pano.setPano(data.location.pano);
        setToast(`🛬 Teleported to ${l.name}!`);
      } else {
        setToast(`😕 No Street View imagery near ${l.name}.`);
      }
    },
    [setToast],
  );

  return (
    <div className="absolute inset-0 z-40 bg-dusk-950">
      <div ref={panoRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-dusk-950">
          <div className="animate-float text-7xl" aria-hidden>🛸</div>
          <p className="font-display text-xl font-extrabold text-gold-300">
            Finding a landing spot in {spawn.label}…
          </p>
        </div>
      )}

      {/* top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <ExitButton />
          <div className="rounded-full bg-dusk-950/80 px-4 py-2 text-sm font-extrabold text-gold-300 backdrop-blur">
            {country.flagEmoji} {country.name} · <span className="text-white/80">{placeLabel}</span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => {
              sfx.click();
              setTpp((t) => !t);
            }}
            className="rounded-full bg-dusk-950/80 px-3 py-2 text-xs font-extrabold text-white/80 backdrop-blur transition hover:text-white"
            title="Toggle first/third person (V)"
          >
            {tpp ? '👁️ FPP' : '🧍 TPP'}
          </button>
          <button
            onClick={() => {
              sfx.click();
              setTeleportOpen((o) => !o);
            }}
            className="rounded-full bg-dusk-950/80 px-3 py-2 text-xs font-extrabold text-white/80 backdrop-blur transition hover:text-white"
          >
            🗼 Teleport
          </button>
        </div>
      </div>

      {/* mini-map (top-left, under the HUD row) */}
      <div
        className={`absolute left-3 top-16 z-20 overflow-hidden rounded-2xl border-2 border-amber-glow/50 shadow-xl transition-all ${
          mapBig ? 'h-80 w-105' : 'h-44 w-44'
        }`}
      >
        <div ref={miniRef} className="h-full w-full" />
        <button
          onClick={() => {
            sfx.click();
            setMapBig((b) => !b);
          }}
          className="absolute bottom-1.5 right-1.5 rounded-lg bg-dusk-950/85 px-2 py-1 text-[11px] font-extrabold text-gold-300"
          title="Expand map (M)"
        >
          {mapBig ? '🗺️ Shrink' : '🗺️ Map'}
        </button>
      </div>

      {tpp && <TppAvatar />}

      {/* bottom HUD */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-4">
        <CameraBar onShutter={() => void doCapture()} capturing={capturing} />
        <div className="rounded-full bg-dusk-950/75 px-4 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur">
          <kbd className="text-amber-glow">WASD</kbd> walk · hold <kbd className="text-amber-glow">R</kbd> to run ·
          drag to look · <kbd className="text-amber-glow">V</kbd> view · <kbd className="text-amber-glow">C</kbd>{' '}
          capture · <kbd className="text-amber-glow">M</kbd> map
        </div>
      </div>

      {/* honest imagery label */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-lg bg-dusk-950/80 px-2.5 py-1 text-[10px] font-bold text-white/55">
        🟢 Live Google Street View — real imagery © Google
      </div>

      {teleportOpen && (
        <TeleportDrawer
          landmarks={spawn.landmarks}
          onPick={(l) => void teleportTo(l)}
          onClose={() => setTeleportOpen(false)}
          photoModeOnly={false}
        />
      )}
      <Toast msg={toast} />
      <Flash trigger={spawnFlash} color="bg-gold-300" />
      <Flash trigger={flash} />
    </div>
  );
}

// ─── PHOTO MODE (no key / no coverage): real Wikimedia landmark photos ───────

function bigThumb(url: string): string {
  return url.replace('width=640', 'width=1280');
}

function MiniShape({ country, lat, lng }: { country: Country; lat?: number; lng?: number }) {
  const shape = useMemo(() => {
    const f = WORLD_FEATURES.find((w) => countryOfFeature(w)?.cca3 === country.cca3);
    if (!f) return null;
    const projection = geoMercator().fitExtent(
      [
        [10, 10],
        [166, 166],
      ],
      f as never,
    );
    const d = geoPath(projection)(f as never) ?? '';
    const pt = lat != null && lng != null ? projection([lng, lat]) : null;
    return { d, pt };
  }, [country.cca3, lat, lng]);
  if (!shape) return null;
  return (
    <svg viewBox="0 0 176 176" className="h-full w-full">
      <path d={shape.d} fill="rgba(255,179,71,0.25)" stroke="#ffb347" strokeWidth="1.2" />
      {shape.pt && Number.isFinite(shape.pt[0]) && (
        <circle cx={shape.pt[0]} cy={shape.pt[1]} r="5" fill="#ff6b57" stroke="#fff" strokeWidth="1.5">
          <animate attributeName="r" values="4;6;4" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

function PhotoExplore({
  country,
  spawn,
  noCoverage,
}: {
  country: Country;
  spawn: Spawn;
  noCoverage: boolean;
}) {
  const exitCountry = useGame((s) => s.exitCountry);
  const withImages = useMemo(() => spawn.landmarks.filter((l) => l.imageUrl), [spawn.landmarks]);
  const [idx, setIdx] = useState(0);
  const [tpp, setTpp] = useState(false);
  const [teleportOpen, setTeleportOpen] = useState(false);
  const [spawnFlash, setSpawnFlash] = useState(1);
  const { capture, capturing, flash, toast, setToast } = useCapture(country);
  const current = withImages.length > 0 ? withImages[idx % withImages.length] : null;

  const move = useCallback(
    (delta: number) => {
      if (withImages.length === 0) return;
      setIdx((i) => (i + delta + withImages.length) % withImages.length);
      setSpawnFlash((f) => f + 1);
      sfx.step();
    },
    [withImages.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft' || k === 's') move(-1);
      if (k === 'd' || k === 'arrowright' || k === 'w') move(1);
      if (k === 'v') setTpp((t) => !t);
      if (k === 'c' && current) void capture(bigThumb(current.imageUrl!), current.name);
      if (k === 'escape') exitCountry();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, current, capture, exitCountry]);

  useEffect(() => {
    sfx.whoosh();
  }, []);

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-dusk-950">
      {current ? (
        <img
          key={current.qid}
          src={bigThumb(current.imageUrl!)}
          alt={`${current.name} — real photo from Wikimedia Commons`}
          className="h-full w-full animate-fade-in object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <img src={country.flagPng} alt="" className="w-28 rounded-lg shadow-lg" />
          <p className="max-w-md font-display text-2xl font-extrabold text-gold-300">
            No landmark photos available for {country.name} yet
          </p>
          <p className="max-w-md text-sm font-semibold text-white/55">
            Wikidata has no photographed landmarks on file here. Try another country — the world is big!
          </p>
          <ExitButton />
        </div>
      )}

      {current && (
        <>
          {/* top HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
            <div className="pointer-events-auto flex items-center gap-2">
              <ExitButton />
              <div className="rounded-full bg-dusk-950/80 px-4 py-2 text-sm font-extrabold text-gold-300 backdrop-blur">
                {country.flagEmoji} {country.name} · <span className="text-white/80">{current.name}</span>
              </div>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => {
                  sfx.click();
                  setTpp((t) => !t);
                }}
                className="rounded-full bg-dusk-950/80 px-3 py-2 text-xs font-extrabold text-white/80 backdrop-blur"
                title="Toggle first/third person (V)"
              >
                {tpp ? '👁️ FPP' : '🧍 TPP'}
              </button>
              <button
                onClick={() => {
                  sfx.click();
                  setTeleportOpen((o) => !o);
                }}
                className="rounded-full bg-dusk-950/80 px-3 py-2 text-xs font-extrabold text-white/80 backdrop-blur"
              >
                🗼 Teleport
              </button>
            </div>
          </div>

          {/* mini country-shape map */}
          <div className="absolute left-3 top-16 z-20 h-44 w-44 overflow-hidden rounded-2xl border-2 border-amber-glow/50 bg-dusk-900/90 shadow-xl">
            <MiniShape country={country} lat={current.lat} lng={current.lng} />
            <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-bold text-white/45">
              {country.name}
            </span>
          </div>

          {/* nav arrows */}
          <button
            onClick={() => move(-1)}
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-dusk-950/70 px-4 py-3 text-2xl font-black text-white/80 backdrop-blur transition hover:bg-dusk-950"
            aria-label="Previous landmark"
          >
            ←
          </button>
          <button
            onClick={() => move(1)}
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-dusk-950/70 px-4 py-3 text-2xl font-black text-white/80 backdrop-blur transition hover:bg-dusk-950"
            aria-label="Next landmark"
          >
            →
          </button>

          {tpp && <TppAvatar />}

          {/* bottom HUD */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 p-4">
            <CameraBar
              onShutter={() => current && void capture(bigThumb(current.imageUrl!), current.name)}
              capturing={capturing}
            />
            <div className="rounded-full bg-dusk-950/75 px-4 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur">
              <kbd className="text-amber-glow">A</kbd>/<kbd className="text-amber-glow">D</kbd> wander between
              landmarks · <kbd className="text-amber-glow">C</kbd> capture ·{' '}
              {withImages.length} places · {idx + 1} of {withImages.length}
            </div>
          </div>
        </>
      )}

      {/* honest mode banner */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 max-w-72 rounded-lg bg-dusk-950/85 px-2.5 py-1.5 text-[10px] font-bold leading-4 text-white/60">
        🖼️ Photo exploration — real photos from Wikimedia Commons.{' '}
        {noCoverage
          ? 'No Street View coverage was found near the spawn point.'
          : 'Add VITE_GOOGLE_MAPS_API_KEY to unlock live Street View.'}
      </div>

      {teleportOpen && (
        <TeleportDrawer
          landmarks={withImages}
          onPick={(l) => {
            const i = withImages.indexOf(l);
            if (i >= 0) {
              setIdx(i);
              setSpawnFlash((f) => f + 1);
              sfx.whoosh();
              setToast(`🛬 Teleported to ${l.name}!`);
            }
            setTeleportOpen(false);
          }}
          onClose={() => setTeleportOpen(false)}
          photoModeOnly
        />
      )}
      <Toast msg={toast} />
      <Flash trigger={spawnFlash} color="bg-gold-300" />
      <Flash trigger={flash} />
    </div>
  );
}

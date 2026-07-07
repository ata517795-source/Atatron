import { useEffect, useRef } from 'react';
import { useGame, PHOTO_GOAL } from '../store/gameStore';
import { sfx } from '../lib/sfx';

const CONFETTI_COLORS = ['#ff6b57', '#ffb347', '#ffd166', '#7de3a0', '#7db8ff', '#c78bff', '#ff8fd0'];

function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', onResize);

    const parts = Array.from({ length: 160 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h,
      vy: 1.6 + Math.random() * 2.6,
      vx: -1 + Math.random() * 2,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.y / 40);
        p.rot += p.vr;
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

export function Celebration() {
  const setCelebrationOpen = useGame((s) => s.setCelebrationOpen);
  const setAlbumOpen = useGame((s) => s.setAlbumOpen);
  const photos = useGame((s) => s.photos);
  const visited = useGame((s) => s.visited);
  const player = useGame((s) => s.player);

  useEffect(() => {
    sfx.fanfare();
    const again = setTimeout(() => sfx.fanfare(), 1600);
    return () => clearTimeout(again);
  }, []);

  return (
    <div className="absolute inset-0 z-60 flex items-center justify-center bg-ink-950/92 backdrop-blur">
      <ConfettiCanvas />
      <div className="relative z-10 mx-4 max-w-xl animate-pop-in rounded-3xl border border-gold-400/40 bg-ink-900/95 p-10 text-center shadow-[0_0_120px_rgba(255,209,102,0.35)]">
        <div className="text-7xl" aria-hidden>🏆</div>
        <h2 className="mt-3 font-display text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-clay-300 to-gold-400">
          You've seen the world!
        </h2>
        <p className="mt-4 text-lg font-bold text-white/85">
          {player?.nickname ?? 'Explorer'}, you filled your album with{' '}
          <span className="text-gold-300">{photos.length} photos</span> across{' '}
          <span className="text-gold-300">{visited.length} {visited.length === 1 ? 'country' : 'countries'}</span>!
          🌍✨
        </p>
        <p className="mt-2 text-sm font-semibold text-white/55">
          Goal complete: {PHOTO_GOAL} real snapshots of our beautiful planet. The world is officially yours.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <button
            onClick={() => {
              setCelebrationOpen(false);
              setAlbumOpen(true);
            }}
            className="rounded-2xl bg-gradient-to-r from-clay-500 to-gold-400 px-6 py-3 font-display text-lg font-extrabold text-ink-950 shadow-lg transition hover:scale-105"
          >
            📸 See your album
          </button>
          <button
            onClick={() => setCelebrationOpen(false)}
            className="rounded-2xl bg-ink-700 px-6 py-3 font-display text-lg font-extrabold text-white/85 transition hover:bg-ink-600"
          >
            Keep exploring 🌏
          </button>
        </div>
      </div>
    </div>
  );
}

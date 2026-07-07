import { useGame } from '../store/gameStore';

export function Album() {
  const setAlbumOpen = useGame((s) => s.setAlbumOpen);
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-dusk-950/95">
      <p className="text-white/70">Photo album — coming in the next build step</p>
      <button
        onClick={() => setAlbumOpen(false)}
        className="rounded-full bg-coral-500 px-5 py-2 font-extrabold text-dusk-950"
      >
        Close
      </button>
    </div>
  );
}

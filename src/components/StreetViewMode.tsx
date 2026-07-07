import { useGame } from '../store/gameStore';
import { byCca3 } from '../lib/countries';

export function StreetViewMode({ cca3 }: { cca3: string }) {
  const exitCountry = useGame((s) => s.exitCountry);
  const country = byCca3.get(cca3);
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-dusk-950/95">
      <p className="text-white/70">Street View mode for {country?.name} — coming in the next build step</p>
      <button
        onClick={exitCountry}
        className="rounded-full bg-coral-500 px-5 py-2 font-extrabold text-dusk-950"
      >
        ← Back to the world
      </button>
    </div>
  );
}

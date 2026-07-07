import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'globe' | 'flat' | 'astro';
export type CameraStyle = 'modern' | 'vintage' | 'retro';

export interface Player {
  id: string;
  nickname: string;
  avatarId: string;
}

export interface PhotoMeta {
  id: string;
  country: string;
  cca2: string;
  place: string;
  style: CameraStyle;
  takenAt: number;
}

export const PHOTO_GOAL = 50;

interface GameState {
  player: Player | null;
  viewMode: ViewMode;
  selectedCca3: string | null;
  insideCca3: string | null;
  photos: PhotoMeta[];
  visited: string[]; // cca3 of countries entered
  albumOpen: boolean;
  explorersOpen: boolean;
  celebrated: boolean;
  celebrationOpen: boolean;
  cameraStyle: CameraStyle;
  soundOn: boolean;

  setPlayer: (p: Player) => void;
  signOut: () => void;
  setViewMode: (v: ViewMode) => void;
  selectCountry: (cca3: string | null) => void;
  enterCountry: (cca3: string) => void;
  exitCountry: () => void;
  addPhoto: (meta: PhotoMeta) => void;
  removePhoto: (id: string) => void;
  setAlbumOpen: (open: boolean) => void;
  setExplorersOpen: (open: boolean) => void;
  setCelebrationOpen: (open: boolean) => void;
  setCameraStyle: (s: CameraStyle) => void;
  toggleSound: () => void;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      player: null,
      viewMode: 'globe',
      selectedCca3: null,
      insideCca3: null,
      photos: [],
      visited: [],
      albumOpen: false,
      explorersOpen: false,
      celebrated: false,
      celebrationOpen: false,
      cameraStyle: 'modern',
      soundOn: true,

      setPlayer: (player) => set({ player }),
      signOut: () => set({ player: null, insideCca3: null, selectedCca3: null }),
      setViewMode: (viewMode) => set({ viewMode }),
      selectCountry: (selectedCca3) => set({ selectedCca3 }),
      enterCountry: (cca3) =>
        set((s) => ({
          insideCca3: cca3,
          visited: s.visited.includes(cca3) ? s.visited : [...s.visited, cca3],
        })),
      exitCountry: () => set({ insideCca3: null }),
      addPhoto: (meta) => {
        const next = [meta, ...get().photos];
        const reachedGoal = next.length >= PHOTO_GOAL && !get().celebrated;
        set({
          photos: next,
          ...(reachedGoal ? { celebrated: true, celebrationOpen: true } : {}),
        });
      },
      removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
      setAlbumOpen: (albumOpen) => set({ albumOpen }),
      setExplorersOpen: (explorersOpen) => set({ explorersOpen }),
      setCelebrationOpen: (celebrationOpen) => set({ celebrationOpen }),
      setCameraStyle: (cameraStyle) => set({ cameraStyle }),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
    }),
    {
      name: 'wanderworld',
      partialize: (s) => ({
        player: s.player,
        photos: s.photos,
        visited: s.visited,
        celebrated: s.celebrated,
        viewMode: s.viewMode,
        cameraStyle: s.cameraStyle,
        soundOn: s.soundOn,
      }),
    },
  ),
);

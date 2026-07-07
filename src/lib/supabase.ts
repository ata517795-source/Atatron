/**
 * Optional Supabase integration — a shared "Explorers" list + photo leaderboard.
 * Entirely guarded behind env vars: without VITE_SUPABASE_URL/ANON_KEY every
 * function is a silent no-op and the app runs fully local.
 *
 * Expected table (see README for the SQL):
 *   explorers(id uuid pk, nickname text, avatar_id text,
 *             photos_count int, countries_count int, updated_at timestamptz)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Player } from '../store/gameStore';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
if (url && anonKey) {
  try {
    client = createClient(url, anonKey);
  } catch (err) {
    console.warn('Supabase disabled (bad config):', err);
  }
}

export const supabaseEnabled = client !== null;

export interface ExplorerRow {
  id: string;
  nickname: string;
  avatar_id: string;
  photos_count: number;
  countries_count: number;
  updated_at: string;
}

export async function registerExplorer(player: Player): Promise<void> {
  if (!client) return;
  try {
    await client.from('explorers').upsert({
      id: player.id,
      nickname: player.nickname,
      avatar_id: player.avatarId,
      photos_count: 0,
      countries_count: 0,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase registerExplorer failed:', err);
  }
}

export async function syncProgress(
  player: Player,
  photosCount: number,
  countriesCount: number,
): Promise<void> {
  if (!client) return;
  try {
    await client.from('explorers').upsert({
      id: player.id,
      nickname: player.nickname,
      avatar_id: player.avatarId,
      photos_count: photosCount,
      countries_count: countriesCount,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Supabase syncProgress failed:', err);
  }
}

export async function fetchExplorers(): Promise<ExplorerRow[] | null> {
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('explorers')
      .select('*')
      .order('photos_count', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data as ExplorerRow[];
  } catch (err) {
    console.warn('Supabase fetchExplorers failed:', err);
    return null;
  }
}

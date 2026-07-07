/**
 * Camera pipeline: draws a real source image (Street View Static frame or a
 * Wikimedia Commons landmark photo) onto a canvas, applies the chosen camera
 * style with real canvas filters, frames it like a polaroid and stores the
 * result in IndexedDB.
 */
import { del, get, set } from 'idb-keyval';
import type { CameraStyle, PhotoMeta } from '../store/gameStore';

export const CAMERA_STYLES: Record<
  CameraStyle,
  { label: string; emoji: string; filter: string; paper: string; vignette: boolean }
> = {
  modern: {
    label: 'Modern HD',
    emoji: '📱',
    filter: 'saturate(1.28) contrast(1.08) brightness(1.03)',
    paper: '#ffffff',
    vignette: false,
  },
  vintage: {
    label: 'Vintage',
    emoji: '🎞️',
    filter: 'sepia(0.62) contrast(1.05) brightness(1.06) saturate(1.25)',
    paper: '#f7efdc',
    vignette: true,
  },
  retro: {
    label: 'Retro B&W',
    emoji: '📷',
    filter: 'grayscale(1) contrast(1.3) brightness(1.05)',
    paper: '#f2f2ef',
    vignette: true,
  },
};

const PHOTO_W = 640;
const PHOTO_H = 400;
const BORDER = 26;
const CAPTION_H = 78;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed to load: ${url.slice(0, 80)}`));
    img.src = url;
  });
}

export interface CaptureInput {
  srcUrl: string;
  country: string;
  flagEmoji: string;
  place: string;
  style: CameraStyle;
}

/** Compose the framed, filtered photo. Returns a JPEG data URL. */
export async function composePhoto(input: CaptureInput): Promise<{ id: string; dataUrl: string }> {
  const img = await loadImage(input.srcUrl);
  const styleDef = CAMERA_STYLES[input.style];

  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_W + BORDER * 2;
  canvas.height = PHOTO_H + BORDER + CAPTION_H;
  const ctx = canvas.getContext('2d')!;

  // polaroid paper
  ctx.fillStyle = styleDef.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // cover-crop the source into the photo area, with the style's real filter
  const scale = Math.max(PHOTO_W / img.width, PHOTO_H / img.height);
  const sw = PHOTO_W / scale;
  const sh = PHOTO_H / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.save();
  ctx.filter = styleDef.filter;
  ctx.drawImage(img, sx, sy, sw, sh, BORDER, BORDER, PHOTO_W, PHOTO_H);
  ctx.restore();

  if (styleDef.vignette) {
    const g = ctx.createRadialGradient(
      BORDER + PHOTO_W / 2, BORDER + PHOTO_H / 2, PHOTO_H * 0.42,
      BORDER + PHOTO_W / 2, BORDER + PHOTO_H / 2, PHOTO_H * 0.85,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30,15,5,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(BORDER, BORDER, PHOTO_W, PHOTO_H);
  }

  // caption
  const capY = BORDER + PHOTO_H;
  ctx.fillStyle = '#2c2418';
  ctx.font = '800 24px Nunito, sans-serif';
  const place = input.place.length > 38 ? `${input.place.slice(0, 37)}…` : input.place;
  ctx.fillText(place, BORDER + 2, capY + 34);
  ctx.font = '600 15px Nunito, sans-serif';
  ctx.fillStyle = '#6b5d49';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  ctx.fillText(`${input.flagEmoji} ${input.country} · ${date}`, BORDER + 2, capY + 58);
  ctx.textAlign = 'right';
  ctx.font = '700 14px Nunito, sans-serif';
  ctx.fillStyle = '#b0a288';
  ctx.fillText('🌍 Wanderworld', canvas.width - BORDER, capY + 58);
  ctx.textAlign = 'left';

  const id = crypto.randomUUID();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.87);
  await set(`photo:${id}`, dataUrl);
  return { id, dataUrl };
}

export function loadPhotoData(id: string): Promise<string | undefined> {
  return get<string>(`photo:${id}`);
}

export function deletePhotoData(id: string): Promise<void> {
  return del(`photo:${id}`);
}

export function photoFileName(meta: PhotoMeta): string {
  const place = meta.place.replace(/[^\w]+/g, '-').slice(0, 40);
  return `wanderworld-${meta.cca2.toLowerCase()}-${place}-${meta.id.slice(0, 6)}.jpg`;
}

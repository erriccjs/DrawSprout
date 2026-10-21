/** A few dominant colours from a photo, ignoring a near-white background. */

import type { RgbaImage } from './png';

export function dominantColors(image: RgbaImage, count = 4): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(Math.sqrt(image.width * image.height) / 90));
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i] ?? 0;
      const g = image.data[i + 1] ?? 0;
      const b = image.data[i + 2] ?? 0;
      const a = image.data[i + 3] ?? 255;
      if (a < 128) continue;
      if (0.2126 * r + 0.7152 * g + 0.0722 * b > 242) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const ranked = [...buckets.values()].sort((left, right) => right.n - left.n).slice(0, count);
  if (ranked.length === 0) return ['#e8552d'];
  return ranked.map((bucket) => hex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n));
}

export function sampleColor(image: RgbaImage, nx: number, ny: number): string {
  const x = clamp(Math.round(nx * (image.width - 1)), 0, image.width - 1);
  const y = clamp(Math.round(ny * (image.height - 1)), 0, image.height - 1);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const sx = clamp(x + dx, 0, image.width - 1);
      const sy = clamp(y + dy, 0, image.height - 1);
      const i = (sy * image.width + sx) * 4;
      r += image.data[i] ?? 0;
      g += image.data[i + 1] ?? 0;
      b += image.data[i + 2] ?? 0;
      n += 1;
    }
  }
  return hex(r / n, g / n, b / n);
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Average of the non-white pixels around a normalised point. White is background. */
export function sampleRegionRgb(image: RgbaImage, nx: number, ny: number): Rgb | null {
  const reach = 0.04;
  let r = 0;
  let g = 0;
  let b = 0;
  let coloured = 0;
  let seen = 0;
  for (let gy = 0; gy < 5; gy += 1) {
    for (let gx = 0; gx < 5; gx += 1) {
      const sx = clamp(Math.round((nx + ((gx - 2) * reach) / 2) * (image.width - 1)), 0, image.width - 1);
      const sy = clamp(Math.round((ny + ((gy - 2) * reach) / 2) * (image.height - 1)), 0, image.height - 1);
      const index = (sy * image.width + sx) * 4;
      const pr = image.data[index] ?? 0;
      const pg = image.data[index + 1] ?? 0;
      const pb = image.data[index + 2] ?? 0;
      const pa = image.data[index + 3] ?? 255;
      seen += 1;
      if (pa < 128) continue;
      if (0.2126 * pr + 0.7152 * pg + 0.0722 * pb > 242) continue;
      r += pr;
      g += pg;
      b += pb;
      coloured += 1;
    }
  }
  if (coloured < 3 || coloured / seen < 0.2) return null;
  return { r: r / coloured, g: g / coloured, b: b / coloured };
}

export function rgbToHex(rgb: Rgb): string {
  return hex(rgb.r, rgb.g, rgb.b);
}

export function rgbDistance(left: Rgb, right: Rgb): number {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

const COLOUR_WORDS = ['merah muda', 'abu-abu', 'merah', 'oranye', 'jingga', 'kuning', 'hijau', 'biru', 'ungu', 'cokelat tua', 'cokelat', 'coklat', 'hitam', 'putih', 'krem', 'pink'] as const;

/** A colour word the model may use. Unknown text returns null. */
export function knownColourName(text: string): string | null {
  const lower = text.toLowerCase();
  for (const name of COLOUR_WORDS) {
    if (!lower.includes(name)) continue;
    if (name === 'jingga' || name === 'krem') return 'oranye';
    if (name === 'coklat') return 'cokelat';
    if (name === 'pink') return 'merah muda';
    return name;
  }
  return null;
}

/** Indonesian name for a sampled colour, so a step can say "dengan oranye". */
export function indonesianColourName(rgb: Rgb): string {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.16) {
    if (lum >= 168) return 'putih';
    if (lum < 48) return 'hitam';
    return 'abu-abu';
  }
  if (lum < 48 && sat < 0.22) return 'hitam';
  const delta = max - min || 1;
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  let hue = sector * 60;
  if (hue < 0) hue += 360;
  if (hue >= 8 && hue < 50 && lum < 100) return 'cokelat';
  if (hue < 15 || hue >= 345) return 'merah';
  if (hue < 45) return 'oranye';
  if (hue < 70) return 'kuning';
  if (hue < 170) return 'hijau';
  if (hue < 255) return 'biru';
  if (hue < 320) return 'ungu';
  return lum > 155 ? 'merah muda' : 'merah';
}

export interface ColourCluster {
  readonly name: string;
  readonly rgb: Rgb;
  readonly share: number;
}

const REGION_GRID = 48;

/**
 * Colours inside a normalised mask. Near-white subject pixels stay `putih`.
 * A small saturated patch (a red collar) is kept; a small grey patch is not.
 */
export function coloursInRegion(
  image: RgbaImage,
  inside: (nx: number, ny: number) => boolean,
): ColourCluster[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let gy = 0; gy < REGION_GRID; gy += 1) {
    for (let gx = 0; gx < REGION_GRID; gx += 1) {
      const nx = (gx + 0.5) / REGION_GRID;
      const ny = (gy + 0.5) / REGION_GRID;
      if (!inside(nx, ny)) continue;
      const rgb = opaquePixel(image, nx, ny);
      if (!rgb) continue;
      const name = indonesianColourName(rgb);
      const bucket = buckets.get(name) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n += 1;
      bucket.r += rgb.r;
      bucket.g += rgb.g;
      bucket.b += rgb.b;
      buckets.set(name, bucket);
      total += 1;
    }
  }
  if (total === 0) return [];
  const clusters: ColourCluster[] = [];
  for (const [name, bucket] of buckets) {
    const share = bucket.n / total;
    const saturated = name !== 'putih' && name !== 'abu-abu' && name !== 'hitam';
    if (share < 0.12 && !(saturated && share >= 0.05)) continue;
    clusters.push({
      name,
      rgb: { r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n },
      share,
    });
  }
  return clusters.sort((left, right) => right.share - left.share);
}

const FRAME_GRID = 36;

/**
 * Colours that sit on the photo's frame and not in the middle.
 * Grass and sky match this. A white cup does not: its centre is white too.
 */
export function backgroundColours(image: RgbaImage): ReadonlySet<string> {
  const border = new Map<string, number>();
  const centre = new Map<string, number>();
  let borderTotal = 0;
  let centreTotal = 0;
  for (let gy = 0; gy < FRAME_GRID; gy += 1) {
    for (let gx = 0; gx < FRAME_GRID; gx += 1) {
      const nx = (gx + 0.5) / FRAME_GRID;
      const ny = (gy + 0.5) / FRAME_GRID;
      const onBorder = nx < 0.08 || nx > 0.92 || ny < 0.08 || ny > 0.92;
      const inCentre = nx >= 0.28 && nx <= 0.72 && ny >= 0.28 && ny <= 0.72;
      if (!onBorder && !inCentre) continue;
      const rgb = opaquePixel(image, nx, ny);
      if (!rgb) continue;
      const name = indonesianColourName(rgb);
      if (onBorder) {
        border.set(name, (border.get(name) ?? 0) + 1);
        borderTotal += 1;
      }
      if (inCentre) {
        centre.set(name, (centre.get(name) ?? 0) + 1);
        centreTotal += 1;
      }
    }
  }
  const names = new Set<string>();
  if (borderTotal === 0) return names;
  for (const [name, count] of border) {
    const borderShare = count / borderTotal;
    const centreShare = centreTotal === 0 ? 0 : (centre.get(name) ?? 0) / centreTotal;
    if (borderShare >= 0.22 && centreShare < 0.12) names.add(name);
  }
  return names;
}

/** An all-white frame is a blank plate, not a white object. */
export function photoIsBlankPlate(image: RgbaImage): boolean {
  const step = Math.max(1, Math.floor(Math.sqrt(image.width * image.height) / 80));
  let seen = 0;
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const index = (y * image.width + x) * 4;
      if ((image.data[index + 3] ?? 255) < 128) continue;
      seen += 1;
      const rgb = {
        r: image.data[index] ?? 0,
        g: image.data[index + 1] ?? 0,
        b: image.data[index + 2] ?? 0,
      };
      if (indonesianColourName(rgb) !== 'putih') return false;
    }
  }
  return seen > 0;
}

const COLOUR_HEX: Readonly<Record<string, string>> = {
  merah: '#d23b3b',
  oranye: '#e07020',
  kuning: '#e2c04a',
  hijau: '#3aaa55',
  biru: '#3a6fd0',
  ungu: '#7a4bb5',
  'merah muda': '#e07098',
  cokelat: '#8a5a32',
  'cokelat tua': '#4a2c16',
  hitam: '#2a2a2a',
  'abu-abu': '#8a8a8a',
  putih: '#ffffff',
};

export function colourHex(name: string): string {
  return COLOUR_HEX[name] ?? '#e07020';
}

export function nearestColor(color: string, palette: readonly string[]): string {
  const rgb = parseHex(color);
  let best = palette[0] ?? '#e8552d';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const other = parseHex(candidate);
    const distance = (rgb.r - other.r) ** 2 + (rgb.g - other.g) ** 2 + (rgb.b - other.b) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function hex(r: number, g: number, b: number): string {
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function byte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function parseHex(color: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

function opaquePixel(image: RgbaImage, nx: number, ny: number): Rgb | null {
  const x = clamp(Math.round(nx * (image.width - 1)), 0, image.width - 1);
  const y = clamp(Math.round(ny * (image.height - 1)), 0, image.height - 1);
  const index = (y * image.width + x) * 4;
  if ((image.data[index + 3] ?? 255) < 128) return null;
  return {
    r: image.data[index] ?? 0,
    g: image.data[index + 1] ?? 0,
    b: image.data[index + 2] ?? 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

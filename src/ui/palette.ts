/** A small, high-contrast palette; names matter for colour-blind users. */
export const PALETTE = [
  { color: '#3a3a3a', label: 'Hitam' },
  { color: '#e8552d', label: 'Merah' },
  { color: '#e8a33d', label: 'Oranye' },
  { color: '#f2d14b', label: 'Kuning' },
  { color: '#4a9b5c', label: 'Hijau' },
  { color: '#3f7ad6', label: 'Biru' },
  { color: '#8a5bd6', label: 'Ungu' },
  { color: '#f2a6b3', label: 'Pink' },
  { color: '#8a5a2b', label: 'Coklat' },
  { color: '#ffffff', label: 'Putih' },
] as const;

export type PaletteEntry = (typeof PALETTE)[number];

export function paletteLabel(color: string): string | null {
  const match = PALETTE.find((entry) => entry.color.toLowerCase() === color.toLowerCase());
  return match?.label ?? null;
}

/**
 * Short lines for Tunas. A day keeps one idle line and one cheer line,
 * so the words change without jumping every time the picture is redrawn.
 */

import { localDayNumber } from './challenge';

const IDLE = {
  id: ['Halo. Ayo gambar.', 'Pilih satu gambar.', 'Pelan-pelan saja.', 'Kamu pasti bisa.'],
  en: ['Hello. Let us draw.', 'Pick one picture.', 'Nice and slow.', 'You can do it.'],
} as const;

const CHEER = {
  id: ['Wah, bagus.', 'Kamu selesai.', 'Stempel untukmu.', 'Gambarnya lucu.'],
  en: ['That looks good.', 'You finished.', 'A stamp for you.', 'What a lovely picture.'],
} as const;

export function mascotLine(mood: 'idle' | 'cheer', locale: 'en' | 'id', date: Date): string {
  const lines = (mood === 'cheer' ? CHEER : IDLE)[locale];
  const index = Math.abs(localDayNumber(date)) % lines.length;
  return lines[index] ?? lines[0];
}

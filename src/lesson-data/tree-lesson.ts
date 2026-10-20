import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const GREEN = '#78bd70';
const BROWN = '#a97148';
const RED = '#e86d65';

const CROWN = 'M 280 325 C 280 210 375 135 500 135 C 625 135 720 210 720 325 C 720 390 625 430 500 430 C 375 430 280 390 280 325 Z';
const TRUNK = 'M 445 430 L 555 430 L 555 640 L 445 640 Z';
const GROUND = [
  { id: 'ground-left', d: 'M 225 640 L 445 640' },
  { id: 'ground-right', d: 'M 555 640 L 775 640' },
] as const;
const APPLES = [
  { id: 'apple-left', d: 'M 370 300 A 25 25 0 1 1 420 300 A 25 25 0 1 1 370 300 Z' },
  { id: 'apple-right', d: 'M 580 300 A 25 25 0 1 1 630 300 A 25 25 0 1 1 580 300 Z' },
] as const;
const BARK = 'M 500 505 L 500 565';

const CROWN_GUIDE = { id: 'crown', d: CROWN, role: 'final-outline' as const };
const TRUNK_GUIDE = { id: 'trunk', d: TRUNK, role: 'final-outline' as const };
const GROUND_GUIDES = GROUND.map((path) => ({ ...path, role: 'final-outline' as const }));
const APPLE_GUIDES = APPLES.map((path) => ({ ...path, role: 'final-outline' as const }));
const BARK_GUIDE = { id: 'bark', d: BARK, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const TREE_LESSON: LessonPackage = {
  id: 'apple-tree',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Pohon Apel',
  subtitle: 'Pohon kecil dengan dua apel',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'crown-outline',
      phase: 'outline',
      instruction: 'Gambar bagian atas pohon yang bulat.',
      hint: 'Buat bulatan besar seperti awan.',
      guidePaths: [CROWN_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'trunk-outline',
      phase: 'outline',
      instruction: 'Gambar batang pohon yang panjang.',
      hint: 'Buat kotak panjang di bawah pohon.',
      guidePaths: [TRUNK_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'ground-outline',
      phase: 'outline',
      instruction: 'Gambar tanah di kiri dan kanan batang.',
      hint: 'Tarik dua garis pendek.',
      guidePaths: GROUND_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'apples-detail',
      phase: 'detail',
      instruction: 'Gambar dua apel bulat di pohon.',
      hint: 'Satu di kiri, satu di kanan.',
      guidePaths: APPLE_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'bark-detail',
      phase: 'detail',
      instruction: 'Gambar garis kecil di batang.',
      hint: 'Tarik garis lurus ke bawah.',
      guidePaths: [BARK_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-crown',
      phase: 'color',
      instruction: 'Warnai bagian atas pohon dengan hijau.',
      hint: 'Isi bulatan besar.',
      guidePaths: [],
      colorRegionIds: ['crown'],
      toolPreset: { tool: 'brush', color: GREEN, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-trunk',
      phase: 'color',
      instruction: 'Warnai batang pohon dengan cokelat.',
      hint: 'Isi kotak panjang.',
      guidePaths: [],
      colorRegionIds: ['trunk'],
      toolPreset: { tool: 'brush', color: BROWN, widthViewbox: 40 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-apples',
      phase: 'color',
      instruction: 'Warnai kedua apel dengan merah.',
      hint: 'Isi apel kiri dan kanan.',
      guidePaths: [],
      colorRegionIds: APPLES.map((apple) => apple.id),
      toolPreset: { tool: 'brush', color: RED, widthViewbox: 24 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    { id: 'crown', label: 'Bagian atas pohon', d: CROWN, suggestedColor: GREEN },
    { id: 'trunk', label: 'Batang', d: TRUNK, suggestedColor: BROWN },
    ...APPLES.map((apple) => ({ ...apple, label: 'Apel', suggestedColor: RED })),
  ],
  targetPreview: {
    paths: [CROWN_GUIDE, TRUNK_GUIDE, ...GROUND_GUIDES, ...APPLE_GUIDES, BARK_GUIDE],
  },
};

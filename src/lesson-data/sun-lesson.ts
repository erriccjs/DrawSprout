import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const ORANGE = '#f4a340';
const YELLOW = '#f8d35c';
const PINK = '#f29db5';

const FACE = 'M 320 370 A 180 180 0 1 1 680 370 A 180 180 0 1 1 320 370';
const RAYS = [
  { id: 'ray-top', d: 'M 460 200 L 500 65 L 540 200 Z' },
  { id: 'ray-bottom', d: 'M 540 540 L 500 675 L 460 540 Z' },
  { id: 'ray-right', d: 'M 680 335 L 875 370 L 680 405 Z' },
  { id: 'ray-left', d: 'M 320 405 L 125 370 L 320 335 Z' },
] as const;
const EYES = [
  { id: 'eye-left', d: 'M 432 345 A 13 13 0 1 1 458 345 A 13 13 0 1 1 432 345' },
  { id: 'eye-right', d: 'M 542 345 A 13 13 0 1 1 568 345 A 13 13 0 1 1 542 345' },
] as const;
const SMILE = 'M 445 405 Q 500 460 555 405';
const CHEEKS = [
  { id: 'cheek-left', d: 'M 388 400 A 17 17 0 1 1 422 400 A 17 17 0 1 1 388 400' },
  { id: 'cheek-right', d: 'M 578 400 A 17 17 0 1 1 612 400 A 17 17 0 1 1 578 400' },
] as const;

const VERTICAL_RAY_GUIDES = RAYS.slice(0, 2).map((ray) => ({ ...ray, role: 'final-outline' as const }));
const HORIZONTAL_RAY_GUIDES = RAYS.slice(2).map((ray) => ({ ...ray, role: 'final-outline' as const }));
const EYE_GUIDES = EYES.map((eye) => ({ ...eye, role: 'final-outline' as const }));
const CHEEK_GUIDES = CHEEKS.map((cheek) => ({ ...cheek, role: 'final-outline' as const }));
const FACE_GUIDE = { id: 'face', d: FACE, role: 'final-outline' as const };
const SMILE_GUIDE = { id: 'smile', d: SMILE, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const SUN_LESSON: LessonPackage = {
  id: 'sun-smiling',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Matahari Ceria',
  subtitle: 'Matahari bulat yang tersenyum',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'face-outline',
      phase: 'outline',
      instruction: 'Gambar lingkaran besar untuk wajah matahari.',
      hint: 'Putar pelan sampai garisnya bertemu lagi.',
      guidePaths: [FACE_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'vertical-rays-outline',
      phase: 'outline',
      instruction: 'Gambar sinar di atas dan bawah.',
      hint: 'Buat dua segitiga kecil.',
      guidePaths: VERTICAL_RAY_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'horizontal-rays-outline',
      phase: 'outline',
      instruction: 'Gambar sinar di kiri dan kanan.',
      hint: 'Buat dua segitiga lagi.',
      guidePaths: HORIZONTAL_RAY_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'eyes-smile-detail',
      phase: 'detail',
      instruction: 'Gambar dua mata dan senyum.',
      hint: 'Mata bulat kecil, lalu garis senyum melengkung.',
      guidePaths: [...EYE_GUIDES, SMILE_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'cheeks-detail',
      phase: 'detail',
      instruction: 'Gambar dua pipi bulat.',
      hint: 'Satu di kiri senyum, satu di kanan.',
      guidePaths: CHEEK_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-rays',
      phase: 'color',
      instruction: 'Warnai semua sinar dengan oranye.',
      hint: 'Isi empat sinar di luar wajah.',
      guidePaths: [],
      colorRegionIds: RAYS.map((ray) => ray.id),
      toolPreset: { tool: 'brush', color: ORANGE, widthViewbox: 32 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-face',
      phase: 'color',
      instruction: 'Warnai wajah matahari dengan kuning.',
      hint: 'Sapukan kuas di lingkaran besar.',
      guidePaths: [],
      colorRegionIds: ['face'],
      toolPreset: { tool: 'brush', color: YELLOW, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-cheeks',
      phase: 'color',
      instruction: 'Warnai kedua pipi dengan merah muda.',
      hint: 'Isi pipi kiri dan kanan.',
      guidePaths: [],
      colorRegionIds: CHEEKS.map((cheek) => cheek.id),
      toolPreset: { tool: 'brush', color: PINK, widthViewbox: 20 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    ...RAYS.map((ray) => ({ ...ray, label: 'Sinar', suggestedColor: ORANGE })),
    { id: 'face', label: 'Wajah', d: `${FACE} Z`, suggestedColor: YELLOW },
    ...CHEEKS.map((cheek) => ({ ...cheek, label: 'Pipi', d: `${cheek.d} Z`, suggestedColor: PINK })),
  ],
  targetPreview: {
    paths: [
      ...VERTICAL_RAY_GUIDES,
      ...HORIZONTAL_RAY_GUIDES,
      FACE_GUIDE,
      ...EYE_GUIDES,
      SMILE_GUIDE,
      ...CHEEK_GUIDES,
    ],
  },
};

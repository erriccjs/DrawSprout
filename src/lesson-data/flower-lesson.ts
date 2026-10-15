import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const PINK = '#f29db5';
const YELLOW = '#f5c94b';
const GREEN = '#68b86c';

const CENTER = 'M 435 250 A 65 65 0 1 1 565 250 A 65 65 0 1 1 435 250';
const PETALS = [
  'M 455 190 C 420 145 445 75 500 65 C 555 75 580 145 545 190 Z',
  'M 440 215 C 375 155 305 165 290 225 C 295 285 365 305 440 270 Z',
  'M 560 215 C 625 155 695 165 710 225 C 705 285 635 305 560 270 Z',
  'M 450 285 C 375 275 315 325 340 385 C 380 435 455 390 485 310 Z',
  'M 550 285 C 625 275 685 325 660 385 C 620 435 545 390 515 310 Z',
] as const;
const STEM = 'M 489 310 C 486 410 485 545 488 665 L 512 665 C 515 545 514 410 511 310 Z';
const LEFT_LEAF = 'M 490 535 C 435 450 355 445 330 495 C 350 555 415 575 490 535 Z';
const RIGHT_LEAF = 'M 510 575 C 565 485 650 475 680 525 C 655 590 585 610 510 575 Z';
const EYES = [
  'M 468 240 A 7 7 0 1 1 482 240 A 7 7 0 1 1 468 240',
  'M 518 240 A 7 7 0 1 1 532 240 A 7 7 0 1 1 518 240',
] as const;
const SMILE = 'M 472 270 Q 500 295 528 270';
const VEINS = ['M 490 535 Q 420 500 355 495', 'M 510 575 Q 590 535 650 525'] as const;

const PETAL_GUIDES = PETALS.map((d, index) => ({
  id: `petal-${index + 1}`,
  d,
  role: 'final-outline' as const,
}));
const LEAF_GUIDES = [
  { id: 'leaf-left', d: LEFT_LEAF, role: 'final-outline' as const },
  { id: 'leaf-right', d: RIGHT_LEAF, role: 'final-outline' as const },
];
const FACE_GUIDES = [
  ...EYES.map((d, index) => ({ id: `eye-${index + 1}`, d, role: 'final-outline' as const })),
  { id: 'smile', d: SMILE, role: 'final-outline' as const },
];
const VEIN_GUIDES = VEINS.map((d, index) => ({
  id: `vein-${index + 1}`,
  d,
  role: 'final-outline' as const,
}));

const COLOR_REGIONS = [
  ...PETALS.map((d, index) => ({
    id: `petal-${index + 1}`,
    label: `Kelopak ${index + 1}`,
    d,
    suggestedColor: PINK,
  })),
  { id: 'center', label: 'Tengah bunga', d: `${CENTER} Z`, suggestedColor: YELLOW },
  { id: 'stem', label: 'Batang', d: STEM, suggestedColor: GREEN },
  { id: 'leaf-left', label: 'Daun kiri', d: LEFT_LEAF, suggestedColor: GREEN },
  { id: 'leaf-right', label: 'Daun kanan', d: RIGHT_LEAF, suggestedColor: GREEN },
] as const;

const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const FLOWER_LESSON: LessonPackage = {
  id: 'flower-cheerful',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Bunga Ceria',
  subtitle: 'Bunga tersenyum dengan lima kelopak',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'center-outline',
      phase: 'outline',
      instruction: 'Gambar lingkaran besar di tengah untuk wajah bunga.',
      hint: 'Putar pensilmu pelan-pelan. Lingkarannya boleh sedikit miring.',
      guidePaths: [{ id: 'center', d: CENTER, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'petals-outline',
      phase: 'outline',
      instruction: 'Gambar lima kelopak besar di sekeliling lingkaran.',
      hint: 'Kelopaknya seperti balon yang menempel pada wajah bunga.',
      guidePaths: PETAL_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'stem-outline',
      phase: 'outline',
      instruction: 'Gambar batang panjang di bawah bunga.',
      hint: 'Dua garis panjang bertemu di bagian bawah.',
      guidePaths: [{ id: 'stem', d: STEM, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'leaves-outline',
      phase: 'outline',
      instruction: 'Tambahkan dua daun besar di samping batang.',
      hint: 'Satu daun ke kiri dan satu lagi ke kanan.',
      guidePaths: LEAF_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'face-detail',
      phase: 'detail',
      instruction: 'Beri bunga dua mata dan senyum.',
      hint: 'Mata kecil di atas, senyum melengkung di bawah.',
      guidePaths: FACE_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'veins-detail',
      phase: 'detail',
      instruction: 'Gambar satu garis di tengah setiap daun.',
      hint: 'Ikuti arah daun dari batang ke ujungnya.',
      guidePaths: VEIN_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-petals',
      phase: 'color',
      instruction: 'Warnai kelopak bunga.',
      hint: 'Sapukan kuas besar pada kelopaknya. Warna kesukaanmu juga boleh.',
      guidePaths: [],
      colorRegionIds: PETAL_GUIDES.map((guide) => guide.id),
      toolPreset: { tool: 'brush', color: PINK, widthViewbox: 52 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-center',
      phase: 'color',
      instruction: 'Warnai wajah bunga.',
      hint: 'Kuasnya lebih kecil agar mudah mengisi lingkaran.',
      guidePaths: [],
      colorRegionIds: ['center'],
      toolPreset: { tool: 'brush', color: YELLOW, widthViewbox: 38 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-greenery',
      phase: 'color',
      instruction: 'Warnai batang dan kedua daun.',
      hint: 'Mulai dari batang, lalu isi daun kiri dan kanan.',
      guidePaths: [],
      colorRegionIds: ['stem', 'leaf-left', 'leaf-right'],
      toolPreset: { tool: 'brush', color: GREEN, widthViewbox: 42 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: COLOR_REGIONS,
  targetPreview: {
    paths: [
      ...PETAL_GUIDES,
      { id: 'stem', d: STEM, role: 'final-outline' },
      ...LEAF_GUIDES,
      { id: 'center', d: CENTER, role: 'final-outline' },
      ...FACE_GUIDES,
      ...VEIN_GUIDES,
    ],
  },
};

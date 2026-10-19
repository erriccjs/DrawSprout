import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const ORANGE = '#f0913c';
const TAIL_ORANGE = '#f6b24a';
const YELLOW = '#f8d35c';

/** Body: ellipse centred at (470, 375) with rx=230, ry=160. */
const BODY = 'M 240 375 A 230 160 0 1 1 700 375 A 230 160 0 1 1 240 375';
const TAIL = 'M 660 285 L 890 215 L 890 535 L 660 465';
const FIN_TOP = 'M 380 228 Q 470 110 580 234';
const FIN_BOTTOM = 'M 400 527 Q 470 640 570 519';

/**
 * Each colour region closes along the body ellipse instead of across it, so a
 * fin or the tail never covers part of the body the child has already filled.
 */
const TAIL_REGION = `${TAIL} A 230 160 0 0 0 660 285 Z`;
const FIN_TOP_REGION = `${FIN_TOP} A 230 160 0 0 0 380 228 Z`;
const FIN_BOTTOM_REGION = `${FIN_BOTTOM} A 230 160 0 0 1 400 527 Z`;

const EYE = 'M 281 320 A 24 24 0 1 1 329 320 A 24 24 0 1 1 281 320';
const PUPIL = 'M 300 322 A 9 9 0 1 1 318 322 A 9 9 0 1 1 300 322';
const MOUTH = 'M 246 400 Q 275 425 306 404';
const GILL = 'M 390 255 Q 348 375 390 495';
const BUBBLE_BIG = 'M 159 290 A 26 26 0 1 1 211 290 A 26 26 0 1 1 159 290';
const BUBBLE_SMALL = 'M 99 200 A 16 16 0 1 1 131 200 A 16 16 0 1 1 99 200';

const FIN_GUIDES = [
  { id: 'fin-top', d: FIN_TOP, role: 'final-outline' as const },
  { id: 'fin-bottom', d: FIN_BOTTOM, role: 'final-outline' as const },
];
const FACE_GUIDES = [
  { id: 'eye', d: EYE, role: 'final-outline' as const },
  { id: 'pupil', d: PUPIL, role: 'final-outline' as const },
  { id: 'mouth', d: MOUTH, role: 'final-outline' as const },
];
const EXTRA_GUIDES = [
  { id: 'gill', d: GILL, role: 'final-outline' as const },
  { id: 'bubble-big', d: BUBBLE_BIG, role: 'final-outline' as const },
  { id: 'bubble-small', d: BUBBLE_SMALL, role: 'final-outline' as const },
];

const COLOR_REGIONS = [
  { id: 'body', label: 'Badan', d: `${BODY} Z`, suggestedColor: ORANGE },
  { id: 'tail', label: 'Ekor', d: TAIL_REGION, suggestedColor: TAIL_ORANGE },
  { id: 'fin-top', label: 'Sirip atas', d: FIN_TOP_REGION, suggestedColor: YELLOW },
  { id: 'fin-bottom', label: 'Sirip bawah', d: FIN_BOTTOM_REGION, suggestedColor: YELLOW },
] as const;

const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const FISH_LESSON: LessonPackage = {
  id: 'fish-cheerful',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Ikan Lucu',
  subtitle: 'Ikan kecil dengan ekor seperti kipas',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'body-outline',
      phase: 'outline',
      instruction: 'Gambar bentuk telur besar untuk badan ikan.',
      hint: 'Mulai dari depan, lalu putar pelan sampai kembali ke titik awal.',
      guidePaths: [{ id: 'body', d: BODY, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'tail-outline',
      phase: 'outline',
      instruction: 'Gambar ekor seperti kipas di belakang badan.',
      hint: 'Dua garis miring dari badan, lalu satu garis tegak di ujungnya.',
      guidePaths: [{ id: 'tail', d: TAIL, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'fins-outline',
      phase: 'outline',
      instruction: 'Tambahkan satu sirip di atas dan satu di bawah badan.',
      hint: 'Siripnya seperti bukit kecil yang melengkung.',
      guidePaths: FIN_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'face-detail',
      phase: 'detail',
      instruction: 'Beri ikan satu mata dan mulut.',
      hint: 'Mata bulat di depan, mulut kecil melengkung di bawahnya.',
      guidePaths: FACE_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'extras-detail',
      phase: 'detail',
      instruction: 'Gambar garis pipi dan dua gelembung.',
      hint: 'Garisnya melengkung di belakang mata, gelembungnya naik ke atas.',
      guidePaths: EXTRA_GUIDES,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-body',
      phase: 'color',
      instruction: 'Warnai badan ikan dengan oranye.',
      hint: 'Sapukan kuas besar dari depan ke belakang. Warna kesukaanmu juga boleh.',
      guidePaths: [],
      colorRegionIds: ['body'],
      toolPreset: { tool: 'brush', color: ORANGE, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-tail',
      phase: 'color',
      instruction: 'Warnai ekor ikan dengan oranye muda.',
      hint: 'Isi kipas ekornya sampai ke ujung.',
      guidePaths: [],
      colorRegionIds: ['tail'],
      toolPreset: { tool: 'brush', color: TAIL_ORANGE, widthViewbox: 44 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-fins',
      phase: 'color',
      instruction: 'Warnai kedua sirip dengan kuning.',
      hint: 'Sirip atas dulu, lalu sirip bawah.',
      guidePaths: [],
      colorRegionIds: ['fin-top', 'fin-bottom'],
      toolPreset: { tool: 'brush', color: YELLOW, widthViewbox: 30 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: COLOR_REGIONS,
  targetPreview: {
    paths: [
      { id: 'tail', d: TAIL, role: 'final-outline' },
      ...FIN_GUIDES,
      { id: 'body', d: BODY, role: 'final-outline' },
      ...FACE_GUIDES,
      ...EXTRA_GUIDES,
    ],
  },
};

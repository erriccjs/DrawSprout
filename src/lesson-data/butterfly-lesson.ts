import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const PINK = '#f29db5';
const PURPLE = '#c46bdc';
const BROWN = '#8b5a2b';

const BODY = 'M 470 170 L 530 170 L 545 560 L 455 560 Z';
const WING_UPPER_LEFT = 'M 470 230 C 250 70 80 250 180 400 C 260 500 400 450 470 370 Z';
const WING_UPPER_RIGHT = 'M 530 230 C 750 70 920 250 820 400 C 740 500 600 450 530 370 Z';
const WING_LOWER_LEFT = 'M 470 380 C 280 420 140 560 240 650 C 350 710 430 560 470 490 Z';
const WING_LOWER_RIGHT = 'M 530 380 C 720 420 860 560 760 650 C 650 710 570 560 530 490 Z';
const ANTENNA_LEFT = 'M 485 170 Q 400 70 350 60';
const ANTENNA_RIGHT = 'M 515 170 Q 600 70 650 60';

const BODY_GUIDE = { id: 'body', d: BODY, role: 'final-outline' as const };
const UPPER_LEFT_GUIDE = { id: 'wing-upper-left', d: WING_UPPER_LEFT, role: 'final-outline' as const };
const UPPER_RIGHT_GUIDE = { id: 'wing-upper-right', d: WING_UPPER_RIGHT, role: 'final-outline' as const };
const LOWER_LEFT_GUIDE = { id: 'wing-lower-left', d: WING_LOWER_LEFT, role: 'final-outline' as const };
const LOWER_RIGHT_GUIDE = { id: 'wing-lower-right', d: WING_LOWER_RIGHT, role: 'final-outline' as const };
const ANTENNA_LEFT_GUIDE = { id: 'antenna-left', d: ANTENNA_LEFT, role: 'final-outline' as const };
const ANTENNA_RIGHT_GUIDE = { id: 'antenna-right', d: ANTENNA_RIGHT, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const BUTTERFLY_LESSON: LessonPackage = {
  id: 'butterfly',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Kupu-kupu',
  subtitle: 'Sayap kiri dan kanan',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'body-outline',
      phase: 'outline',
      instruction: 'Gambar badan kupu-kupu, panjang di tengah.',
      hint: 'Kotak kecil yang berdiri tegak.',
      guidePaths: [BODY_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'upper-wings-outline',
      phase: 'outline',
      instruction: 'Gambar dua sayap besar di atas.',
      hint: 'Satu di kiri, satu di kanan, sama besar.',
      guidePaths: [UPPER_LEFT_GUIDE, UPPER_RIGHT_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'lower-wings-outline',
      phase: 'outline',
      instruction: 'Gambar dua sayap kecil di bawah.',
      hint: 'Lebih kecil dari sayap atas.',
      guidePaths: [LOWER_LEFT_GUIDE, LOWER_RIGHT_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'antennae-detail',
      phase: 'detail',
      instruction: 'Gambar dua antena di atas kepala.',
      hint: 'Garis melengkung ke kiri dan ke kanan.',
      guidePaths: [ANTENNA_LEFT_GUIDE, ANTENNA_RIGHT_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-upper-wings',
      phase: 'color',
      instruction: 'Warnai dua sayap atas dengan merah muda.',
      hint: 'Isi sayap kiri dan kanan.',
      guidePaths: [],
      colorRegionIds: ['wing-upper-left', 'wing-upper-right'],
      toolPreset: { tool: 'brush', color: PINK, widthViewbox: 48 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-lower-wings',
      phase: 'color',
      instruction: 'Warnai dua sayap bawah dengan ungu.',
      hint: 'Isi sayap kecil di bawah.',
      guidePaths: [],
      colorRegionIds: ['wing-lower-left', 'wing-lower-right'],
      toolPreset: { tool: 'brush', color: PURPLE, widthViewbox: 40 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-body',
      phase: 'color',
      instruction: 'Warnai badan dengan cokelat.',
      hint: 'Sapukan kuas di kotak tengah.',
      guidePaths: [],
      colorRegionIds: ['body'],
      toolPreset: { tool: 'brush', color: BROWN, widthViewbox: 28 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    { id: 'wing-upper-left', label: 'Sayap atas kiri', d: WING_UPPER_LEFT, suggestedColor: PINK },
    { id: 'wing-upper-right', label: 'Sayap atas kanan', d: WING_UPPER_RIGHT, suggestedColor: PINK },
    { id: 'wing-lower-left', label: 'Sayap bawah kiri', d: WING_LOWER_LEFT, suggestedColor: PURPLE },
    { id: 'wing-lower-right', label: 'Sayap bawah kanan', d: WING_LOWER_RIGHT, suggestedColor: PURPLE },
    { id: 'body', label: 'Badan', d: BODY, suggestedColor: BROWN },
  ],
  targetPreview: {
    paths: [
      BODY_GUIDE,
      UPPER_LEFT_GUIDE,
      UPPER_RIGHT_GUIDE,
      LOWER_LEFT_GUIDE,
      LOWER_RIGHT_GUIDE,
      ANTENNA_LEFT_GUIDE,
      ANTENNA_RIGHT_GUIDE,
    ],
  },
};

import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const BLUE = '#4c8dff';
const SKY = '#d7ecff';
const WHEEL = '#3a3a3a';

const BODY = 'M 150 420 L 850 420 L 850 580 L 150 580 Z';
const CABIN = 'M 300 420 L 400 270 L 700 270 L 800 420 Z';
const WINDOW = 'M 430 405 L 475 300 L 650 300 L 710 405 Z';
const WHEEL_LEFT = 'M 220 580 A 68 68 0 1 1 356 580 A 68 68 0 1 1 220 580';
const WHEEL_RIGHT = 'M 644 580 A 68 68 0 1 1 780 580 A 68 68 0 1 1 644 580';

const BODY_GUIDE = { id: 'body', d: BODY, role: 'final-outline' as const };
const CABIN_GUIDE = { id: 'cabin', d: CABIN, role: 'final-outline' as const };
const WINDOW_GUIDE = { id: 'window', d: WINDOW, role: 'final-outline' as const };
const WHEEL_LEFT_GUIDE = { id: 'wheel-left', d: WHEEL_LEFT, role: 'final-outline' as const };
const WHEEL_RIGHT_GUIDE = { id: 'wheel-right', d: WHEEL_RIGHT, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const CAR_LESSON: LessonPackage = {
  id: 'car',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Mobil',
  subtitle: 'Badan, jendela, dan dua roda',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'body-outline',
      phase: 'outline',
      instruction: 'Gambar kotak panjang untuk badan mobil.',
      hint: 'Lebar ke samping, tidak terlalu tinggi.',
      guidePaths: [BODY_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'cabin-outline',
      phase: 'outline',
      instruction: 'Gambar atap di atas badan mobil.',
      hint: 'Dua sisi miring, lalu garis atas yang datar.',
      guidePaths: [CABIN_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'window-outline',
      phase: 'detail',
      instruction: 'Gambar jendela di dalam atap.',
      hint: 'Kotak miring yang lebih kecil dari atap.',
      guidePaths: [WINDOW_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 6 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'wheels-outline',
      phase: 'outline',
      instruction: 'Gambar dua roda bulat.',
      hint: 'Satu di bawah kiri, satu di bawah kanan.',
      guidePaths: [WHEEL_LEFT_GUIDE, WHEEL_RIGHT_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-body',
      phase: 'color',
      instruction: 'Warnai badan mobil dengan biru.',
      hint: 'Sapukan kuas di kotak panjang.',
      guidePaths: [],
      colorRegionIds: ['body'],
      toolPreset: { tool: 'brush', color: BLUE, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-window',
      phase: 'color',
      instruction: 'Warnai jendela dengan biru muda.',
      hint: 'Isi jendela di dalam atap.',
      guidePaths: [],
      colorRegionIds: ['window'],
      toolPreset: { tool: 'brush', color: SKY, widthViewbox: 32 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-wheels',
      phase: 'color',
      instruction: 'Warnai kedua roda dengan warna gelap.',
      hint: 'Isi lingkaran kiri dan kanan.',
      guidePaths: [],
      colorRegionIds: ['wheel-left', 'wheel-right'],
      toolPreset: { tool: 'brush', color: WHEEL, widthViewbox: 36 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    { id: 'body', label: 'Badan', d: BODY, suggestedColor: BLUE },
    { id: 'window', label: 'Jendela', d: WINDOW, suggestedColor: SKY },
    { id: 'wheel-left', label: 'Roda kiri', d: `${WHEEL_LEFT} Z`, suggestedColor: WHEEL },
    { id: 'wheel-right', label: 'Roda kanan', d: `${WHEEL_RIGHT} Z`, suggestedColor: WHEEL },
  ],
  targetPreview: {
    paths: [BODY_GUIDE, CABIN_GUIDE, WINDOW_GUIDE, WHEEL_LEFT_GUIDE, WHEEL_RIGHT_GUIDE],
  },
};

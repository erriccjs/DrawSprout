import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const YELLOW = '#f8d35c';

const STAR = 'M 500 130 L 562 305 L 747 310 L 600 422 L 653 600 L 500 495 L 347 600 L 400 422 L 253 310 L 438 305 Z';
const EYE_LEFT = 'M 448 360 A 14 14 0 1 1 476 360 A 14 14 0 1 1 448 360';
const EYE_RIGHT = 'M 524 360 A 14 14 0 1 1 552 360 A 14 14 0 1 1 524 360';
const SMILE = 'M 455 415 Q 500 470 545 415';

const STAR_GUIDE = { id: 'star', d: STAR, role: 'final-outline' as const };
const EYE_LEFT_GUIDE = { id: 'eye-left', d: EYE_LEFT, role: 'final-outline' as const };
const EYE_RIGHT_GUIDE = { id: 'eye-right', d: EYE_RIGHT, role: 'final-outline' as const };
const SMILE_GUIDE = { id: 'smile', d: SMILE, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const STAR_LESSON: LessonPackage = {
  id: 'star',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Bintang',
  subtitle: 'Bintang lima yang tersenyum',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'star-outline',
      phase: 'outline',
      instruction: 'Gambar bintang lima.',
      hint: 'Lima ujung, sambungkan sampai garisnya tertutup.',
      guidePaths: [STAR_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'face-detail',
      phase: 'detail',
      instruction: 'Gambar dua mata dan senyum.',
      hint: 'Mata bulat kecil di dalam bintang.',
      guidePaths: [EYE_LEFT_GUIDE, EYE_RIGHT_GUIDE, SMILE_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-star',
      phase: 'color',
      instruction: 'Warnai bintang dengan kuning.',
      hint: 'Sapukan kuas di dalam bentuk bintang.',
      guidePaths: [],
      colorRegionIds: ['star'],
      toolPreset: { tool: 'brush', color: YELLOW, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    { id: 'star', label: 'Bintang', d: STAR, suggestedColor: YELLOW },
  ],
  targetPreview: {
    paths: [STAR_GUIDE, EYE_LEFT_GUIDE, EYE_RIGHT_GUIDE, SMILE_GUIDE],
  },
};

import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const ORANGE = '#f07820';

/** A ball centred in the 1000×750 space, clear of the corners. */
const BALL = 'M 290 380 A 210 210 0 1 1 710 380 A 210 210 0 1 1 290 380';
const SEAM_CENTER = 'M 500 170 Q 575 380 500 590';
const SEAM_LEFT = 'M 360 230 Q 305 380 360 530';
const SEAM_RIGHT = 'M 640 230 Q 695 380 640 530';

const BALL_GUIDE = { id: 'ball', d: BALL, role: 'final-outline' as const };
const CENTER_GUIDE = { id: 'seam-center', d: SEAM_CENTER, role: 'final-outline' as const };
const LEFT_GUIDE = { id: 'seam-left', d: SEAM_LEFT, role: 'final-outline' as const };
const RIGHT_GUIDE = { id: 'seam-right', d: SEAM_RIGHT, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const BASKETBALL_LESSON: LessonPackage = {
  id: 'basketball',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Bola Basket',
  subtitle: 'Bola bulat dengan garis lengkung',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'ball-outline',
      phase: 'outline',
      instruction: 'Gambar lingkaran besar untuk bola.',
      hint: 'Putar pelan sampai garisnya bertemu lagi.',
      guidePaths: [BALL_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'center-seam',
      phase: 'outline',
      instruction: 'Gambar garis lengkung di tengah bola.',
      hint: 'Mulai dari atas, melengkung, lalu ke bawah.',
      guidePaths: [CENTER_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'side-seams',
      phase: 'outline',
      instruction: 'Gambar dua garis lengkung di kiri dan kanan.',
      hint: 'Satu di sisi kiri, satu di sisi kanan.',
      guidePaths: [LEFT_GUIDE, RIGHT_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-ball',
      phase: 'color',
      instruction: 'Warnai bola dengan oranye.',
      hint: 'Sapukan kuas di dalam lingkaran.',
      guidePaths: [],
      colorRegionIds: ['ball'],
      toolPreset: { tool: 'brush', color: ORANGE, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    { id: 'ball', label: 'Bola', d: `${BALL} Z`, suggestedColor: ORANGE },
  ],
  targetPreview: {
    paths: [BALL_GUIDE, CENTER_GUIDE, LEFT_GUIDE, RIGHT_GUIDE],
  },
};

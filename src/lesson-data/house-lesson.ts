import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const YELLOW = '#f8d35c';
const RED = '#e23d3d';
const BROWN = '#8b5a2b';
const SKY = '#7eb6e8';

const WALLS = 'M 250 340 L 750 340 L 750 640 L 250 640 Z';
const ROOF = 'M 200 350 L 500 140 L 800 350 Z';
const DOOR = 'M 455 640 L 455 450 L 575 450 L 575 640 Z';
const WINDOW = 'M 310 400 L 420 400 L 420 510 L 310 510 Z';
const WINDOW_CROSS = 'M 365 400 L 365 510 M 310 455 L 420 455';

const WALLS_GUIDE = { id: 'walls', d: WALLS, role: 'final-outline' as const };
const ROOF_GUIDE = { id: 'roof', d: ROOF, role: 'final-outline' as const };
const DOOR_GUIDE = { id: 'door', d: DOOR, role: 'final-outline' as const };
const WINDOW_GUIDE = { id: 'window', d: WINDOW, role: 'final-outline' as const };
const WINDOW_CROSS_GUIDE = { id: 'window-cross', d: WINDOW_CROSS, role: 'final-outline' as const };
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const HOUSE_LESSON: LessonPackage = {
  id: 'house',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Rumah',
  subtitle: 'Dinding, atap, pintu, dan jendela',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'walls-outline',
      phase: 'outline',
      instruction: 'Gambar kotak besar untuk dinding rumah.',
      hint: 'Empat garis lurus, lalu sambungkan.',
      guidePaths: [WALLS_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'roof-outline',
      phase: 'outline',
      instruction: 'Gambar atap segitiga di atas dinding.',
      hint: 'Puncaknya di tengah, kaki atap lebih lebar dari dinding.',
      guidePaths: [ROOF_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'door-window-outline',
      phase: 'detail',
      instruction: 'Gambar pintu dan jendela.',
      hint: 'Pintu di bawah, jendela di kiri, dengan garis silang.',
      guidePaths: [DOOR_GUIDE, WINDOW_GUIDE, WINDOW_CROSS_GUIDE],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 6 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-walls',
      phase: 'color',
      instruction: 'Warnai dinding dengan kuning.',
      hint: 'Sapukan kuas di dalam kotak besar.',
      guidePaths: [],
      colorRegionIds: ['walls'],
      toolPreset: { tool: 'brush', color: YELLOW, widthViewbox: 56 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-roof',
      phase: 'color',
      instruction: 'Warnai atap dengan merah.',
      hint: 'Isi segitiga di atas dinding.',
      guidePaths: [],
      colorRegionIds: ['roof'],
      toolPreset: { tool: 'brush', color: RED, widthViewbox: 48 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-door',
      phase: 'color',
      instruction: 'Warnai pintu dengan cokelat.',
      hint: 'Isi pintu di bawah dinding.',
      guidePaths: [],
      colorRegionIds: ['door'],
      toolPreset: { tool: 'brush', color: BROWN, widthViewbox: 28 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-window',
      phase: 'color',
      instruction: 'Warnai jendela dengan biru.',
      hint: 'Isi kotak jendela di kiri.',
      guidePaths: [],
      colorRegionIds: ['window'],
      toolPreset: { tool: 'brush', color: SKY, widthViewbox: 28 },
      completionPolicy: MANUAL_ONLY,
    },
  ],
  colorRegions: [
    { id: 'walls', label: 'Dinding', d: WALLS, suggestedColor: YELLOW },
    { id: 'roof', label: 'Atap', d: ROOF, suggestedColor: RED },
    { id: 'door', label: 'Pintu', d: DOOR, suggestedColor: BROWN },
    { id: 'window', label: 'Jendela', d: WINDOW, suggestedColor: SKY },
  ],
  targetPreview: {
    paths: [WALLS_GUIDE, ROOF_GUIDE, DOOR_GUIDE, WINDOW_GUIDE, WINDOW_CROSS_GUIDE],
  },
};

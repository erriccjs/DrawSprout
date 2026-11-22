/**
 * A blank page for “Gambar bebas” on the home list.
 *
 * One step, no guide lines. The app opens it already in free drawing, so the
 * child is not asked to finish a lesson first.
 */

import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

export const FREE_DRAW_LESSON: LessonPackage = {
  id: 'free-draw',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Gambar bebas',
  subtitle: 'Kertas kosong',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'paper',
      phase: 'outline',
      instruction: 'Gambar apa saja.',
      hint: 'Kertas ini kosong.',
      guidePaths: [],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: '#3a3a3a', widthViewbox: 8 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    },
  ],
  colorRegions: [],
  targetPreview: { paths: [] },
};

/**
 * A blank paper for tracing. It is not listed on the choosing screen.
 * The photo is not part of the lesson: it stays beside the session and can
 * be left out of the saved picture.
 */

import { LESSON_SCHEMA_VERSION, type LessonPackage } from '../lesson-data/schema';

export const TRACE_LESSON: LessonPackage = {
  id: 'photo-trace',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Jiplak foto',
  subtitle: 'Foto tipis, lalu garismu',
  coordinateSpace: { width: 1000, height: 750 },
  steps: [
    {
      id: 'trace',
      phase: 'outline',
      instruction: 'Jiplak garis pada foto.',
      hint: 'Foto tetap di tempatnya. Garis kamu yang tersimpan.',
      guidePaths: [],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: '#3a3a3a', widthViewbox: 8 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    },
  ],
  colorRegions: [],
  // Validation wants a preview path. Nothing draws it: the step has no guides.
  targetPreview: { paths: [{ id: 'paper', d: 'M 0 0 L 1 0', role: 'final-outline' }] },
};

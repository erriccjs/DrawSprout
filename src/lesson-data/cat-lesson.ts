/**
 * The one hand-authored lesson for milestone 1 (PRD section 20 item 2:
 * "Buat satu target kucing manual berikut path, instruksi, area warna, dan
 * 6-8 tahap bentuk/detail").
 *
 * Everything here is plain data in the 1000x750 coordinate space. It is written
 * the way an authoring tool would emit it, so no code outside `lesson-data`
 * needs to change as lessons are added.
 *
 * Pedagogy follows PRD section 9: big shapes first, then detail, then colour;
 * one speakable goal per step; no step demands an identical line.
 */

import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

const INK = '#3a3a3a';
const FUR = '#e8a33d';
const PINK = '#f2a6b3';

/** Head: circle centred at (500, 215) with r=115. */
const HEAD = 'M 385 215 A 115 115 0 1 1 615 215 A 115 115 0 1 1 385 215';
const EAR_LEFT = 'M 400 158 L 405 45 L 470 104';
const EAR_RIGHT = 'M 600 158 L 595 45 L 530 104';

/** Body: open curve whose top ends tuck behind the head. */
const BODY =
  'M 418 300 C 340 360 325 520 352 625 C 372 700 628 700 648 625 C 675 520 660 360 582 300';

const PAW_LEFT = 'M 408 660 C 388 672 390 700 414 704 C 446 708 464 692 458 672 C 452 658 428 652 408 660';
const PAW_RIGHT = 'M 592 660 C 612 672 610 700 586 704 C 554 708 536 692 542 672 C 548 658 572 652 592 660';

const TAIL = 'M 648 575 C 745 595 800 505 776 425 C 762 378 712 362 694 400';

const EYE_LEFT = 'M 438 205 A 17 17 0 1 1 472 205 A 17 17 0 1 1 438 205';
const EYE_RIGHT = 'M 528 205 A 17 17 0 1 1 562 205 A 17 17 0 1 1 528 205';
const NOSE = 'M 484 252 L 516 252 L 500 270 Z';

const MOUTH_LEFT = 'M 500 270 C 500 288 480 292 468 280';
const MOUTH_RIGHT = 'M 500 270 C 500 288 520 292 532 280';
const WHISKERS_LEFT = ['M 470 262 L 378 246', 'M 470 272 L 372 272', 'M 470 282 L 378 300'];
const WHISKERS_RIGHT = ['M 530 262 L 622 246', 'M 530 272 L 628 272', 'M 530 282 L 622 300'];

/**
 * Colour regions are one closed sub-path each. The renderer unions a step's
 * regions through a mask, so a region never has to describe more than one
 * simple shape and path winding direction never matters.
 */
const COLOR_REGIONS = [
  { id: 'fur-head', label: 'Kepala', d: `${HEAD} Z`, suggestedColor: FUR },
  { id: 'fur-ear-left', label: 'Telinga kiri', d: `${EAR_LEFT} Z`, suggestedColor: FUR },
  { id: 'fur-ear-right', label: 'Telinga kanan', d: `${EAR_RIGHT} Z`, suggestedColor: FUR },
  { id: 'fur-body', label: 'Badan', d: `${BODY} Z`, suggestedColor: FUR },
  { id: 'fur-paw-left', label: 'Kaki kiri', d: `${PAW_LEFT} Z`, suggestedColor: FUR },
  { id: 'fur-paw-right', label: 'Kaki kanan', d: `${PAW_RIGHT} Z`, suggestedColor: FUR },
  {
    id: 'fur-tail',
    label: 'Ekor',
    d: `${TAIL} Z`,
    suggestedColor: FUR,
  },
  { id: 'inner-ear-left', label: 'Dalam telinga kiri', d: 'M 408 141 L 411 62 L 457 104 Z', suggestedColor: PINK },
  { id: 'inner-ear-right', label: 'Dalam telinga kanan', d: 'M 592 141 L 589 62 L 543 104 Z', suggestedColor: PINK },
  { id: 'nose', label: 'Hidung', d: NOSE, suggestedColor: PINK },
] as const;

const FUR_REGION_IDS = COLOR_REGIONS.filter((r) => r.id.startsWith('fur-')).map((r) => r.id);

/** Manual advance only: automatic completion detection is FR-10, deferred. */
const MANUAL_ONLY = { manualAllowed: true, automaticEnabled: false } as const;

export const CAT_LESSON: LessonPackage = {
  id: 'cat-sitting',
  schemaVersion: LESSON_SCHEMA_VERSION,
  contentVersion: '1.0.0',
  title: 'Kucing Duduk',
  subtitle: 'Tujuh langkah garis, lalu dua langkah warna',
  coordinateSpace: { width: 1000, height: 750 },

  steps: [
    {
      id: 'head-outline',
      phase: 'outline',
      instruction: 'Gambar lingkaran besar untuk kepala.',
      hint: 'Mulai dari atas, lalu putar sampai kembali ke titik awal. Tidak harus bulat sempurna.',
      guidePaths: [{ id: 'head', d: HEAD, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'ears',
      phase: 'outline',
      instruction: 'Tambahkan dua telinga di atas kepala.',
      hint: 'Seperti dua gunung kecil yang menempel di kepala.',
      guidePaths: [
        { id: 'ear-left', d: EAR_LEFT, role: 'final-outline' },
        { id: 'ear-right', d: EAR_RIGHT, role: 'final-outline' },
      ],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'body',
      phase: 'outline',
      instruction: 'Gambar badan kucing di bawah kepala.',
      hint: 'Badan kucing duduk melebar ke bawah, seperti buah pir.',
      guidePaths: [{ id: 'body', d: BODY, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 8 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'paws',
      phase: 'detail',
      instruction: 'Gambar dua kaki depan di bawah badan.',
      hint: 'Dua bulatan kecil yang duduk di lantai.',
      guidePaths: [
        { id: 'paw-left', d: PAW_LEFT, role: 'final-outline' },
        { id: 'paw-right', d: PAW_RIGHT, role: 'final-outline' },
      ],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 6 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'tail',
      phase: 'detail',
      instruction: 'Gambar ekor yang melengkung ke kanan.',
      hint: 'Satu garis panjang dari samping badan, naik lalu melengkung.',
      guidePaths: [{ id: 'tail', d: TAIL, role: 'final-outline' }],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 6 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'eyes-nose',
      phase: 'detail',
      instruction: 'Gambar dua mata dan satu hidung.',
      hint: 'Mata di tengah kepala, hidung sedikit di bawahnya.',
      guidePaths: [
        { id: 'eye-left', d: EYE_LEFT, role: 'final-outline' },
        { id: 'eye-right', d: EYE_RIGHT, role: 'final-outline' },
        { id: 'nose', d: NOSE, role: 'final-outline' },
      ],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'mouth-whiskers',
      phase: 'detail',
      instruction: 'Gambar mulut dan kumis kucing.',
      hint: 'Mulut seperti huruf w kecil, lalu tiga kumis di setiap sisi.',
      guidePaths: [
        { id: 'mouth-left', d: MOUTH_LEFT, role: 'final-outline' },
        { id: 'mouth-right', d: MOUTH_RIGHT, role: 'final-outline' },
        ...WHISKERS_LEFT.map((d, i) => ({ id: `whisker-left-${i + 1}`, d, role: 'final-outline' as const })),
        ...WHISKERS_RIGHT.map((d, i) => ({ id: `whisker-right-${i + 1}`, d, role: 'final-outline' as const })),
      ],
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: INK, widthViewbox: 5 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-fur',
      phase: 'color',
      instruction: 'Warnai bulu kucing.',
      hint: 'Pakai kuas besar. Warna apa saja boleh — ini kucingmu.',
      guidePaths: [],
      colorRegionIds: FUR_REGION_IDS,
      toolPreset: { tool: 'brush', color: FUR, widthViewbox: 48 },
      completionPolicy: MANUAL_ONLY,
    },
    {
      id: 'color-face',
      phase: 'color',
      instruction: 'Warnai dalam telinga dan hidung.',
      hint: 'Area ini kecil, jadi kuasnya lebih kecil juga.',
      guidePaths: [],
      colorRegionIds: ['inner-ear-left', 'inner-ear-right', 'nose'],
      toolPreset: { tool: 'brush', color: PINK, widthViewbox: 18 },
      completionPolicy: MANUAL_ONLY,
    },
  ],

  colorRegions: COLOR_REGIONS,

  targetPreview: {
    paths: [
      { id: 'head', d: HEAD, role: 'final-outline' },
      { id: 'ear-left', d: EAR_LEFT, role: 'final-outline' },
      { id: 'ear-right', d: EAR_RIGHT, role: 'final-outline' },
      { id: 'body', d: BODY, role: 'final-outline' },
      { id: 'paw-left', d: PAW_LEFT, role: 'final-outline' },
      { id: 'paw-right', d: PAW_RIGHT, role: 'final-outline' },
      { id: 'tail', d: TAIL, role: 'final-outline' },
      { id: 'eye-left', d: EYE_LEFT, role: 'final-outline' },
      { id: 'eye-right', d: EYE_RIGHT, role: 'final-outline' },
      { id: 'nose', d: NOSE, role: 'final-outline' },
      { id: 'mouth-left', d: MOUTH_LEFT, role: 'final-outline' },
      { id: 'mouth-right', d: MOUTH_RIGHT, role: 'final-outline' },
      ...WHISKERS_LEFT.map((d, i) => ({ id: `whisker-left-${i + 1}`, d, role: 'final-outline' as const })),
      ...WHISKERS_RIGHT.map((d, i) => ({ id: `whisker-right-${i + 1}`, d, role: 'final-outline' as const })),
    ],
  },
};

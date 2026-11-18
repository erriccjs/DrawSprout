/**
 * A cup you can recognise: an open elliptical rim, a tapered body,
 * a C-shaped handle, a saucer, and the drink inside.
 *
 * Line steps go top, middle, bottom, then the handle on its own.
 * Each filled part has one colour step. The steam is only a line.
 */

import { ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const CERAMIC = '#f4efe6';
const DRINK = '#6f3b24';
const SAUCER = '#e7e0d4';

/** Open lip. Two arcs, drawn as a line, not a fill. */
const RIM = ellipse(400, 228, 150, 42);
/** Tapered wall: wide at the rim, narrower at the foot. One closed shape. */
const BODY = [
  'M 262 258',
  'L 292 478',
  'Q 400 548 508 478',
  'L 538 258',
  'Q 400 292 262 258',
  'Z',
].join(' ');
/** Thick C, opening toward the cup. Outer curve, then the inner curve home. */
const HANDLE = [
  'M 528 312',
  'C 690 286 712 468 522 452',
  'C 630 428 624 348 528 312',
  'Z',
].join(' ');
const SAUCER_SHAPE = ellipse(400, 592, 236, 34);
const DRINK_SURFACE = ellipse(400, 286, 108, 22);
const STEAM_LEFT = 'M 348 168 C 328 142 372 118 346 86';
const STEAM_RIGHT = 'M 438 158 C 462 128 414 108 446 74';

export const CUP_CATEGORY: CategoryLesson = {
  id: 'cup',
  status: 'done',
  title: 'Cangkir',
  hint: 'a cup, mug, or coffee cup, handle included when visible',
  facing: 'right',
  parts: [
    { id: 'cup', label: 'cangkir', regionIds: ['body', 'handle'] },
    { id: 'drink', label: 'minuman', regionIds: ['drink'] },
    { id: 'saucer', label: 'tatakan', regionIds: ['saucer'] },
  ],
  lesson: packageLesson({
    id: 'cup',
    title: 'Cangkir',
    subtitle: 'Bibir, badan, tatakan, lalu pegangan',
    contentVersion: '1.1.0',
    colorRegions: [
      region('saucer', 'Tatakan', `${SAUCER_SHAPE} Z`, SAUCER),
      region('body', 'Badan', BODY, CERAMIC),
      region('handle', 'Pegangan', HANDLE, CERAMIC),
      region('drink', 'Minuman', `${DRINK_SURFACE} Z`, DRINK),
    ],
    steps: [
      outline('rim', 'Gambar bibir cangkir.', [
        guide('rim', RIM),
      ], 'Lonjong di atas. Ini mulut cangkir.'),
      outline('body', 'Gambar badan cangkir.', [
        guide('body', BODY),
      ], 'Lebar di atas, lebih sempit di bawah.'),
      outline('saucer', 'Gambar tatakan.', [
        guide('saucer', SAUCER_SHAPE),
      ], 'Piring kecil di bawah cangkir.'),
      outline('handle', 'Gambar pegangan.', [
        guide('handle', HANDLE),
      ], 'Huruf C di samping kanan.'),
      detail('drink', 'Gambar minuman di dalam.', [
        guide('drink', DRINK_SURFACE),
      ], 'Lonjong kecil di bawah bibir.'),
      detail('steam', 'Gambar uap.', [
        guide('steam-left', STEAM_LEFT),
        guide('steam-right', STEAM_RIGHT),
      ], 'Dua garis melengkung di atas cangkir.'),
      colorStep('color-saucer', 'Warnai tatakan.', ['saucer'], SAUCER, 'Isi piring di bawah.', 40),
      colorStep('color-cup', 'Warnai cangkir.', ['body', 'handle'], CERAMIC, 'Badan dulu, lalu pegangan.', 48),
      colorStep('color-drink', 'Warnai minuman.', ['drink'], DRINK, 'Isi lonjong di dalam.', 28),
    ],
  }),
};

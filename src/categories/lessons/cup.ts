/**
 * A cup you can recognise: an open elliptical rim, a tapered body,
 * a C-shaped handle, a saucer, and the drink inside.
 *
 * The canvas is 1000×750. The cup sits in the middle so the lesson
 * tile, which shows the whole canvas, reads as a cup and not a sliver.
 *
 * Line steps go top, middle, bottom, then the handle on its own.
 * The body line is an open U. The rim ellipse is the opening, and the
 * body's fill closes along that same front lip so the colour stays
 * inside the line. Each filled part has one colour step. Steam is only a line.
 */

import { ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const CERAMIC = '#f6efe4';
const DRINK = '#6b3416';
const SAUCER = '#e4d3b4';

/** Open mouth. The lower arc is also the top of the body fill. */
const RIM = ellipse(500, 250, 160, 44);
/**
 * Tapered wall, wide at the rim and narrower at the foot.
 * The line the child draws stops at the rim. The fill continues
 * along the front lip so the colour meets the opening.
 */
const BODY_LINE = [
  'M 340 250',
  'L 388 515',
  'Q 500 578 612 515',
  'L 660 250',
].join(' ');
const BODY_FILL = `${BODY_LINE} A 160 44 0 1 1 340 250 Z`;
/** Thick C on the right, opening toward the cup. Outer curve, then the inner curve home. */
const HANDLE = [
  'M 646 328',
  'C 870 292 892 512 622 458',
  'C 792 438 776 358 646 328',
  'Z',
].join(' ');
const SAUCER_SHAPE = ellipse(500, 590, 300, 42);
/** Coffee surface, inside the rim and sitting on the front lip. */
const DRINK_SURFACE = ellipse(500, 262, 115, 32);
const STEAM_LEFT = 'M 430 188 C 392 148 458 116 418 66';
const STEAM_RIGHT = 'M 558 182 C 612 140 548 106 598 60';

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
      region('body', 'Badan', BODY_FILL, CERAMIC),
      region('handle', 'Pegangan', HANDLE, CERAMIC),
      region('drink', 'Minuman', `${DRINK_SURFACE} Z`, DRINK),
    ],
    steps: [
      outline('rim', 'Gambar bibir cangkir.', [
        guide('rim', RIM),
      ], 'Lonjong di atas. Ini mulut cangkir.'),
      outline('body', 'Gambar badan cangkir.', [
        guide('body', BODY_LINE),
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

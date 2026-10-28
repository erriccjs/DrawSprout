/**
 * Cow in side view, facing right. Spots are one step, drawn after the body.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const HIDE = '#f7f4ee';
const SPOT = '#2c2c2c';
const PINK = '#f2a6b3';
const HORN = '#e6d7b8';

const BODY = ellipse(400, 470, 195, 120);
const HEAD = ellipse(640, 430, 80, 58);
const SNOUT = ellipse(730, 455, 38, 28);
const HORN_LEFT = 'M 600 390 L 575 348';
const HORN_RIGHT = 'M 640 385 L 628 340';
const LEG_FRONT = 'M 520 555 L 505 690 Q 555 714 605 688 L 585 545 Z';
const LEG_BACK = 'M 250 560 L 228 692 Q 285 718 345 686 L 328 548 Z';
const UDDER = ellipse(470, 575, 36, 28);
const SPOT_A = ellipse(330, 440, 32, 26);
const SPOT_B = ellipse(430, 500, 28, 22);
const SPOT_C = ellipse(620, 415, 16, 14);
const TAIL = 'M 210 450 C 150 470 145 560 190 590';
const EAR = 'M 575 410 C 535 395 540 450 585 440';
const EYE = circle(665, 415, 8);
const PUPIL = circle(668, 416, 3);

const HIDE_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, HIDE),
  region('head', 'Kepala', `${HEAD} Z`, HIDE),
  region('leg-front', 'Kaki depan', LEG_FRONT, HIDE),
  region('leg-back', 'Kaki belakang', LEG_BACK, HIDE),
];

export const COW_CATEGORY: CategoryLesson = {
  id: 'cow',
  status: 'done',
  title: 'Sapi',
  hint: 'a cow, bull, or calf. Also called sapi.',
  facing: 'right',
  parts: [
    { id: 'hide', label: 'kulit', regionIds: HIDE_REGIONS.map((item) => item.id) },
    { id: 'spots', label: 'bercak', regionIds: ['spot-a', 'spot-b', 'spot-c'] },
    { id: 'snout', label: 'hidung', regionIds: ['snout', 'udder'] },
    { id: 'horns', label: 'tanduk', regionIds: ['horn'] },
  ],
  lesson: packageLesson({
    id: 'cow',
    title: 'Sapi',
    subtitle: 'Badan, kepala, lalu bercak',
    colorRegions: [
      ...HIDE_REGIONS,
      region('spot-a', 'Bercak badan', `${SPOT_A} Z`, SPOT),
      region('spot-b', 'Bercak perut', `${SPOT_B} Z`, SPOT),
      region('spot-c', 'Bercak kepala', `${SPOT_C} Z`, SPOT),
      region('snout', 'Hidung', `${SNOUT} Z`, PINK),
      region('udder', 'Ambing', `${UDDER} Z`, PINK),
      region('horn', 'Tanduk', 'M 598 392 L 572 346 L 584 344 L 608 388 Z', HORN),
    ],
    steps: [
      outline('body', 'Gambar badan sapi.', [
        guide('body', BODY),
      ], 'Badan besar dan panjang.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala di depan badan.'),
      outline('snout', 'Gambar hidung.', [
        guide('snout', SNOUT),
      ], 'Hidung lebar di ujung kepala.'),
      outline('horns', 'Gambar dua tanduk.', [
        guide('horn-left', HORN_LEFT),
        guide('horn-right', HORN_RIGHT),
      ], 'Tanduk pendek di atas kepala.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('udder', 'Gambar ambing.', [
        guide('udder', UDDER),
      ], 'Ambing di bawah perut.'),
      outline('spots', 'Gambar bercak.', [
        guide('spot-a', SPOT_A),
        guide('spot-b', SPOT_B),
        guide('spot-c', SPOT_C),
      ], 'Bercak di badan dan di kepala.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor di belakang badan.'),
      detail('face', 'Gambar telinga dan mata.', [
        guide('ear', EAR),
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Telinga di samping kepala, mata di depan telinga.'),
      colorStep('color-hide', 'Warnai kulit.', HIDE_REGIONS.map((item) => item.id), HIDE, 'Badan, kepala, dan kaki.', 56),
      colorStep('color-spots', 'Warnai bercak.', ['spot-a', 'spot-b', 'spot-c'], SPOT, 'Isi setiap bercak.', 20),
      colorStep('color-snout', 'Warnai hidung dan ambing.', ['snout', 'udder'], PINK, 'Hidung dulu, lalu ambing.', 22),
      colorStep('color-horns', 'Warnai tanduk.', ['horn'], HORN, 'Tanduk yang pendek.', 12),
    ],
  }),
};

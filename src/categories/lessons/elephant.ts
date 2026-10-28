/**
 * Elephant in side view, facing right. The body oval comes first.
 * The trunk is its own step so it stays one long line.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const HIDE = '#8e98a3';
const EAR_PINK = '#e7b7b0';
const TUSK = '#f4f1ea';

const BODY = ellipse(390, 455, 185, 120);
const HEAD = circle(640, 355, 95);
const EAR = ellipse(555, 300, 72, 98);
const INNER_EAR = ellipse(555, 305, 42, 62);
const TRUNK = 'M 715 410 C 790 470 800 580 710 660';
const TUSK_PATH = 'M 690 425 L 790 455';
const LEG_FRONT = 'M 500 545 L 478 690 Q 545 718 612 688 L 590 535 Z';
const LEG_BACK = 'M 250 550 L 220 692 Q 292 720 362 686 L 345 540 Z';
const TAIL = 'M 215 430 C 145 445 130 520 185 545';
const EYE = circle(690, 325, 10);
const PUPIL = circle(694, 327, 4);

const HIDE_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, HIDE),
  region('head', 'Kepala', `${HEAD} Z`, HIDE),
  region('ear', 'Telinga', `${EAR} Z`, HIDE),
  region('leg-front', 'Kaki depan', LEG_FRONT, HIDE),
  region('leg-back', 'Kaki belakang', LEG_BACK, HIDE),
];

export const ELEPHANT_CATEGORY: CategoryLesson = {
  id: 'elephant',
  status: 'done',
  title: 'Gajah',
  hint: 'an elephant. Also called gajah.',
  facing: 'right',
  parts: [
    { id: 'hide', label: 'kulit', regionIds: HIDE_REGIONS.map((item) => item.id) },
    { id: 'inner-ear', label: 'dalam telinga', regionIds: ['inner-ear'] },
    { id: 'tusk', label: 'gading', regionIds: ['tusk'] },
  ],
  lesson: packageLesson({
    id: 'elephant',
    title: 'Gajah',
    subtitle: 'Badan besar, lalu belalai',
    colorRegions: [
      ...HIDE_REGIONS,
      region('inner-ear', 'Dalam telinga', `${INNER_EAR} Z`, EAR_PINK),
      region('tusk', 'Gading', 'M 688 418 L 792 448 L 786 462 L 690 432 Z', TUSK),
    ],
    steps: [
      outline('body', 'Gambar lonjong besar untuk badan.', [
        guide('body', BODY),
      ], 'Badan gajah lebar dan rendah.'),
      outline('head', 'Gambar kepala bulat di depan badan.', [
        guide('head', HEAD),
      ], 'Kepala menempel di ujung depan badan.'),
      outline('ear', 'Gambar telinga besar.', [
        guide('ear', EAR),
      ], 'Telinga lonjong di belakang kepala.'),
      outline('trunk', 'Gambar belalai.', [
        guide('trunk', TRUNK),
      ], 'Satu garis panjang yang melengkung ke bawah.'),
      outline('tusk', 'Gambar gading.', [
        guide('tusk', TUSK_PATH),
      ], 'Garis pendek di samping belalai.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor pendek di belakang badan.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata kecil di kepala.'),
      colorStep('color-hide', 'Warnai kulit gajah.', HIDE_REGIONS.map((item) => item.id), HIDE, 'Sapukan kuas besar di badan, kepala, telinga, dan kaki.', 56),
      colorStep('color-ear', 'Warnai dalam telinga.', ['inner-ear'], EAR_PINK, 'Bagian dalam telinga, lebih kecil.', 28),
      colorStep('color-tusk', 'Warnai gading.', ['tusk'], TUSK, 'Gading yang pendek di depan.', 16),
    ],
  }),
};

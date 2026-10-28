/**
 * Duck in side view, facing right. The bill is wide so it is not a chicken.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const WHITE = '#f7f4ee';
const BILL = '#f0c43a';
const FOOT = '#e07a32';

const BODY = ellipse(430, 480, 175, 100);
const HEAD = circle(660, 370, 62);
const BILL_PATH = ellipse(770, 390, 58, 18);
const WING = ellipse(450, 475, 85, 42);
const TAIL = 'M 265 455 C 180 430 155 510 240 525';
const FOOT_PATH = 'M 470 570 L 455 650 L 400 670 L 455 658 L 470 675 L 500 655 L 470 640 Z';
const EYE = circle(685, 355, 8);
const PUPIL = circle(688, 356, 3);

const WHITE_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, WHITE),
  region('head', 'Kepala', `${HEAD} Z`, WHITE),
  region('wing', 'Sayap', `${WING} Z`, WHITE),
];

export const DUCK_CATEGORY: CategoryLesson = {
  id: 'duck',
  status: 'done',
  title: 'Bebek',
  hint: 'a duck. Also called bebek.',
  facing: 'right',
  parts: [
    { id: 'feathers', label: 'bulu', regionIds: WHITE_REGIONS.map((item) => item.id) },
    { id: 'bill', label: 'paruh', regionIds: ['bill'] },
    { id: 'foot', label: 'kaki', regionIds: ['foot'] },
  ],
  lesson: packageLesson({
    id: 'duck',
    title: 'Bebek',
    subtitle: 'Badan, kepala, lalu paruh',
    colorRegions: [
      ...WHITE_REGIONS,
      region('bill', 'Paruh', `${BILL_PATH} Z`, BILL),
      region('foot', 'Kaki', FOOT_PATH, FOOT),
    ],
    steps: [
      outline('body', 'Gambar badan bebek.', [
        guide('body', BODY),
      ], 'Badan panjang dan rendah.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala bulat di depan badan.'),
      outline('bill', 'Gambar paruh yang lebar.', [
        guide('bill', BILL_PATH),
      ], 'Paruh lonjong menempel di muka.'),
      outline('wing', 'Gambar sayap.', [
        guide('wing', WING),
      ], 'Sayap di samping badan.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor pendek di belakang.'),
      outline('foot', 'Gambar kaki.', [
        guide('foot', FOOT_PATH),
      ], 'Kaki dengan selaput di bawah badan.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata di kepala.'),
      colorStep('color-feathers', 'Warnai bulu.', WHITE_REGIONS.map((item) => item.id), WHITE, 'Badan, kepala, dan sayap.', 52),
      colorStep('color-bill', 'Warnai paruh.', ['bill'], BILL, 'Paruh yang lebar.', 16),
      colorStep('color-foot', 'Warnai kaki.', ['foot'], FOOT, 'Kaki berselaput.', 16),
    ],
  }),
};

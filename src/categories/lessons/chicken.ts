/**
 * Chicken in side view, facing right. The comb is its own step.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FEATHER = '#f4efe4';
const RED = '#d64545';
const YELLOW = '#f0c43a';

const BODY = ellipse(450, 470, 155, 110);
const HEAD = circle(620, 400, 50);
const COMB = 'M 590 365 C 605 315 630 312 640 360 C 655 315 680 322 668 375';
const BEAK = 'M 665 400 L 730 415 L 665 432 Z';
const WATTLE = ellipse(650, 450, 12, 18);
const WING = ellipse(470, 475, 72, 48);
const TAIL = 'M 310 420 C 220 350 190 450 275 500';
const LEG = 'M 470 565 L 455 680 M 455 680 L 420 690 M 455 680 L 490 695';
const EYE = circle(635, 390, 7);
const PUPIL = circle(638, 391, 3);

const FEATHER_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, FEATHER),
  region('head', 'Kepala', `${HEAD} Z`, FEATHER),
  region('wing', 'Sayap', `${WING} Z`, FEATHER),
];

export const CHICKEN_CATEGORY: CategoryLesson = {
  id: 'chicken',
  status: 'done',
  title: 'Ayam',
  hint: 'a chicken, hen, or rooster. Also called ayam.',
  facing: 'right',
  parts: [
    { id: 'feathers', label: 'bulu', regionIds: FEATHER_REGIONS.map((item) => item.id) },
    { id: 'comb', label: 'jengger', regionIds: ['comb', 'wattle'] },
    { id: 'beak', label: 'paruh', regionIds: ['beak'] },
  ],
  lesson: packageLesson({
    id: 'chicken',
    title: 'Ayam',
    subtitle: 'Badan, kepala, lalu jengger',
    colorRegions: [
      ...FEATHER_REGIONS,
      region('comb', 'Jengger', 'M 588 370 C 602 318 632 314 642 365 C 658 318 684 326 670 378 L 598 382 Z', RED),
      region('wattle', 'Gelambir', `${WATTLE} Z`, RED),
      region('beak', 'Paruh', BEAK, YELLOW),
    ],
    steps: [
      outline('body', 'Gambar badan ayam.', [
        guide('body', BODY),
      ], 'Badan lonjong, agak gemuk.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala bulat di depan badan.'),
      outline('comb', 'Gambar jengger.', [
        guide('comb', COMB),
      ], 'Jengger berlekuk di atas kepala.'),
      outline('beak', 'Gambar paruh.', [
        guide('beak', BEAK),
      ], 'Paruh lancip menghadap ke kanan.'),
      outline('wing', 'Gambar sayap.', [
        guide('wing', WING),
      ], 'Sayap lonjong di samping badan.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor naik di belakang.'),
      outline('legs', 'Gambar kaki.', [
        guide('leg', LEG),
      ], 'Kaki turun, lalu dua jari.'),
      detail('face', 'Gambar mata dan gelambir.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
        guide('wattle', WATTLE),
      ], 'Mata di kepala, gelambir di bawah paruh.'),
      colorStep('color-feathers', 'Warnai bulu.', FEATHER_REGIONS.map((item) => item.id), FEATHER, 'Badan, kepala, dan sayap.', 48),
      colorStep('color-comb', 'Warnai jengger.', ['comb', 'wattle'], RED, 'Jengger dan gelambir.', 18),
      colorStep('color-beak', 'Warnai paruh.', ['beak'], YELLOW, 'Paruh yang lancip.', 14),
    ],
  }),
};

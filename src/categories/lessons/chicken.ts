/**
 * Chicken in side view, facing right. The comb sits on the head,
 * the wattle hangs under the beak, and each foot has three toes.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FEATHER = '#f4efe4';
const RED = '#d64545';
const YELLOW = '#f0c43a';

const BODY = ellipse(450, 480, 155, 108);
const HEAD = circle(630, 400, 48);
const COMB = 'M 595 365 C 588 318 622 305 628 358 C 634 300 668 302 662 360 C 674 312 708 328 690 372 C 665 368 625 375 595 365 Z';
const WATTLE = 'M 648 438 C 628 458 626 492 650 500 C 674 492 670 458 655 440 Z';
const BEAK = 'M 672 395 L 742 412 L 670 430 Z';
const WING = ellipse(465, 485, 70, 46);
const TAIL = 'M 310 430 C 215 355 185 460 280 510';
const LEG_BACK = 'M 400 555 L 378 655 L 348 668 L 378 662 L 362 688 L 388 664 L 400 692 L 408 662 L 438 672 L 418 650 L 428 555 Z';
const LEG_FRONT = 'M 500 560 L 488 658 L 458 672 L 488 666 L 472 692 L 498 668 L 512 696 L 518 666 L 548 676 L 528 652 L 532 558 Z';
const EYE = circle(645, 388, 7);
const PUPIL = circle(648, 389, 3);

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
    { id: 'legs', label: 'kaki', regionIds: ['leg-back', 'leg-front'] },
  ],
  lesson: packageLesson({
    id: 'chicken',
    title: 'Ayam',
    subtitle: 'Badan, kepala, lalu jengger',
    colorRegions: [
      ...FEATHER_REGIONS,
      region('comb', 'Jengger', COMB, RED),
      region('wattle', 'Gelambir', WATTLE, RED),
      region('beak', 'Paruh', BEAK, YELLOW),
      region('leg-back', 'Kaki belakang', LEG_BACK, YELLOW),
      region('leg-front', 'Kaki depan', LEG_FRONT, YELLOW),
    ],
    steps: [
      outline('body', 'Gambar badan ayam.', [
        guide('body', BODY),
      ], 'Badan lonjong, agak gemuk.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala bulat, menempel di depan badan.'),
      outline('comb', 'Gambar jengger.', [
        guide('comb', COMB),
      ], 'Tiga lengkung di atas kepala.'),
      outline('wattle', 'Gambar gelambir.', [
        guide('wattle', WATTLE),
      ], 'Gelambir menggantung di bawah paruh.'),
      outline('beak', 'Gambar paruh.', [
        guide('beak', BEAK),
      ], 'Paruh lancip menghadap ke kanan.'),
      outline('wing', 'Gambar sayap.', [
        guide('wing', WING),
      ], 'Sayap lonjong di samping badan.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor naik di belakang.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Setiap kaki punya tiga jari.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata di kepala.'),
      colorStep('color-feathers', 'Warnai bulu.', FEATHER_REGIONS.map((item) => item.id), FEATHER, 'Badan, kepala, dan sayap.', 48),
      colorStep('color-comb', 'Warnai jengger.', ['comb', 'wattle'], RED, 'Jengger dan gelambir.', 18),
      colorStep('color-beak', 'Warnai paruh.', ['beak'], YELLOW, 'Paruh yang lancip.', 14),
      colorStep('color-legs', 'Warnai kaki.', ['leg-back', 'leg-front'], YELLOW, 'Dua kaki sampai ke jari.', 16),
    ],
  }),
};

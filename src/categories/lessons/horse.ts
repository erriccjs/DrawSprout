/**
 * Horse in side view, facing right. Neck and head are separate from the body
 * so the animal stays long, not round.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const COAT = '#8a5a32';
const MANE = '#3a2e28';

const BODY = ellipse(390, 470, 180, 95);
const NECK = 'M 530 450 L 610 270 L 675 295 L 590 480 Z';
const HEAD = ellipse(700, 285, 72, 36);
const MANE_PATH = 'M 600 290 C 560 250 545 340 575 420';
const LEG_FRONT = 'M 500 530 L 488 690 Q 530 712 572 688 L 555 525 Z';
const LEG_BACK = 'M 250 535 L 232 692 Q 278 716 324 688 L 310 528 Z';
const TAIL = 'M 215 450 C 140 470 120 580 180 640';
const EAR = 'M 655 255 L 642 215 L 678 250 Z';
const EYE = circle(715, 275, 7);
const PUPIL = circle(718, 276, 3);
const NOSTRIL = circle(760, 292, 4);

const COAT_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, COAT),
  region('neck', 'Leher', NECK, COAT),
  region('head', 'Kepala', `${HEAD} Z`, COAT),
  region('leg-front', 'Kaki depan', LEG_FRONT, COAT),
  region('leg-back', 'Kaki belakang', LEG_BACK, COAT),
  region('ear', 'Telinga', EAR, COAT),
];

export const HORSE_CATEGORY: CategoryLesson = {
  id: 'horse',
  status: 'done',
  title: 'Kuda',
  hint: 'a horse. Also called kuda.',
  facing: 'right',
  parts: [
    { id: 'coat', label: 'bulu', regionIds: COAT_REGIONS.map((item) => item.id) },
    { id: 'mane', label: 'surai', regionIds: ['mane', 'tail'] },
  ],
  lesson: packageLesson({
    id: 'horse',
    title: 'Kuda',
    subtitle: 'Badan, leher, lalu kepala',
    colorRegions: [
      ...COAT_REGIONS,
      region('mane', 'Surai', 'M 590 280 C 545 250 530 360 575 450 L 600 430 C 560 350 575 280 620 295 Z', MANE),
      region('tail', 'Ekor', 'M 220 445 C 145 470 125 590 185 645 L 200 620 C 155 560 165 490 230 460 Z', MANE),
    ],
    steps: [
      outline('body', 'Gambar badan kuda.', [
        guide('body', BODY),
      ], 'Badan panjang dan tidak terlalu gemuk.'),
      outline('neck', 'Gambar leher.', [
        guide('neck', NECK),
      ], 'Leher naik dari depan badan.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala panjang di ujung leher.'),
      outline('mane', 'Gambar surai.', [
        guide('mane', MANE_PATH),
      ], 'Surai mengikuti leher.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor panjang di belakang.'),
      detail('face', 'Gambar telinga, mata, dan hidung.', [
        guide('ear', EAR),
        guide('eye', EYE),
        guide('pupil', PUPIL),
        guide('nostril', NOSTRIL),
      ], 'Telinga di atas, mata di kepala, hidung di ujung.'),
      colorStep('color-coat', 'Warnai bulu kuda.', COAT_REGIONS.map((item) => item.id), COAT, 'Badan, leher, kepala, kaki, dan telinga.', 52),
      colorStep('color-mane', 'Warnai surai dan ekor.', ['mane', 'tail'], MANE, 'Surai di leher, lalu ekor.', 24),
    ],
  }),
};

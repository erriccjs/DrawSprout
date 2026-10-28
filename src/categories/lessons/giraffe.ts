/**
 * Giraffe in side view, facing right. The neck is one long shape
 * so the animal reads as tall, not as a stacked toy.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const COAT = '#e6c15a';
const SPOT = '#8a5a32';
const DARK = '#3a2e28';

const BODY = ellipse(340, 530, 145, 90);
const NECK = 'M 450 500 L 545 175 L 625 190 L 535 530 Z';
const HEAD = ellipse(655, 188, 68, 38);
const OSS_LEFT = ellipse(630, 145, 8, 20);
const OSS_RIGHT = ellipse(668, 138, 8, 20);
const LEG_FRONT = 'M 430 590 L 418 700 Q 455 718 492 698 L 478 585 Z';
const LEG_BACK = 'M 230 595 L 210 702 Q 250 722 292 698 L 280 588 Z';
const SPOT_A = ellipse(300, 500, 28, 22);
const SPOT_B = ellipse(370, 545, 24, 18);
const SPOT_C = ellipse(500, 360, 18, 28);
const SPOT_D = ellipse(540, 250, 16, 26);
const TAIL = 'M 200 520 C 140 540 130 610 175 630';
const EYE = circle(685, 180, 7);
const PUPIL = circle(688, 181, 3);

const COAT_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, COAT),
  region('neck', 'Leher', NECK, COAT),
  region('head', 'Kepala', `${HEAD} Z`, COAT),
  region('leg-front', 'Kaki depan', LEG_FRONT, COAT),
  region('leg-back', 'Kaki belakang', LEG_BACK, COAT),
];

export const GIRAFFE_CATEGORY: CategoryLesson = {
  id: 'giraffe',
  status: 'done',
  title: 'Jerapah',
  hint: 'a giraffe. Also called jerapah.',
  facing: 'right',
  parts: [
    { id: 'coat', label: 'bulu', regionIds: COAT_REGIONS.map((item) => item.id) },
    { id: 'spots', label: 'bercak', regionIds: ['spot-a', 'spot-b', 'spot-c', 'spot-d'] },
    { id: 'horns', label: 'tanduk', regionIds: ['oss-left', 'oss-right'] },
  ],
  lesson: packageLesson({
    id: 'giraffe',
    title: 'Jerapah',
    subtitle: 'Badan, leher panjang, lalu kepala',
    colorRegions: [
      ...COAT_REGIONS,
      region('spot-a', 'Bercak badan', `${SPOT_A} Z`, SPOT),
      region('spot-b', 'Bercak perut', `${SPOT_B} Z`, SPOT),
      region('spot-c', 'Bercak leher', `${SPOT_C} Z`, SPOT),
      region('spot-d', 'Bercak leher atas', `${SPOT_D} Z`, SPOT),
      region('oss-left', 'Tanduk kiri', `${OSS_LEFT} Z`, DARK),
      region('oss-right', 'Tanduk kanan', `${OSS_RIGHT} Z`, DARK),
    ],
    steps: [
      outline('body', 'Gambar lonjong untuk badan.', [
        guide('body', BODY),
      ], 'Badan jerapah pendek dan rendah.'),
      outline('neck', 'Gambar leher yang panjang.', [
        guide('neck', NECK),
      ], 'Leher naik tinggi dari badan.'),
      outline('head', 'Gambar kepala di ujung leher.', [
        guide('head', HEAD),
      ], 'Kepala lonjong, menghadap ke kanan.'),
      outline('horns', 'Gambar dua tanduk kecil.', [
        guide('oss-left', OSS_LEFT),
        guide('oss-right', OSS_RIGHT),
      ], 'Dua bentuk kecil di atas kepala.'),
      outline('legs', 'Gambar dua kaki panjang.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('spots', 'Gambar bercak.', [
        guide('spot-a', SPOT_A),
        guide('spot-b', SPOT_B),
        guide('spot-c', SPOT_C),
        guide('spot-d', SPOT_D),
      ], 'Bercak di badan dan di leher.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor tipis di belakang.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata di kepala.'),
      colorStep('color-coat', 'Warnai bulu jerapah.', COAT_REGIONS.map((item) => item.id), COAT, 'Badan, leher, kepala, dan kaki.', 52),
      colorStep('color-spots', 'Warnai bercak.', ['spot-a', 'spot-b', 'spot-c', 'spot-d'], SPOT, 'Isi setiap bercak.', 22),
      colorStep('color-horns', 'Warnai tanduk.', ['oss-left', 'oss-right'], DARK, 'Dua tanduk kecil.', 14),
    ],
  }),
};

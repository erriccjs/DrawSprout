/**
 * Giraffe in side view, facing right. The neck is one curved shape,
 * wide at the shoulder and narrow under the head.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const COAT = '#e6c15a';
const SPOT = '#8a5a32';
const DARK = '#3a2e28';

const BODY = ellipse(330, 545, 150, 88);
const NECK = 'M 415 520 C 510 500 560 420 575 330 C 590 245 640 190 690 168 L 718 202 C 665 225 610 290 585 375 C 545 480 490 530 445 548 Z';
const HEAD = ellipse(770, 175, 72, 36);
const EAR_FAR = 'M 700 168 C 675 148 688 125 718 152 Z';
const EAR_NEAR = 'M 740 155 C 728 128 760 122 772 152 Z';
const OSS_LEFT = 'M 735 148 L 727 114 C 727 100 753 100 753 114 L 745 148 Z';
const OSS_RIGHT = 'M 778 142 L 772 106 C 772 92 798 92 798 106 L 790 142 Z';
const LEG_FRONT = 'M 420 600 L 408 708 Q 448 726 488 706 L 472 595 Z';
const LEG_BACK = 'M 220 605 L 202 710 Q 245 730 288 706 L 274 598 Z';
const SPOT_A = 'M 250 520 C 230 500 270 485 305 505 C 325 525 300 555 265 548 C 245 542 242 530 250 520 Z';
const SPOT_B = 'M 340 560 C 325 545 355 530 385 548 C 400 568 375 590 345 582 C 330 576 328 568 340 560 Z';
const SPOT_C = 'M 390 500 C 378 485 410 475 428 495 C 438 512 420 530 398 524 C 385 518 382 508 390 500 Z';
const SPOT_D = 'M 470 430 C 458 410 485 395 505 418 C 515 438 495 455 475 448 C 462 442 460 436 470 430 Z';
const SPOT_E = 'M 520 340 C 508 322 535 308 552 328 C 560 346 542 362 525 356 C 514 350 512 346 520 340 Z';
const SPOT_F = 'M 575 270 C 565 255 590 245 605 262 C 612 278 595 292 580 286 C 570 280 568 276 575 270 Z';
const SPOT_G = 'M 745 168 C 735 156 760 148 773 163 C 779 176 763 186 750 180 C 741 176 739 172 745 168 Z';
const TAIL = 'M 190 530 C 130 545 115 620 165 650';
const TUFT = circle(168, 658, 14);
const EYE = circle(795, 168, 8);
const PUPIL = circle(798, 169, 3);

const COAT_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, COAT),
  region('neck', 'Leher', NECK, COAT),
  region('head', 'Kepala', `${HEAD} Z`, COAT),
  region('ear-far', 'Telinga jauh', EAR_FAR, COAT),
  region('ear-near', 'Telinga dekat', EAR_NEAR, COAT),
  region('leg-front', 'Kaki depan', LEG_FRONT, COAT),
  region('leg-back', 'Kaki belakang', LEG_BACK, COAT),
];

const SPOT_IDS = ['spot-a', 'spot-b', 'spot-c', 'spot-d', 'spot-e', 'spot-f', 'spot-g'] as const;

export const GIRAFFE_CATEGORY: CategoryLesson = {
  id: 'giraffe',
  status: 'done',
  title: 'Jerapah',
  hint: 'a giraffe. Also called jerapah.',
  facing: 'right',
  parts: [
    { id: 'coat', label: 'bulu', regionIds: COAT_REGIONS.map((item) => item.id) },
    { id: 'spots', label: 'bercak', regionIds: [...SPOT_IDS] },
    { id: 'horns', label: 'tanduk', regionIds: ['oss-left', 'oss-right'] },
  ],
  lesson: packageLesson({
    id: 'giraffe',
    title: 'Jerapah',
    subtitle: 'Badan, leher panjang, lalu kepala',
    colorRegions: [
      ...COAT_REGIONS,
      region('spot-a', 'Bercak belakang', SPOT_A, SPOT),
      region('spot-b', 'Bercak perut', SPOT_B, SPOT),
      region('spot-c', 'Bercak pundak', SPOT_C, SPOT),
      region('spot-d', 'Bercak leher bawah', SPOT_D, SPOT),
      region('spot-e', 'Bercak leher', SPOT_E, SPOT),
      region('spot-f', 'Bercak leher atas', SPOT_F, SPOT),
      region('spot-g', 'Bercak kepala', SPOT_G, SPOT),
      region('oss-left', 'Tanduk kiri', OSS_LEFT, DARK),
      region('oss-right', 'Tanduk kanan', OSS_RIGHT, DARK),
    ],
    steps: [
      outline('body', 'Gambar lonjong untuk badan.', [
        guide('body', BODY),
      ], 'Badan jerapah pendek dan rendah.'),
      outline('neck', 'Gambar leher yang panjang.', [
        guide('neck', NECK),
      ], 'Lebar di pundak, lalu menyempit dan melengkung ke atas.'),
      outline('head', 'Gambar kepala di ujung leher.', [
        guide('head', HEAD),
      ], 'Kepala lonjong, menempel di ujung leher.'),
      outline('ears', 'Gambar dua telinga.', [
        guide('ear-far', EAR_FAR),
        guide('ear-near', EAR_NEAR),
      ], 'Telinga kecil di samping kepala.'),
      outline('horns', 'Gambar dua tanduk kecil.', [
        guide('oss-left', OSS_LEFT),
        guide('oss-right', OSS_RIGHT),
      ], 'Batang kecil dengan ujung bulat, di atas kepala.'),
      outline('legs', 'Gambar dua kaki panjang.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('spots', 'Gambar bercak.', [
        guide('spot-a', SPOT_A),
        guide('spot-b', SPOT_B),
        guide('spot-c', SPOT_C),
        guide('spot-d', SPOT_D),
        guide('spot-e', SPOT_E),
        guide('spot-f', SPOT_F),
        guide('spot-g', SPOT_G),
      ], 'Bercak mengikuti badan, leher, dan kepala.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
        guide('tuft', TUFT),
      ], 'Ekor tipis, lalu jumbai di ujungnya.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata di kepala.'),
      colorStep('color-coat', 'Warnai bulu jerapah.', COAT_REGIONS.map((item) => item.id), COAT, 'Badan, leher, kepala, telinga, dan kaki.', 52),
      colorStep('color-spots', 'Warnai bercak.', [...SPOT_IDS], SPOT, 'Isi setiap bercak.', 18),
      colorStep('color-horns', 'Warnai tanduk.', ['oss-left', 'oss-right'], DARK, 'Dua tanduk kecil.', 12),
    ],
  }),
};

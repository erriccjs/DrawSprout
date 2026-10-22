/**
 * A sitting rabbit, side view, facing right. The body oval is step 1
 * because it is bigger than the head. Both ears are one step.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FUR = '#d7b48a';
const PINK = '#f2a6b3';

const BODY = ellipse(450, 520, 155, 140);
const HEAD = circle(600, 370, 90);
const EAR_FRONT = 'M 630 320 C 620 170 665 50 705 65 C 740 85 710 210 660 345 Z';
const EAR_BACK = 'M 575 300 C 540 160 575 40 615 48 C 650 60 655 190 620 320 Z';
const INNER_FRONT = 'M 650 300 C 648 200 678 115 700 125 C 720 140 698 230 668 325 Z';
const INNER_BACK = 'M 590 290 C 568 190 590 110 615 115 C 638 125 640 200 625 305 Z';
const TAIL = circle(340, 490, 40);
const PAW_FRONT = ellipse(610, 668, 50, 30);
const PAW_BACK = ellipse(400, 662, 78, 26);
const EYE = circle(640, 350, 12);
const PUPIL = circle(644, 352, 5);
const NOSE = circle(682, 398, 11);
const MOUTH = 'M 672 414 Q 640 440 612 416';

const FUR_REGIONS = ['body', 'head', 'ear-front', 'ear-back', 'tail', 'paw-front', 'paw-back'];
const PINK_REGIONS = ['inner-front', 'inner-back', 'nose'];

export const RABBIT_CATEGORY: CategoryLesson = {
  id: 'rabbit',
  status: 'done',
  title: 'Kelinci',
  hint: 'a rabbit or bunny, sitting',
  facing: 'right',
  parts: [
    { id: 'fur', label: 'bulu', regionIds: FUR_REGIONS },
    { id: 'pink', label: 'telinga dan hidung', regionIds: PINK_REGIONS },
  ],
  lesson: packageLesson({
    id: 'rabbit',
    title: 'Kelinci',
    subtitle: 'Badan bulat, kepala, lalu telinga panjang',
    colorRegions: [
      region('body', 'Badan', `${BODY} Z`, FUR),
      region('head', 'Kepala', `${HEAD} Z`, FUR),
      region('ear-back', 'Telinga belakang', EAR_BACK, FUR),
      region('ear-front', 'Telinga depan', EAR_FRONT, FUR),
      region('tail', 'Ekor', `${TAIL} Z`, FUR),
      region('paw-back', 'Kaki belakang', `${PAW_BACK} Z`, FUR),
      region('paw-front', 'Kaki depan', `${PAW_FRONT} Z`, FUR),
      region('inner-back', 'Dalam telinga belakang', INNER_BACK, PINK),
      region('inner-front', 'Dalam telinga depan', INNER_FRONT, PINK),
      region('nose', 'Hidung', `${NOSE} Z`, PINK),
    ],
    steps: [
      outline('body', 'Gambar bentuk lonjong besar untuk badan.', [
        guide('body', BODY),
      ], 'Badan kelinci duduk, lebih besar dari kepalanya.'),
      outline('head', 'Gambar kepala bulat di depan badan.', [
        guide('head', HEAD),
      ], 'Lingkaran yang menempel di atas badan.'),
      outline('ears', 'Gambar dua telinga panjang.', [
        guide('ear-back', EAR_BACK),
        guide('ear-front', EAR_FRONT),
      ], 'Telinga belakang dulu, lalu telinga depan yang lebih besar.'),
      outline('tail', 'Gambar ekor di belakang badan.', [
        guide('tail', TAIL),
      ], 'Lingkaran kecil yang menempel di punggung.'),
      outline('paws', 'Gambar dua kaki di bawah badan.', [
        guide('paw-back', PAW_BACK),
        guide('paw-front', PAW_FRONT),
      ], 'Kaki belakang yang pipih, lalu kaki depan.'),
      detail('face', 'Gambar mata, hidung, dan mulut.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
        guide('nose', NOSE),
        guide('mouth', MOUTH),
      ], 'Mata di kepala, hidung di ujung muka, mulut di bawahnya.'),
      colorStep('color-fur', 'Warnai bulu kelinci.', FUR_REGIONS, FUR, 'Sapukan kuas besar. Warna dari fotomu juga boleh.', 52),
      colorStep('color-pink', 'Warnai dalam telinga dan hidung.', PINK_REGIONS, PINK, 'Bagian dalam kedua telinga, lalu hidung.', 20),
    ],
  }),
};

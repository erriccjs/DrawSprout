/**
 * Sitting dog, side view, facing right. Head circle first, then the body,
 * then one part at a time down to the face.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FUR = '#c6844a';
const NOSE_COLOR = '#3a3a3a';

const HEAD = circle(400, 230, 105);
const BODY = ellipse(455, 485, 165, 150);
const SNOUT = ellipse(530, 285, 82, 52);
const EAR = 'M 345 155 C 255 145 245 270 315 325 C 345 285 360 210 370 170 Z';
const EAR_LINE = 'M 340 190 C 300 230 305 285 345 310';
const LEG_FRONT = 'M 500 560 L 488 700 Q 535 728 582 698 L 562 550 Z';
const LEG_BACK = 'M 360 575 L 338 698 Q 392 726 446 692 L 424 558 Z';
const TAIL = 'M 310 470 C 175 490 145 360 230 325 C 260 375 275 440 330 455 Z';
const EYE = circle(445, 210, 14);
const PUPIL = circle(451, 212, 6);
const NOSE = circle(598, 282, 16);
const MOUTH = 'M 545 320 Q 505 352 468 325';

const FUR_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, FUR),
  region('head', 'Kepala', `${HEAD} Z`, FUR),
  region('ear', 'Telinga', EAR, FUR),
  region('snout', 'Moncong', `${SNOUT} Z`, FUR),
  region('leg-back', 'Kaki belakang', LEG_BACK, FUR),
  region('leg-front', 'Kaki depan', LEG_FRONT, FUR),
  region('tail', 'Ekor', TAIL, FUR),
];

export const DOG_CATEGORY: CategoryLesson = {
  id: 'dog',
  status: 'done',
  title: 'Anjing',
  hint: 'a dog or puppy',
  facing: 'right',
  parts: [
    { id: 'fur', label: 'bulu', regionIds: FUR_REGIONS.map((item) => item.id) },
    { id: 'nose', label: 'hidung', regionIds: ['nose'] },
  ],
  lesson: packageLesson({
    id: 'dog',
    title: 'Anjing',
    subtitle: 'Lingkaran kepala, badan, lalu moncong',
    colorRegions: [...FUR_REGIONS, region('nose', 'Hidung', `${NOSE} Z`, NOSE_COLOR)],
    steps: [
      outline('head', 'Gambar lingkaran besar untuk kepala.', [
        guide('head', HEAD),
      ], 'Kepala anjing duduk di bagian atas.'),
      outline('body', 'Gambar badan lonjong di bawah kepala.', [
        guide('body', BODY),
      ], 'Badan lebih besar dari kepala dan sedikit ke depan.'),
      outline('snout', 'Gambar moncong di depan kepala.', [
        guide('snout', SNOUT),
      ], 'Bentuk telur kecil yang menempel di muka.'),
      outline('ear', 'Gambar telinga yang menjuntai.', [
        guide('ear', EAR),
        guide('ear-line', EAR_LINE),
      ], 'Telinga panjang di belakang kepala, lalu satu garis di dalamnya.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan yang lebih ke muka.'),
      detail('tail', 'Gambar ekor di belakang badan.', [
        guide('tail', TAIL),
      ], 'Ekor naik dan melengkung.', 6),
      detail('face', 'Gambar mata, hidung, dan mulut.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
        guide('nose', NOSE),
        guide('mouth', MOUTH),
      ], 'Mata di kepala, hidung di ujung moncong, mulut di bawahnya.'),
      colorStep('color-fur', 'Warnai bulu anjing.', FUR_REGIONS.map((item) => item.id), FUR, 'Sapukan kuas besar. Warna dari fotomu juga boleh.', 52),
      colorStep('color-nose', 'Warnai hidung.', ['nose'], NOSE_COLOR, 'Hidung kecil, jadi kuasnya lebih kecil.', 16),
    ],
  }),
};

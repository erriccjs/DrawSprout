/**
 * A bird in side view, facing right. Step 1 is the body oval. The tail,
 * wing, and beak fills overlap the body so the colour does not leave a gap.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FEATHER = '#4c92c8';
const BEAK = '#e8a23a';

const BODY = ellipse(490, 430, 175, 105);
const HEAD = circle(680, 350, 68);
const TAIL = 'M 360 385 C 220 345 150 425 200 485 C 255 510 330 475 375 450 Z';
const WING = 'M 420 400 C 510 345 620 365 635 430 C 580 480 460 465 420 400 Z';
const BEAK_SHAPE = 'M 730 338 L 865 358 L 735 380 Z';
const EYE = circle(700, 328, 11);
const PUPIL = circle(704, 328, 5);
const LEG_FRONT = 'M 505 520 L 490 650';
const FOOT_FRONT_BACK = 'M 490 650 L 450 664';
const FOOT_FRONT_TOE = 'M 490 650 L 530 668';
const LEG_BACK = 'M 415 515 L 395 640';
const FOOT_BACK_BACK = 'M 395 640 L 360 652';
const FOOT_BACK_TOE = 'M 395 640 L 435 658';

const BODY_REGIONS = ['body', 'head', 'tail', 'wing'];

export const BIRD_CATEGORY: CategoryLesson = {
  id: 'bird',
  status: 'done',
  title: 'Burung',
  hint: 'a bird, side view',
  facing: 'right',
  parts: [
    { id: 'body', label: 'badan', regionIds: BODY_REGIONS },
    { id: 'beak', label: 'paruh', regionIds: ['beak'] },
  ],
  lesson: packageLesson({
    id: 'bird',
    title: 'Burung',
    subtitle: 'Badan lonjong, kepala, lalu ekor',
    colorRegions: [
      region('body', 'Badan', `${BODY} Z`, FEATHER),
      region('head', 'Kepala', `${HEAD} Z`, FEATHER),
      region('tail', 'Ekor', TAIL, FEATHER),
      region('wing', 'Sayap', WING, FEATHER),
      region('beak', 'Paruh', BEAK_SHAPE, BEAK),
    ],
    steps: [
      outline('body', 'Gambar bentuk lonjong besar untuk badan.', [
        guide('body', BODY),
      ], 'Lebih panjang ke samping.'),
      outline('head', 'Gambar kepala bulat di depan badan.', [
        guide('head', HEAD),
      ], 'Lingkaran yang menempel di ujung depan.'),
      outline('tail', 'Gambar ekor di belakang badan.', [
        guide('tail', TAIL),
      ], 'Ekor melebar ke kiri.'),
      outline('wing', 'Gambar sayap di tengah badan.', [
        guide('wing', WING),
      ], 'Bentuk lonjong yang menempel di badan.'),
      detail('beak', 'Gambar paruh di depan kepala.', [
        guide('beak', BEAK_SHAPE),
      ], 'Segitiga kecil yang menempel di muka.'),
      detail('eye', 'Gambar mata di kepala.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Lingkaran, dan lingkaran lebih kecil di dalamnya.'),
      detail('legs', 'Gambar dua kaki di bawah badan.', [
        guide('leg-front', LEG_FRONT),
        guide('foot-front-back', FOOT_FRONT_BACK),
        guide('foot-front-toe', FOOT_FRONT_TOE),
        guide('leg-back', LEG_BACK),
        guide('foot-back-back', FOOT_BACK_BACK),
        guide('foot-back-toe', FOOT_BACK_TOE),
      ], 'Dua garis ke bawah, masing-masing dengan dua jari.', 5),
      colorStep('color-body', 'Warnai badan burung.', BODY_REGIONS, FEATHER, 'Badan dulu, lalu kepala, ekor, dan sayap.', 48),
      colorStep('color-beak', 'Warnai paruh.', ['beak'], BEAK, 'Isi segitiga di depan kepala.', 18),
    ],
  }),
};

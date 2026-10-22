/**
 * A turtle in side view, facing right. Step 1 is the shell, the biggest
 * shape. The head, legs, and tail overlap the shell.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const SHELL = '#8d6a3e';
const SKIN = '#6aaa4a';

const SHELL_SHAPE = ellipse(470, 410, 200, 130);
const HEAD = circle(690, 370, 58);
const LEG_FRONT = 'M 620 470 C 700 500 770 560 775 515 C 740 490 680 485 625 450 Z';
const LEG_BACK = 'M 350 475 C 250 510 195 575 250 598 C 310 585 350 530 370 485 Z';
const TAIL = 'M 310 400 C 190 375 160 435 210 458 C 255 470 300 445 320 420 Z';
const SEAM_V = 'M 470 280 L 470 540';
const SEAM_UPPER = 'M 340 345 Q 470 395 620 340';
const SEAM_LOWER = 'M 330 475 Q 470 430 630 470';
const SEAM_LEFT = 'M 385 300 Q 350 410 395 520';
const SEAM_RIGHT = 'M 565 300 Q 610 410 555 520';
const EYE = circle(722, 352, 8);
const PUPIL = circle(725, 352, 3);

const SKIN_REGIONS = ['head', 'leg-front', 'leg-back', 'tail'];

export const TURTLE_CATEGORY: CategoryLesson = {
  id: 'turtle',
  status: 'done',
  title: 'Kura-kura',
  hint: 'a turtle, side view',
  facing: 'right',
  parts: [
    { id: 'shell', label: 'tempurung', regionIds: ['shell'] },
    { id: 'body', label: 'kepala dan kaki', regionIds: SKIN_REGIONS },
  ],
  lesson: packageLesson({
    id: 'turtle',
    title: 'Kura-kura',
    subtitle: 'Tempurung lonjong, kepala, lalu kaki',
    colorRegions: [
      region('shell', 'Tempurung', `${SHELL_SHAPE} Z`, SHELL),
      region('head', 'Kepala', `${HEAD} Z`, SKIN),
      region('leg-back', 'Kaki belakang', LEG_BACK, SKIN),
      region('leg-front', 'Kaki depan', LEG_FRONT, SKIN),
      region('tail', 'Ekor', TAIL, SKIN),
    ],
    steps: [
      outline('shell', 'Gambar bentuk lonjong besar untuk tempurung.', [
        guide('shell', SHELL_SHAPE),
      ], 'Ini bagian kura-kura yang paling besar.'),
      outline('head', 'Gambar kepala di depan tempurung.', [
        guide('head', HEAD),
      ], 'Lingkaran yang menempel di ujung depan.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('tail', 'Gambar ekor di belakang tempurung.', [
        guide('tail', TAIL),
      ], 'Ekor pendek dan lancip.'),
      detail('seams', 'Gambar garis pada tempurung.', [
        guide('seam-v', SEAM_V),
        guide('seam-upper', SEAM_UPPER),
        guide('seam-lower', SEAM_LOWER),
        guide('seam-left', SEAM_LEFT),
        guide('seam-right', SEAM_RIGHT),
      ], 'Garis-garis ini membagi tempurung.'),
      detail('eye', 'Gambar mata di kepala.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Lingkaran kecil di depan kepala.'),
      colorStep('color-shell', 'Warnai tempurung.', ['shell'], SHELL, 'Isi bentuk lonjong yang besar.', 52),
      colorStep('color-body', 'Warnai kepala, kaki, dan ekor.', SKIN_REGIONS, SKIN, 'Kepala dulu, lalu kaki dan ekor.', 36),
    ],
  }),
};

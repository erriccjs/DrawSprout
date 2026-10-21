/**
 * Side-view fish facing right. Step 1 is the body oval. The tail and the
 * fins are the next large parts. No bubbles and no smile.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const BODY_COLOR = '#f0913c';
const FIN_COLOR = '#f6b24a';

const BODY = ellipse(560, 385, 210, 125);
const TAIL = 'M 380 310 L 155 185 L 215 385 L 155 575 L 380 460';
const FIN_TOP = 'M 470 285 C 530 145 670 160 680 290 C 600 305 520 310 470 285 Z';
const FIN_BOTTOM = 'M 490 490 C 540 630 680 610 690 495 C 600 510 530 515 490 490 Z';
const EYE = circle(690, 355, 22);
const PUPIL = circle(698, 355, 9);
const GILL = 'M 630 300 Q 575 385 630 475';
const MOUTH = 'M 745 410 Q 780 435 800 405';

const FIN_REGIONS = [
  region('tail', 'Ekor', `${TAIL} Z`, FIN_COLOR),
  region('fin-top', 'Sirip atas', FIN_TOP, FIN_COLOR),
  region('fin-bottom', 'Sirip bawah', FIN_BOTTOM, FIN_COLOR),
];

export const FISH_CATEGORY: CategoryLesson = {
  id: 'fish',
  status: 'done',
  title: 'Ikan',
  hint: 'a fish, side view',
  facing: 'right',
  parts: [
    { id: 'body', label: 'badan', regionIds: ['body'] },
    { id: 'fins', label: 'sirip dan ekor', regionIds: FIN_REGIONS.map((item) => item.id) },
  ],
  lesson: packageLesson({
    id: 'fish',
    title: 'Ikan',
    subtitle: 'Badan lonjong, ekor, lalu sirip',
    colorRegions: [
      region('body', 'Badan', `${BODY} Z`, BODY_COLOR),
      ...FIN_REGIONS,
    ],
    steps: [
      outline('body', 'Gambar bentuk lonjong besar untuk badan ikan.', [
        guide('body', BODY),
      ], 'Lebih panjang ke samping. Ujung kanan adalah kepala.'),
      outline('tail', 'Gambar ekor di belakang badan.', [
        guide('tail', TAIL),
      ], 'Ekor seperti kipas dengan lekuk di tengah.'),
      outline('fins', 'Gambar sirip atas dan sirip bawah.', [
        guide('fin-top', FIN_TOP),
        guide('fin-bottom', FIN_BOTTOM),
      ], 'Masing-masing seperti segitiga yang melengkung.'),
      detail('eye', 'Gambar mata di dekat kepala.', [
        guide('eye-guide', 'M 430 385 L 730 385', 'construction'),
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Garis putus-putus hanya penolong. Mata bulat di depan.'),
      detail('gill', 'Gambar garis insang di belakang mata.', [
        guide('gill', GILL),
      ], 'Satu lengkung pendek.'),
      detail('mouth', 'Gambar mulut di ujung kepala.', [
        guide('mouth', MOUTH),
      ], 'Lengkung kecil di depan.'),
      colorStep('color-body', 'Warnai badan ikan.', ['body'], BODY_COLOR, 'Sapukan kuas dari ekor ke kepala.', 52),
      colorStep('color-fins', 'Warnai ekor dan sirip.', FIN_REGIONS.map((item) => item.id), FIN_COLOR, 'Ekor dulu, lalu sirip atas dan bawah.', 36),
    ],
  }),
};

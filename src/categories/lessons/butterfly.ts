/**
 * A butterfly seen from above. Step 1 is both upper wings as one shape,
 * then the lower wings, the body, the antennae, and the spots.
 * The picker already has a lesson id `butterfly`, so this package is
 * `butterfly-front`. The matcher still calls the category `butterfly`.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const WING = '#f0a03a';
const LOWER = '#e07a2f';
const BODY = '#3d2c22';
const SPOT = '#f6e7a8';

const UPPER = 'M 470 255 C 340 80 130 155 165 320 C 190 455 360 485 470 395 C 490 355 510 355 530 395 C 640 485 810 455 835 320 C 870 155 660 80 530 255 C 510 295 490 295 470 255 Z';
const LOWER_WINGS = 'M 475 400 C 360 430 230 530 275 640 C 315 725 430 690 495 555 C 510 590 530 690 565 690 C 690 725 770 640 725 530 C 640 430 530 400 530 465 C 510 425 490 445 475 400 Z';
const BODY_SHAPE = ellipse(500, 400, 34, 145);
const ANTENNA_LEFT = 'M 478 265 Q 400 150 345 115';
const ANTENNA_RIGHT = 'M 522 265 Q 600 150 655 115';
const TIP_LEFT = circle(345, 115, 12);
const TIP_RIGHT = circle(655, 115, 12);
const SPOTS = [
  circle(310, 310, 26),
  circle(690, 310, 26),
  circle(360, 575, 18),
  circle(640, 575, 18),
];

const SPOT_IDS = ['spot-1', 'spot-2', 'spot-3', 'spot-4'];

export const BUTTERFLY_CATEGORY: CategoryLesson = {
  id: 'butterfly',
  status: 'done',
  title: 'Kupu-kupu',
  hint: 'a butterfly with wings spread',
  facing: 'front',
  parts: [
    { id: 'upper-wings', label: 'sayap atas', regionIds: ['wing-upper'] },
    { id: 'lower-wings', label: 'sayap bawah', regionIds: ['wing-lower'] },
    { id: 'body', label: 'badan', regionIds: ['body'] },
    { id: 'spots', label: 'bintik', regionIds: SPOT_IDS },
  ],
  lesson: packageLesson({
    id: 'butterfly-front',
    title: 'Kupu-kupu',
    subtitle: 'Sayap atas, sayap bawah, lalu badan',
    colorRegions: [
      region('wing-lower', 'Sayap bawah', LOWER_WINGS, LOWER),
      region('wing-upper', 'Sayap atas', UPPER, WING),
      region('body', 'Badan', `${BODY_SHAPE} Z`, BODY),
      ...SPOTS.map((d, index) => region(SPOT_IDS[index]!, `Bintik ${index + 1}`, `${d} Z`, SPOT)),
    ],
    steps: [
      outline('upper-wings', 'Gambar kedua sayap atas sebagai satu bentuk.', [
        guide('wing-upper', UPPER),
      ], 'Bentuk besar seperti dasi kupu-kupu.'),
      outline('lower-wings', 'Gambar kedua sayap bawah.', [
        guide('wing-lower', LOWER_WINGS),
      ], 'Lebih kecil, menempel di bawah sayap atas.'),
      outline('body', 'Gambar badan di tengah sayap.', [
        guide('body', BODY_SHAPE),
      ], 'Lonjong tegak, dari dekat antena sampai bawah.'),
      detail('antennae', 'Gambar dua antena di atas kepala.', [
        guide('antenna-left', ANTENNA_LEFT),
        guide('antenna-right', ANTENNA_RIGHT),
        guide('antenna-tip-left', TIP_LEFT),
        guide('antenna-tip-right', TIP_RIGHT),
      ], 'Dua garis melengkung, masing-masing dengan ujung bulat.'),
      detail('spots', 'Gambar bintik pada sayap.', [
        ...SPOTS.map((d, index) => guide(SPOT_IDS[index]!, d)),
      ], 'Dua lingkaran di sayap atas dan dua yang lebih kecil di bawah.', 6),
      colorStep('color-lower', 'Warnai sayap bawah.', ['wing-lower'], LOWER, 'Isi kedua sayap yang lebih kecil.', 48),
      colorStep('color-upper', 'Warnai sayap atas.', ['wing-upper'], WING, 'Isi bentuk besar di atas.', 52),
      colorStep('color-body', 'Warnai badan.', ['body'], BODY, 'Isi lonjong di tengah.', 28),
      colorStep('color-spots', 'Warnai bintik sayap.', SPOT_IDS, SPOT, 'Isi lingkaran-lingkaran kecil.', 20),
    ],
  }),
};

/**
 * A simple blossom. No face. The centre circle is step 1, then all five
 * petals together, then the stem and the leaves.
 *
 * Each petal stroke stops on the circle. The fill continues through the
 * middle, and neighbouring petals overlap, so the flat colour has no white
 * seam. The stem fill does the same. The centre is coloured last and covers
 * those overlaps.
 */

import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const PINK = '#e56b8a';
const YELLOW = '#f0c43a';
const GREEN = '#3e9a55';

const CENTER = 'M 435 250 A 65 65 0 1 1 565 250 A 65 65 0 1 1 435 250';
const PETALS = [
  { outline: 'M 450 208 C 406 146 445 60 500 65 C 555 60 594 146 550 208', innerEdge: 'Q 500 250 450 208' },
  { outline: 'M 524 190 C 570 129 664 139 676 193 C 698 243 628 307 555 284', innerEdge: 'Q 500 250 524 190' },
  { outline: 'M 565 255 C 637 279 656 372 609 400 C 568 436 485 389 484 313', innerEdge: 'Q 500 250 565 255' },
  { outline: 'M 516 313 C 515 389 432 436 391 400 C 344 372 363 279 435 255', innerEdge: 'Q 500 250 516 313' },
  { outline: 'M 445 284 C 372 307 302 243 324 193 C 336 139 430 129 476 190', innerEdge: 'Q 500 250 445 284' },
] as const;
const STEM = 'M 489 315 C 486 410 485 545 488 665 L 512 665 C 515 545 514 410 511 315 Z';
const STEM_FILL = 'M 489 270 C 486 410 485 545 488 665 L 512 665 C 515 545 514 410 511 270 Z';
const LEFT_LEAF = 'M 500 505 C 410 410 320 430 295 495 C 330 575 420 580 500 555';
const RIGHT_LEAF = 'M 500 560 C 590 485 700 495 725 555 C 690 630 580 635 500 610';
const VEIN_LEFT = 'M 500 530 Q 400 490 330 495';
const VEIN_RIGHT = 'M 500 585 Q 620 555 700 555';

const PETAL_REGIONS = PETALS.map((petal, index) => region(
  `petal-${index + 1}`,
  `Kelopak ${index + 1}`,
  `${petal.outline} ${petal.innerEdge} Z`,
  PINK,
));

const LEAF_REGIONS = [
  region('stem', 'Batang', STEM_FILL, GREEN),
  region('leaf-left', 'Daun kiri', `${LEFT_LEAF} Z`, GREEN),
  region('leaf-right', 'Daun kanan', `${RIGHT_LEAF} Z`, GREEN),
];

export const FLOWER_CATEGORY: CategoryLesson = {
  id: 'flower',
  status: 'done',
  title: 'Bunga',
  hint: 'a flower or blossom',
  facing: 'front',
  parts: [
    { id: 'petals', label: 'kelopak', regionIds: PETAL_REGIONS.map((item) => item.id) },
    { id: 'centre', label: 'tengah', regionIds: ['centre'] },
    { id: 'leaves', label: 'daun dan batang', regionIds: LEAF_REGIONS.map((item) => item.id) },
  ],
  lesson: packageLesson({
    id: 'flower',
    title: 'Bunga',
    subtitle: 'Lingkaran tengah, lima kelopak, lalu batang',
    colorRegions: [
      ...PETAL_REGIONS,
      ...LEAF_REGIONS,
      region('centre', 'Tengah bunga', `${CENTER} Z`, YELLOW),
    ],
    steps: [
      outline('centre', 'Gambar lingkaran untuk tengah bunga.', [
        guide('centre', CENTER),
      ], 'Lingkaran ini tempat kelopak menempel.'),
      outline('petals', 'Gambar lima kelopak di sekeliling lingkaran.', [
        ...PETALS.map((petal, index) => guide(`petal-${index + 1}`, petal.outline)),
      ], 'Setiap kelopak seperti tetesan yang menempel di lingkaran.'),
      outline('stem', 'Gambar batang di bawah bunga.', [
        guide('stem', STEM),
      ], 'Dua garis panjang yang bertemu di bawah.'),
      outline('leaves', 'Gambar dua daun di samping batang.', [
        guide('leaf-left', LEFT_LEAF),
        guide('leaf-right', RIGHT_LEAF),
      ], 'Satu daun ke kiri dan satu ke kanan.'),
      detail('veins', 'Gambar garis di tengah setiap daun.', [
        guide('vein-left', VEIN_LEFT),
        guide('vein-right', VEIN_RIGHT),
      ], 'Ikuti daun dari batang ke ujungnya.'),
      colorStep('color-petals', 'Warnai kelopak.', PETAL_REGIONS.map((item) => item.id), PINK, 'Sapukan kuas pada kelopak. Warna dari fotomu juga boleh.', 48),
      colorStep('color-leaves', 'Warnai batang dan daun.', LEAF_REGIONS.map((item) => item.id), GREEN, 'Batang dulu, lalu kedua daun.', 40),
      colorStep('color-centre', 'Warnai tengah bunga.', ['centre'], YELLOW, 'Isi lingkaran di tengah.', 32),
    ],
  }),
};

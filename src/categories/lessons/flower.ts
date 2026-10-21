/**
 * A simple blossom. No face. The centre circle is step 1, then all five
 * petals together, then the stem and the leaves.
 */

import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const PINK = '#e56b8a';
const YELLOW = '#f0c43a';
const GREEN = '#3e9a55';

const CENTER = 'M 435 250 A 65 65 0 1 1 565 250 A 65 65 0 1 1 435 250';
const PETALS = [
  { outline: 'M 455 190 C 420 145 445 75 500 65 C 555 75 580 145 545 190', innerEdge: 'Q 500 160 455 190' },
  { outline: 'M 440 215 C 375 155 305 165 290 225 C 295 285 365 305 438 270', innerEdge: 'Q 400 250 440 215' },
  { outline: 'M 560 215 C 625 155 695 165 710 225 C 705 285 635 305 562 270', innerEdge: 'Q 600 250 560 215' },
  { outline: 'M 447 288 C 375 275 315 325 340 385 C 380 435 455 390 480 312', innerEdge: 'Q 455 322 447 288' },
  { outline: 'M 553 288 C 625 275 685 325 660 385 C 620 435 545 390 520 312', innerEdge: 'Q 545 322 553 288' },
] as const;
const STEM = 'M 489 315 C 486 410 485 545 488 665 L 512 665 C 515 545 514 410 511 315 Z';
const LEFT_LEAF = 'M 490 520 C 420 430 330 430 300 490 C 325 560 410 575 490 520 Z';
const RIGHT_LEAF = 'M 510 575 C 580 490 680 490 710 545 C 680 615 575 620 510 575 Z';
const VEIN_LEFT = 'M 490 520 Q 410 490 340 490';
const VEIN_RIGHT = 'M 510 575 Q 600 545 680 545';

const PETAL_REGIONS = PETALS.map((petal, index) => region(
  `petal-${index + 1}`,
  `Kelopak ${index + 1}`,
  `${petal.outline} ${petal.innerEdge} Z`,
  PINK,
));

const LEAF_REGIONS = [
  region('stem', 'Batang', STEM, GREEN),
  region('leaf-left', 'Daun kiri', LEFT_LEAF, GREEN),
  region('leaf-right', 'Daun kanan', RIGHT_LEAF, GREEN),
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
      region('centre', 'Tengah bunga', `${CENTER} Z`, YELLOW),
      ...LEAF_REGIONS,
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
      colorStep('color-centre', 'Warnai tengah bunga.', ['centre'], YELLOW, 'Isi lingkaran di tengah.', 32),
      colorStep('color-leaves', 'Warnai batang dan daun.', LEAF_REGIONS.map((item) => item.id), GREEN, 'Batang dulu, lalu kedua daun.', 40),
    ],
  }),
};

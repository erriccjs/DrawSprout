/**
 * An apple. Step 1 is the fruit circle. The dent, the stem, and the leaf
 * come after it. The stem and the leaf overlap the fruit.
 */

import { circle } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FRUIT = '#d63c3c';
const STEM_COLOR = '#8b5a2b';
const LEAF = '#3e9a55';

const APPLE = circle(500, 420, 190);
const DENT = 'M 440 275 Q 500 340 560 275';
const STEM = 'M 488 310 C 492 200 545 140 562 155 C 532 178 518 240 518 325 Z';
const LEAF_SHAPE = 'M 525 185 C 640 70 805 160 725 265 C 655 305 555 250 525 215';
const VEIN = 'M 545 200 Q 650 165 715 240';

export const APPLE_CATEGORY: CategoryLesson = {
  id: 'apple',
  status: 'done',
  title: 'Apel',
  hint: 'an apple with a stem and a leaf',
  facing: 'front',
  parts: [
    { id: 'fruit', label: 'buah', regionIds: ['fruit'] },
    { id: 'stem', label: 'tangkai', regionIds: ['stem'] },
    { id: 'leaf', label: 'daun', regionIds: ['leaf'] },
  ],
  lesson: packageLesson({
    id: 'apple',
    title: 'Apel',
    subtitle: 'Lingkaran buah, lekuk, lalu tangkai',
    colorRegions: [
      region('fruit', 'Buah', `${APPLE} Z`, FRUIT),
      region('stem', 'Tangkai', STEM, STEM_COLOR),
      region('leaf', 'Daun', `${LEAF_SHAPE} Z`, LEAF),
    ],
    steps: [
      outline('fruit', 'Gambar lingkaran besar untuk buah apel.', [
        guide('fruit', APPLE),
      ], 'Hampir sebesar kertasnya.'),
      detail('dent', 'Gambar lekuk di atas apel.', [
        guide('dent', DENT),
      ], 'Satu lengkung yang masuk ke dalam buah.'),
      outline('stem', 'Gambar tangkai di lekuk itu.', [
        guide('stem', STEM),
      ], 'Tangkai kecil yang naik dari lekuk.'),
      outline('leaf', 'Gambar daun di samping tangkai.', [
        guide('leaf', LEAF_SHAPE),
      ], 'Daun menempel di tangkai dan meruncing.'),
      detail('vein', 'Gambar garis di tengah daun.', [
        guide('vein', VEIN),
      ], 'Ikuti daun dari tangkai ke ujungnya.'),
      colorStep('color-fruit', 'Warnai buah apel.', ['fruit'], FRUIT, 'Sapukan kuas pada lingkaran.', 56),
      colorStep('color-stem', 'Warnai tangkai.', ['stem'], STEM_COLOR, 'Isi tangkai yang kecil.', 16),
      colorStep('color-leaf', 'Warnai daun.', ['leaf'], LEAF, 'Isi daun di samping tangkai.', 24),
    ],
  }),
};

/**
 * A cup with a handle on the right. Step 1 is the tall oval of the cup.
 * The rim ellipse crosses the top of that oval, which reads as the lip.
 */

import { ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const CERAMIC = '#f4efe6';
const DRINK = '#6f3b24';
const SAUCER = '#e7e0d4';

const BODY = ellipse(500, 400, 155, 175);
const RIM = ellipse(500, 250, 155, 42);
const DRINK_SURFACE = ellipse(500, 292, 112, 26);
const HANDLE = 'M 640 345 C 800 320 815 530 640 505 C 725 485 735 385 640 365 Z';
const SAUCER_SHAPE = ellipse(500, 590, 250, 38);

export const CUP_CATEGORY: CategoryLesson = {
  id: 'cup',
  status: 'done',
  title: 'Cangkir',
  hint: 'a cup, mug, or coffee cup, handle included when visible',
  facing: 'right',
  parts: [
    { id: 'cup', label: 'cangkir', regionIds: ['body', 'handle'] },
    { id: 'drink', label: 'minuman', regionIds: ['drink'] },
    { id: 'saucer', label: 'tatakan', regionIds: ['saucer'] },
  ],
  lesson: packageLesson({
    id: 'cup',
    title: 'Cangkir',
    subtitle: 'Badan lonjong, bibir, lalu pegangan',
    colorRegions: [
      region('saucer', 'Tatakan', `${SAUCER_SHAPE} Z`, SAUCER),
      region('body', 'Badan', `${BODY} Z`, CERAMIC),
      region('handle', 'Pegangan', HANDLE, CERAMIC),
      region('drink', 'Minuman', `${DRINK_SURFACE} Z`, DRINK),
    ],
    steps: [
      outline('body', 'Gambar bentuk lonjong besar untuk badan cangkir.', [
        guide('body', BODY),
      ], 'Lebih tinggi daripada lebarnya.'),
      outline('rim', 'Gambar bibir cangkir di atas badan.', [
        guide('rim', RIM),
      ], 'Lonjong pipih yang memotong bagian atas.'),
      outline('handle', 'Gambar pegangan di samping kanan.', [
        guide('handle', HANDLE),
      ], 'Seperti telinga kecil di luar cangkir.'),
      outline('saucer', 'Gambar tatakan di bawah cangkir.', [
        guide('saucer', SAUCER_SHAPE),
      ], 'Lonjong pipih, lebih lebar dari cangkir.'),
      detail('drink', 'Gambar permukaan minuman di dalam cangkir.', [
        guide('drink', DRINK_SURFACE),
      ], 'Lonjong kecil di bawah bibir cangkir.'),
      colorStep('color-saucer', 'Warnai tatakan.', ['saucer'], SAUCER, 'Isi lonjong di bawah cangkir.', 40),
      colorStep('color-cup', 'Warnai cangkir dan pegangan.', ['body', 'handle'], CERAMIC, 'Badan dulu, lalu pegangan.', 48),
      colorStep('color-drink', 'Warnai minuman.', ['drink'], DRINK, 'Isi lonjong di dalam cangkir.', 28),
    ],
  }),
};

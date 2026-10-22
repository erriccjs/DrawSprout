/**
 * A rocket pointing up. Step 1 is the tall body oval. Facing is front
 * because a rocket has no left or right. The nose fill tucks into the body,
 * and the body colour covers that tuck.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const BODY_COLOR = '#e24b4b';
const NOSE_COLOR = '#f0c43a';
const WINDOW_COLOR = '#b9dcff';
const FLAME_COLOR = '#f08a2c';

const BODY = ellipse(500, 405, 105, 200);
const NOSE = 'M 390 250 L 500 60 L 610 250 Z';
const NOSE_FILL = 'M 390 250 L 500 60 L 610 250 L 580 300 L 420 300 Z';
const FIN_LEFT = 'M 415 500 L 260 665 L 455 595 Z';
const FIN_RIGHT = 'M 585 500 L 740 665 L 545 595 Z';
const WINDOW = circle(500, 345, 42);
const FLAME = 'M 455 575 C 430 685 468 760 500 780 C 532 760 570 685 545 575 C 520 635 480 635 455 575 Z';

const BODY_REGIONS = ['body', 'fin-left', 'fin-right'];

export const ROCKET_CATEGORY: CategoryLesson = {
  id: 'rocket',
  status: 'done',
  title: 'Roket',
  hint: 'a rocket pointing up',
  facing: 'front',
  parts: [
    { id: 'body', label: 'badan', regionIds: BODY_REGIONS },
    { id: 'nose', label: 'hidung', regionIds: ['nose'] },
    { id: 'window', label: 'jendela', regionIds: ['window'] },
    { id: 'flame', label: 'api', regionIds: ['flame'] },
  ],
  lesson: packageLesson({
    id: 'rocket',
    title: 'Roket',
    subtitle: 'Badan tinggi, hidung, lalu sirip',
    colorRegions: [
      region('nose', 'Hidung', NOSE_FILL, NOSE_COLOR),
      region('body', 'Badan', `${BODY} Z`, BODY_COLOR),
      region('fin-left', 'Sirip kiri', FIN_LEFT, BODY_COLOR),
      region('fin-right', 'Sirip kanan', FIN_RIGHT, BODY_COLOR),
      region('window', 'Jendela', `${WINDOW} Z`, WINDOW_COLOR),
      region('flame', 'Api', FLAME, FLAME_COLOR),
    ],
    steps: [
      outline('body', 'Gambar bentuk lonjong tinggi untuk badan roket.', [
        guide('body', BODY),
      ], 'Lebih tinggi daripada lebarnya.'),
      outline('nose', 'Gambar hidung segitiga di atas badan.', [
        guide('nose', NOSE),
      ], 'Ujungnya lancip ke atas.'),
      outline('fins', 'Gambar dua sirip di bawah badan.', [
        guide('fin-left', FIN_LEFT),
        guide('fin-right', FIN_RIGHT),
      ], 'Satu di kiri dan satu di kanan, seperti sayap kecil.'),
      outline('window', 'Gambar jendela di tengah badan.', [
        guide('window', WINDOW),
      ], 'Satu lingkaran.'),
      outline('flame', 'Gambar api di bawah roket.', [
        guide('flame', FLAME),
      ], 'Api lebar di atas dan lancip di bawah.'),
      colorStep('color-nose', 'Warnai hidung roket.', ['nose'], NOSE_COLOR, 'Isi segitiga di atas.', 36),
      colorStep('color-body', 'Warnai badan dan sirip.', BODY_REGIONS, BODY_COLOR, 'Badan dulu, lalu kedua sirip.', 48),
      colorStep('color-window', 'Warnai jendela.', ['window'], WINDOW_COLOR, 'Isi lingkaran di tengah.', 28),
      colorStep('color-flame', 'Warnai api.', ['flame'], FLAME_COLOR, 'Isi api di bawah roket.', 32),
    ],
  }),
};

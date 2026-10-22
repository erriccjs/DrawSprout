/**
 * Side-view toy car facing right. Step 1 is one long oval for the body,
 * then the cabin dome, the wheels, and the small parts.
 */

import { circle, dome, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const BODY_COLOR = '#e24b4b';
const WINDOW = '#d7ecff';
const WHEEL = '#2a2a2a';
const LIGHT = '#f6d365';

const BODY = ellipse(500, 470, 310, 88);
const CABIN = dome(355, 445, 655, 150, 145);
const WINDOW_SHAPE = dome(415, 438, 600, 92, 95);
const WHEEL_LEFT = circle(330, 535, 62);
const WHEEL_RIGHT = circle(700, 535, 62);
const HUB_LEFT = circle(330, 535, 24);
const HUB_RIGHT = circle(700, 535, 24);
const LIGHT_SHAPE = circle(755, 450, 18);

export const TOY_CAR_CATEGORY: CategoryLesson = {
  id: 'toy-car',
  status: 'done',
  title: 'Mobil Mainan',
  hint: 'a toy car or small model car, side view',
  facing: 'right',
  parts: [
    { id: 'body', label: 'badan', regionIds: ['body', 'cabin'] },
    { id: 'window', label: 'jendela', regionIds: ['window'] },
    { id: 'wheels', label: 'roda', regionIds: ['wheel-left', 'wheel-right'] },
    { id: 'light', label: 'lampu', regionIds: ['light'] },
  ],
  lesson: packageLesson({
    id: 'toy-car',
    title: 'Mobil Mainan',
    subtitle: 'Badan lonjong, atap, lalu roda',
    colorRegions: [
      region('body', 'Badan', `${BODY} Z`, BODY_COLOR),
      region('cabin', 'Atap', `${CABIN} Z`, BODY_COLOR),
      region('window', 'Jendela', `${WINDOW_SHAPE} Z`, WINDOW),
      region('wheel-left', 'Roda kiri', `${WHEEL_LEFT} Z`, WHEEL),
      region('wheel-right', 'Roda kanan', `${WHEEL_RIGHT} Z`, WHEEL),
      region('light', 'Lampu', `${LIGHT_SHAPE} Z`, LIGHT),
    ],
    steps: [
      outline('body', 'Gambar bentuk lonjong besar untuk badan mobil.', [
        guide('body', BODY),
      ], 'Panjang ke samping, tidak terlalu tinggi.'),
      outline('cabin', 'Gambar atap di atas badan.', [
        guide('cabin', CABIN),
      ], 'Setengah lingkaran, seperti kubah.'),
      outline('wheels', 'Gambar dua roda.', [
        guide('wheel-left', WHEEL_LEFT),
        guide('wheel-right', WHEEL_RIGHT),
        guide('hub-left', HUB_LEFT),
        guide('hub-right', HUB_RIGHT),
      ], 'Satu lingkaran besar dan satu lingkaran kecil di dalamnya.'),
      detail('window', 'Gambar jendela di dalam atap.', [
        guide('window', WINDOW_SHAPE),
      ], 'Kubah kecil di dalam atap.', 6),
      detail('light', 'Gambar lampu di depan mobil.', [
        guide('light', LIGHT_SHAPE),
      ], 'Lingkaran kecil di ujung depan.', 5),
      colorStep('color-body', 'Warnai badan dan atap.', ['body', 'cabin'], BODY_COLOR, 'Sapukan kuas pada badan, lalu atap.', 52),
      colorStep('color-window', 'Warnai jendela.', ['window'], WINDOW, 'Isi kubah kecil di atap.', 28),
      colorStep('color-wheels', 'Warnai kedua roda.', ['wheel-left', 'wheel-right'], WHEEL, 'Isi lingkaran besar. Lingkaran kecil di tengah tetap terang.', 36),
      colorStep('color-light', 'Warnai lampu.', ['light'], LIGHT, 'Lampu kecil di depan.', 16),
    ],
  }),
};

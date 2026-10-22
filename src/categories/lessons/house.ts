/**
 * A front-view house. Step 1 is the wall rectangle, the biggest shape.
 * The roof fill tucks into the wall, and the wall colour covers that tuck.
 * The chimney fill tucks under the roof slope.
 *
 * The picker already has a lesson id `house`, so this package is `house-front`.
 * The matcher still calls the category `house`.
 */

import { circle } from '../shapes';
import { colorStep, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const WALL = '#f3d478';
const ROOF = '#d64545';
const DOOR_COLOR = '#8b5a2b';
const WINDOW_COLOR = '#7eb6e8';
const BRICK = '#c4623a';

const WALLS = 'M 280 390 L 720 390 L 720 660 L 280 660 Z';
const ROOF_LINE = 'M 210 400 L 500 145 L 790 400 Z';
const ROOF_FILL = 'M 210 400 L 500 145 L 790 400 L 720 440 L 280 440 Z';
const DOOR = 'M 455 660 L 455 470 L 575 470 L 575 660 Z';
const KNOB = circle(545, 575, 9);
const WINDOW = 'M 325 445 L 445 445 L 445 565 L 325 565 Z';
const WINDOW_V = 'M 385 445 L 385 565';
const WINDOW_H = 'M 325 505 L 445 505';
const CHIMNEY = 'M 325 340 L 325 165 L 405 165 L 405 270';
const CHIMNEY_FILL = 'M 325 165 L 405 165 L 405 250 L 325 320 Z';

export const HOUSE_CATEGORY: CategoryLesson = {
  id: 'house',
  status: 'done',
  title: 'Rumah',
  hint: 'a house with a roof, a door, and a window',
  facing: 'front',
  parts: [
    { id: 'walls', label: 'dinding', regionIds: ['walls'] },
    { id: 'roof', label: 'atap', regionIds: ['roof'] },
    { id: 'door', label: 'pintu', regionIds: ['door'] },
    { id: 'window', label: 'jendela', regionIds: ['window'] },
    { id: 'chimney', label: 'cerobong', regionIds: ['chimney'] },
  ],
  lesson: packageLesson({
    id: 'house-front',
    title: 'Rumah',
    subtitle: 'Dinding persegi, atap, lalu pintu',
    colorRegions: [
      region('roof', 'Atap', ROOF_FILL, ROOF),
      region('walls', 'Dinding', WALLS, WALL),
      region('door', 'Pintu', DOOR, DOOR_COLOR),
      region('window', 'Jendela', WINDOW, WINDOW_COLOR),
      region('chimney', 'Cerobong', CHIMNEY_FILL, BRICK),
    ],
    steps: [
      outline('walls', 'Gambar persegi besar untuk dinding.', [
        guide('walls', WALLS),
      ], 'Empat garis lurus. Ini badan rumah.'),
      outline('roof', 'Gambar atap segitiga di atas dinding.', [
        guide('roof', ROOF_LINE),
      ], 'Lebih lebar dari dinding, dengan puncak di tengah.'),
      outline('door', 'Gambar pintu di bagian bawah dinding.', [
        guide('door', DOOR),
        guide('knob', KNOB),
      ], 'Persegi panjang yang menempel di lantai, plus kenop bulat.'),
      outline('window', 'Gambar jendela di dinding.', [
        guide('window', WINDOW),
        guide('window-v', WINDOW_V),
        guide('window-h', WINDOW_H),
      ], 'Persegi, lalu satu garis tegak dan satu garis mendatar di dalamnya.'),
      outline('chimney', 'Gambar cerobong di atas atap.', [
        guide('chimney', CHIMNEY),
      ], 'Tiga garis: naik, ke samping, lalu turun sampai atap.'),
      colorStep('color-roof', 'Warnai atap.', ['roof'], ROOF, 'Isi segitiga atap.', 48),
      colorStep('color-walls', 'Warnai dinding.', ['walls'], WALL, 'Sapukan kuas pada persegi dinding.', 52),
      colorStep('color-door', 'Warnai pintu.', ['door'], DOOR_COLOR, 'Isi persegi panjang di bawah.', 36),
      colorStep('color-window', 'Warnai jendela.', ['window'], WINDOW_COLOR, 'Isi persegi jendela. Garis salibnya tetap gelap.', 32),
      colorStep('color-chimney', 'Warnai cerobong.', ['chimney'], BRICK, 'Isi cerobong di atas atap.', 24),
    ],
  }),
};

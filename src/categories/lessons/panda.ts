/**
 * Sitting panda, face on. White first, then the black parts on top.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const WHITE = '#f7f4ee';
const BLACK = '#2a2a2a';

const BODY = ellipse(500, 500, 155, 145);
const HEAD = circle(500, 270, 115);
const EAR_LEFT = circle(395, 175, 40);
const EAR_RIGHT = circle(605, 175, 40);
const PATCH_LEFT = ellipse(450, 275, 34, 28);
const PATCH_RIGHT = ellipse(550, 275, 34, 28);
const ARM_LEFT = ellipse(335, 500, 42, 85);
const ARM_RIGHT = ellipse(665, 500, 42, 85);
const LEG_LEFT = ellipse(425, 645, 55, 42);
const LEG_RIGHT = ellipse(575, 645, 55, 42);
const EYE_LEFT = circle(450, 272, 8);
const EYE_RIGHT = circle(550, 272, 8);
const NOSE = ellipse(500, 315, 14, 10);

const WHITE_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, WHITE),
  region('head', 'Kepala', `${HEAD} Z`, WHITE),
];
const BLACK_REGIONS = [
  region('ear-left', 'Telinga kiri', `${EAR_LEFT} Z`, BLACK),
  region('ear-right', 'Telinga kanan', `${EAR_RIGHT} Z`, BLACK),
  region('patch-left', 'Lingkar mata kiri', `${PATCH_LEFT} Z`, BLACK),
  region('patch-right', 'Lingkar mata kanan', `${PATCH_RIGHT} Z`, BLACK),
  region('arm-left', 'Tangan kiri', `${ARM_LEFT} Z`, BLACK),
  region('arm-right', 'Tangan kanan', `${ARM_RIGHT} Z`, BLACK),
  region('leg-left', 'Kaki kiri', `${LEG_LEFT} Z`, BLACK),
  region('leg-right', 'Kaki kanan', `${LEG_RIGHT} Z`, BLACK),
  region('nose', 'Hidung', `${NOSE} Z`, BLACK),
];

export const PANDA_CATEGORY: CategoryLesson = {
  id: 'panda',
  status: 'done',
  title: 'Beruang Panda',
  hint: 'a panda or giant panda. Also called beruang panda.',
  facing: 'front',
  parts: [
    { id: 'white', label: 'putih', regionIds: WHITE_REGIONS.map((item) => item.id) },
    { id: 'black', label: 'hitam', regionIds: BLACK_REGIONS.map((item) => item.id) },
  ],
  lesson: packageLesson({
    id: 'panda',
    title: 'Beruang Panda',
    subtitle: 'Badan bulat, kepala, lalu telinga',
    colorRegions: [...WHITE_REGIONS, ...BLACK_REGIONS],
    steps: [
      outline('body', 'Gambar badan bulat.', [
        guide('body', BODY),
      ], 'Badan panda besar di bawah.'),
      outline('head', 'Gambar kepala bulat.', [
        guide('head', HEAD),
      ], 'Kepala di atas badan.'),
      outline('ears', 'Gambar dua telinga.', [
        guide('ear-left', EAR_LEFT),
        guide('ear-right', EAR_RIGHT),
      ], 'Telinga kiri dan telinga kanan.'),
      outline('patches', 'Gambar dua lingkar mata.', [
        guide('patch-left', PATCH_LEFT),
        guide('patch-right', PATCH_RIGHT),
      ], 'Bentuk lonjong di kiri dan kanan wajah.'),
      outline('arms', 'Gambar dua tangan.', [
        guide('arm-left', ARM_LEFT),
        guide('arm-right', ARM_RIGHT),
      ], 'Tangan di samping badan.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-left', LEG_LEFT),
        guide('leg-right', LEG_RIGHT),
      ], 'Kaki di bawah badan.'),
      detail('face', 'Gambar mata dan hidung.', [
        guide('eye-left', EYE_LEFT),
        guide('eye-right', EYE_RIGHT),
        guide('nose', NOSE),
      ], 'Mata di dalam lingkar, hidung di tengah.'),
      colorStep('color-white', 'Warnai bagian putih.', WHITE_REGIONS.map((item) => item.id), WHITE, 'Badan dan kepala.', 56),
      colorStep('color-black', 'Warnai bagian hitam.', BLACK_REGIONS.map((item) => item.id), BLACK, 'Telinga, lingkar mata, tangan, kaki, dan hidung.', 36),
    ],
  }),
};

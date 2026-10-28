/**
 * A sitting teddy bear, face on. Rounder than the panda, with a snout and a bow.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FUR = '#c68642';
const SNOUT_COLOR = '#f0d2a8';
const BOW = '#d24b45';
const NOSE = '#3a3a3a';

const BODY = ellipse(500, 520, 160, 140);
const HEAD = circle(500, 280, 118);
const EAR_LEFT = circle(390, 180, 44);
const EAR_RIGHT = circle(610, 180, 44);
const SNOUT = ellipse(500, 330, 58, 42);
const ARM_LEFT = ellipse(330, 500, 46, 72);
const ARM_RIGHT = ellipse(670, 500, 46, 72);
const LEG_LEFT = ellipse(420, 660, 58, 42);
const LEG_RIGHT = ellipse(580, 660, 58, 42);
const BOW_PATH = 'M 455 410 L 500 445 L 545 410 L 530 400 L 500 428 L 470 400 Z';
const EYE_LEFT = circle(460, 270, 9);
const EYE_RIGHT = circle(540, 270, 9);
const NOSE_PATH = ellipse(500, 325, 12, 9);
const MOUTH = 'M 478 350 Q 500 368 522 350';

const FUR_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, FUR),
  region('head', 'Kepala', `${HEAD} Z`, FUR),
  region('ear-left', 'Telinga kiri', `${EAR_LEFT} Z`, FUR),
  region('ear-right', 'Telinga kanan', `${EAR_RIGHT} Z`, FUR),
  region('arm-left', 'Tangan kiri', `${ARM_LEFT} Z`, FUR),
  region('arm-right', 'Tangan kanan', `${ARM_RIGHT} Z`, FUR),
  region('leg-left', 'Kaki kiri', `${LEG_LEFT} Z`, FUR),
  region('leg-right', 'Kaki kanan', `${LEG_RIGHT} Z`, FUR),
];

export const TEDDY_BEAR_CATEGORY: CategoryLesson = {
  id: 'teddy-bear',
  status: 'done',
  title: 'Boneka Beruang',
  hint: 'a teddy bear or stuffed bear. Also called boneka beruang. Not a real bear.',
  facing: 'front',
  parts: [
    { id: 'fur', label: 'bulu', regionIds: FUR_REGIONS.map((item) => item.id) },
    { id: 'snout', label: 'moncong', regionIds: ['snout'] },
    { id: 'bow', label: 'pita', regionIds: ['bow'] },
    { id: 'nose', label: 'hidung', regionIds: ['nose'] },
  ],
  lesson: packageLesson({
    id: 'teddy-bear',
    title: 'Boneka Beruang',
    subtitle: 'Kepala bulat, badan, lalu pita',
    colorRegions: [
      ...FUR_REGIONS,
      region('snout', 'Moncong', `${SNOUT} Z`, SNOUT_COLOR),
      region('bow', 'Pita', BOW_PATH, BOW),
      region('nose', 'Hidung', `${NOSE_PATH} Z`, NOSE),
    ],
    steps: [
      outline('head', 'Gambar kepala bulat.', [
        guide('head', HEAD),
      ], 'Kepala boneka besar dan bulat.'),
      outline('body', 'Gambar badan di bawah kepala.', [
        guide('body', BODY),
      ], 'Badan lebih besar dari kepala.'),
      outline('ears', 'Gambar dua telinga.', [
        guide('ear-left', EAR_LEFT),
        guide('ear-right', EAR_RIGHT),
      ], 'Telinga bulat di kiri dan kanan.'),
      outline('snout', 'Gambar moncong.', [
        guide('snout', SNOUT),
      ], 'Lonjong kecil di tengah wajah.'),
      outline('arms', 'Gambar dua tangan.', [
        guide('arm-left', ARM_LEFT),
        guide('arm-right', ARM_RIGHT),
      ], 'Tangan di samping badan.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-left', LEG_LEFT),
        guide('leg-right', LEG_RIGHT),
      ], 'Kaki di bawah badan.'),
      outline('bow', 'Gambar pita.', [
        guide('bow', BOW_PATH),
      ], 'Pita di leher.'),
      detail('face', 'Gambar mata, hidung, dan mulut.', [
        guide('eye-left', EYE_LEFT),
        guide('eye-right', EYE_RIGHT),
        guide('nose', NOSE_PATH),
        guide('mouth', MOUTH),
      ], 'Mata di kepala, hidung di moncong, mulut di bawahnya.'),
      colorStep('color-fur', 'Warnai bulu.', FUR_REGIONS.map((item) => item.id), FUR, 'Kepala, badan, telinga, tangan, dan kaki.', 52),
      colorStep('color-snout', 'Warnai moncong.', ['snout'], SNOUT_COLOR, 'Moncong yang lebih muda.', 28),
      colorStep('color-bow', 'Warnai pita.', ['bow'], BOW, 'Pita di leher.', 20),
      colorStep('color-nose', 'Warnai hidung.', ['nose'], NOSE, 'Hidung kecil.', 12),
    ],
  }),
};

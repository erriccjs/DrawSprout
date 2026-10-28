/**
 * Lion in side view, facing right. The mane is a big circle behind the head,
 * coloured first so the face sits on top of it.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FUR = '#e0b15c';
const MANE = '#a56b2a';
const NOSE = '#3a3a3a';

const BODY = ellipse(370, 490, 175, 115);
const MANE_PATH = circle(655, 325, 128);
const HEAD = circle(660, 335, 70);
const EAR = 'M 600 230 C 575 175 630 165 640 220 Z';
const LEG_FRONT = 'M 470 560 L 455 690 Q 515 716 575 688 L 555 548 Z';
const LEG_BACK = 'M 250 565 L 228 692 Q 292 718 352 686 L 332 552 Z';
const TAIL = 'M 210 470 C 120 500 130 630 200 650';
const TUFT = circle(205, 665, 22);
const EYE = circle(690, 315, 10);
const PUPIL = circle(694, 317, 4);
const NOSE_PATH = circle(725, 355, 8);
const MOUTH = 'M 710 375 Q 680 395 655 378';

const BODY_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, FUR),
  region('head', 'Kepala', `${HEAD} Z`, FUR),
  region('ear', 'Telinga', EAR, FUR),
  region('leg-front', 'Kaki depan', LEG_FRONT, FUR),
  region('leg-back', 'Kaki belakang', LEG_BACK, FUR),
  region('tail', 'Ekor', 'M 210 460 C 120 490 125 640 200 655 L 215 640 C 150 610 155 510 220 485 Z', FUR),
];

export const LION_CATEGORY: CategoryLesson = {
  id: 'lion',
  status: 'done',
  title: 'Singa',
  hint: 'a lion. Also called singa.',
  facing: 'right',
  parts: [
    { id: 'fur', label: 'bulu', regionIds: BODY_REGIONS.map((item) => item.id) },
    { id: 'mane', label: 'surai', regionIds: ['mane', 'tuft'] },
    { id: 'nose', label: 'hidung', regionIds: ['nose'] },
  ],
  lesson: packageLesson({
    id: 'lion',
    title: 'Singa',
    subtitle: 'Badan, surai, lalu kepala',
    colorRegions: [
      region('mane', 'Surai', `${MANE_PATH} Z`, MANE),
      region('tuft', 'Jumbai', `${TUFT} Z`, MANE),
      ...BODY_REGIONS,
      region('nose', 'Hidung', `${NOSE_PATH} Z`, NOSE),
    ],
    steps: [
      outline('body', 'Gambar lonjong untuk badan.', [
        guide('body', BODY),
      ], 'Badan singa agak rendah.'),
      outline('mane', 'Gambar surai yang besar.', [
        guide('mane', MANE_PATH),
      ], 'Lingkaran besar di depan badan.'),
      outline('head', 'Gambar kepala di dalam surai.', [
        guide('head', HEAD),
      ], 'Lingkaran lebih kecil di tengah surai.'),
      outline('ear', 'Gambar telinga.', [
        guide('ear', EAR),
      ], 'Telinga kecil di atas surai.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('tail', 'Gambar ekor dan jumbai.', [
        guide('tail', TAIL),
        guide('tuft', TUFT),
      ], 'Ekor panjang, lalu lingkaran di ujungnya.'),
      detail('face', 'Gambar mata, hidung, dan mulut.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
        guide('nose', NOSE_PATH),
        guide('mouth', MOUTH),
      ], 'Mata di kepala, hidung di depan, mulut di bawahnya.'),
      colorStep('color-mane', 'Warnai surai.', ['mane', 'tuft'], MANE, 'Surai dan jumbai ekor. Kepala akan ditutup warna bulu.', 48),
      colorStep('color-fur', 'Warnai bulu.', BODY_REGIONS.map((item) => item.id), FUR, 'Badan, kepala, telinga, kaki, dan ekor.', 52),
      colorStep('color-nose', 'Warnai hidung.', ['nose'], NOSE, 'Hidung kecil.', 14),
    ],
  }),
};

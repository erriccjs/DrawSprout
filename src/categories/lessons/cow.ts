/**
 * Cow in side view, facing right. Horns are closed curves,
 * the ear is a leaf, and the udder hangs with teats.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const HIDE = '#f7f4ee';
const SPOT = '#2c2c2c';
const PINK = '#f2a6b3';
const HORN = '#e6d7b8';

const BODY = ellipse(400, 470, 195, 120);
const HEAD = ellipse(650, 425, 82, 60);
const SNOUT = ellipse(745, 450, 40, 28);
const HORN_LEFT = 'M 590 385 C 565 355 535 325 548 295 C 572 322 590 355 612 388 Z';
const HORN_RIGHT = 'M 645 370 C 640 335 658 300 678 288 C 662 318 655 350 662 378 Z';
const EAR = 'M 575 415 C 515 395 500 460 555 488 C 575 460 585 435 575 415 Z';
const EAR_INNER = 'M 568 425 C 535 418 528 455 558 468 C 570 450 574 435 568 425 Z';
const LEG_FRONT = 'M 520 555 L 505 690 Q 555 714 605 688 L 585 545 Z';
const LEG_BACK = 'M 250 560 L 228 692 Q 285 718 345 686 L 328 548 Z';
const UDDER = 'M 445 548 C 415 565 408 620 448 635 L 452 658 L 466 632 L 478 662 L 490 630 L 504 660 L 514 628 C 545 600 535 552 490 546 Z';
const SPOT_A = 'M 270 455 C 245 430 295 410 335 435 C 355 460 325 495 285 485 C 260 478 255 465 270 455 Z';
const SPOT_B = 'M 390 520 C 370 500 410 485 445 510 C 460 535 430 560 400 548 C 382 538 378 528 390 520 Z';
const SPOT_C = 'M 610 400 C 598 385 625 372 642 390 C 650 408 632 422 616 414 C 606 408 604 404 610 400 Z';
const SPOT_D = 'M 480 430 C 468 415 500 405 518 425 C 526 442 505 458 488 448 C 476 440 474 436 480 430 Z';
const TAIL = 'M 210 450 C 145 465 135 560 185 595';
const EYE = circle(680, 410, 8);
const PUPIL = circle(683, 411, 3);

const HIDE_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, HIDE),
  region('head', 'Kepala', `${HEAD} Z`, HIDE),
  region('ear', 'Telinga', EAR, HIDE),
  region('leg-front', 'Kaki depan', LEG_FRONT, HIDE),
  region('leg-back', 'Kaki belakang', LEG_BACK, HIDE),
];

const SPOT_IDS = ['spot-a', 'spot-b', 'spot-c', 'spot-d'] as const;

export const COW_CATEGORY: CategoryLesson = {
  id: 'cow',
  status: 'done',
  title: 'Sapi',
  hint: 'a cow, bull, or calf. Also called sapi.',
  facing: 'right',
  parts: [
    { id: 'hide', label: 'kulit', regionIds: HIDE_REGIONS.map((item) => item.id) },
    { id: 'spots', label: 'bercak', regionIds: [...SPOT_IDS] },
    { id: 'snout', label: 'hidung', regionIds: ['snout', 'udder'] },
    { id: 'horns', label: 'tanduk', regionIds: ['horn-left', 'horn-right'] },
  ],
  lesson: packageLesson({
    id: 'cow',
    title: 'Sapi',
    subtitle: 'Badan, kepala, lalu bercak',
    colorRegions: [
      ...HIDE_REGIONS,
      region('spot-a', 'Bercak belakang', SPOT_A, SPOT),
      region('spot-b', 'Bercak perut', SPOT_B, SPOT),
      region('spot-c', 'Bercak kepala', SPOT_C, SPOT),
      region('spot-d', 'Bercak pundak', SPOT_D, SPOT),
      region('snout', 'Hidung', `${SNOUT} Z`, PINK),
      region('udder', 'Ambing', UDDER, PINK),
      region('horn-left', 'Tanduk belakang', HORN_LEFT, HORN),
      region('horn-right', 'Tanduk depan', HORN_RIGHT, HORN),
    ],
    steps: [
      outline('body', 'Gambar badan sapi.', [
        guide('body', BODY),
      ], 'Badan besar dan panjang.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala menempel di depan badan.'),
      outline('snout', 'Gambar hidung.', [
        guide('snout', SNOUT),
      ], 'Hidung lebar di ujung kepala.'),
      outline('horns', 'Gambar dua tanduk.', [
        guide('horn-left', HORN_LEFT),
        guide('horn-right', HORN_RIGHT),
      ], 'Tanduk melengkung ke atas.'),
      outline('ears', 'Gambar telinga.', [
        guide('ear', EAR),
        guide('ear-inner', EAR_INNER),
      ], 'Telinga lebar di samping kepala, lalu garis di dalamnya.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('udder', 'Gambar ambing.', [
        guide('udder', UDDER),
      ], 'Ambing menggantung, dengan puting di bawah.'),
      outline('spots', 'Gambar bercak.', [
        guide('spot-a', SPOT_A),
        guide('spot-b', SPOT_B),
        guide('spot-c', SPOT_C),
        guide('spot-d', SPOT_D),
      ], 'Bercak besar di badan dan satu di kepala.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor di belakang badan.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata di kepala.'),
      colorStep('color-hide', 'Warnai kulit.', HIDE_REGIONS.map((item) => item.id), HIDE, 'Badan, kepala, telinga, dan kaki.', 56),
      colorStep('color-spots', 'Warnai bercak.', [...SPOT_IDS], SPOT, 'Isi setiap bercak.', 22),
      colorStep('color-snout', 'Warnai hidung dan ambing.', ['snout', 'udder'], PINK, 'Hidung dulu, lalu ambing.', 20),
      colorStep('color-horns', 'Warnai tanduk.', ['horn-left', 'horn-right'], HORN, 'Dua tanduk yang melengkung.', 12),
    ],
  }),
};

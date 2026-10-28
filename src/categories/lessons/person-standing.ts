/**
 * A front-facing standing person, about seven and a half heads tall.
 * Step 1 is one circle. Each later drawing step adds one part: neck, chest,
 * hips, legs, arms, then the real body line, trousers, shoes, face, and hair.
 * Chest, hips, legs, and arms are dashed helpers. They show on their own
 * step and again while the child traces the part they belong to, then they
 * drop out. The last steps are flat colour. The finished ink is only the
 * contour, the clothes, and the face, so no guide is left inside a fill.
 *
 * The coat is the cloth on the figure's left shoulder (the right side of
 * the page). There is no key, halo, or costume mark.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';
import type { GuidePath } from '../../lesson-data/schema';

const SKIN = '#f0c2a0';
const HAIR = '#3a2e28';
const ROBE = '#3d74c4';
const BOTTOM = '#2c3d6e';
const SHOES = '#6b4428';
const CLOAK = '#d24b45';

const HEAD = circle(500, 104, 40);

const NECK_LEFT = 'M 484 140 L 470 198';
const NECK_RIGHT = 'M 516 140 L 530 198';

const TORSO = 'M 420 204 L 580 204 L 552 312 L 448 312 Z';
const HIP = 'M 448 300 L 552 300 L 568 412 L 432 412 Z';

const LEG_LEFT = 'M 468 404 L 440 524 L 424 634';
const LEG_RIGHT = 'M 532 404 L 560 524 L 576 634';
const KNEE_LEFT = ellipse(440, 524, 15, 11);
const KNEE_RIGHT = ellipse(560, 524, 15, 11);
const FOOT_LEFT = 'M 424 634 L 368 678 L 456 678';
const FOOT_RIGHT = 'M 576 634 L 544 678 L 632 678';

const ARM_LEFT = 'M 420 210 L 352 318 L 316 426';
const ARM_RIGHT = 'M 580 210 L 648 318 L 684 426';
const ELBOW_LEFT = ellipse(352, 318, 13, 10);
const ELBOW_RIGHT = ellipse(648, 318, 13, 10);
const HAND_GUIDE_LEFT = circle(308, 448, 22);
const HAND_GUIDE_RIGHT = circle(692, 448, 22);

const BODY_GUIDES: readonly GuidePath[] = [
  guide('torso', TORSO, 'construction'),
  guide('hip', HIP, 'construction'),
  guide('leg-left', LEG_LEFT, 'construction'),
  guide('leg-right', LEG_RIGHT, 'construction'),
  guide('knee-left', KNEE_LEFT, 'construction'),
  guide('knee-right', KNEE_RIGHT, 'construction'),
  guide('foot-left', FOOT_LEFT, 'construction'),
  guide('foot-right', FOOT_RIGHT, 'construction'),
  guide('arm-left', ARM_LEFT, 'construction'),
  guide('arm-right', ARM_RIGHT, 'construction'),
  guide('elbow-left', ELBOW_LEFT, 'construction'),
  guide('elbow-right', ELBOW_RIGHT, 'construction'),
  guide('hand-guide-left', HAND_GUIDE_LEFT, 'construction'),
  guide('hand-guide-right', HAND_GUIDE_RIGHT, 'construction'),
];

const LEG_GUIDES = BODY_GUIDES.filter((path) => /^(leg|knee|foot)-/.test(path.id));

const SHIRT = 'M 482 190 C 452 184 424 194 420 206 L 348 322 L 318 424 L 382 430 L 418 328 L 456 250 L 428 416 L 572 416 L 544 250 L 582 328 L 618 430 L 682 424 L 652 322 L 580 206 C 576 194 548 184 518 190 Q 500 208 482 190 Z';
const HAND_LEFT = 'M 292 418 C 274 444 280 482 314 484 C 346 486 360 452 340 422 C 324 436 304 436 292 418 Z';
const HAND_RIGHT = 'M 708 418 C 726 444 720 482 686 484 C 654 486 640 452 660 422 C 676 436 696 436 708 418 Z';
const CLOAK_EDGE = 'M 508 200 C 518 286 494 352 514 416';

const TROUSER_LEFT_OUTER = 'M 430 414 L 398 648';
const TROUSER_LEFT_INNER = 'M 484 446 L 466 650';
const TROUSER_RIGHT_INNER = 'M 516 446 L 534 650';
const TROUSER_RIGHT_OUTER = 'M 570 414 L 602 648';
const TROUSER_CROTCH = 'M 484 446 Q 500 462 516 446';
const SHOE_LEFT = 'M 358 632 L 348 698 L 486 704 L 470 642 Z';
const SHOE_RIGHT = 'M 530 642 L 514 704 L 652 698 L 642 632 Z';

const BANGS = 'M 468 84 C 486 104 514 104 532 84';

const FACE_CROSS = [
  guide('face-cross-v', 'M 500 64 L 500 144', 'construction'),
  guide('face-cross-h', 'M 464 108 L 536 108', 'construction'),
];

export const PERSON_STANDING_CATEGORY: CategoryLesson = {
  id: 'person-standing',
  status: 'done',
  title: 'Orang Berdiri',
  hint: 'a front-facing standing person. Also called person, man, woman, boy, girl, child, statue of a person, figure, or people standing.',
  facing: 'front',
  parts: [
    { id: 'skin', label: 'kulit', regionIds: ['face', 'neck', 'hand-left', 'hand-right'] },
    { id: 'hair', label: 'rambut', regionIds: ['hair'] },
    { id: 'robe', label: 'baju', regionIds: ['robe'] },
    { id: 'bottom', label: 'celana', regionIds: ['trousers'] },
    { id: 'shoes', label: 'sepatu', regionIds: ['shoe-left', 'shoe-right'] },
    { id: 'cloak', label: 'mantel', regionIds: ['cloak'] },
  ],
  lesson: packageLesson({
    id: 'person-standing',
    title: 'Orang Berdiri',
    subtitle: 'Kepala, badan yang tinggi, lalu baju',
    contentVersion: '1.1.0',
    colorRegions: [
      region('trousers', 'Celana', 'M 420 402 L 386 662 L 492 676 L 500 470 L 508 676 L 614 662 L 580 402 Z', BOTTOM),
      region('robe', 'Baju', 'M 500 198 L 482 190 C 452 184 424 194 420 206 L 348 322 L 318 424 L 382 430 L 418 328 L 456 250 L 428 416 L 500 416 Z', ROBE),
      region('cloak', 'Mantel', 'M 500 198 L 518 190 C 548 184 576 194 580 206 L 652 322 L 682 424 L 618 430 L 582 328 L 544 250 L 572 416 L 500 416 Z', CLOAK),
      region('shoe-left', 'Sepatu kiri', SHOE_LEFT, SHOES),
      region('shoe-right', 'Sepatu kanan', SHOE_RIGHT, SHOES),
      region('neck', 'Leher', 'M 476 136 L 460 206 L 540 206 L 524 136 Z', SKIN),
      region('face', 'Wajah', `${HEAD} Z`, SKIN),
      region('hand-left', 'Tangan kiri', HAND_LEFT, SKIN),
      region('hand-right', 'Tangan kanan', HAND_RIGHT, SKIN),
      region('hair', 'Rambut', 'M 468 84 C 486 104 514 104 532 84 A 40 40 0 0 0 468 84 Z', HAIR),
    ],
    steps: [
      outline('head', 'Gambar lingkaran untuk kepala.', [
        guide('head', HEAD),
      ], 'Mulai dari atas, lalu putar sampai kembali ke titik awal.'),
      outline('neck', 'Gambar leher.', [
        guide('neck-left', NECK_LEFT),
        guide('neck-right', NECK_RIGHT),
      ], 'Dua garis pendek di bawah kepala.'),
      outline('torso', 'Gambar bentuk dada.', [
        guide('torso', TORSO, 'construction'),
      ], 'Bahu lebar, lalu menyempit ke pinggang. Garis ini penolong.'),
      outline('hips', 'Gambar pinggul.', [
        guide('torso', TORSO, 'construction'),
        guide('hip', HIP, 'construction'),
      ], 'Bentuk di bawah pinggang. Garis ini penolong.'),
      outline('legs', 'Gambar dua kaki sampai telapak.', [
        guide('torso', TORSO, 'construction'),
        guide('hip', HIP, 'construction'),
        guide('leg-left', LEG_LEFT, 'construction'),
        guide('leg-right', LEG_RIGHT, 'construction'),
        guide('knee-left', KNEE_LEFT, 'construction'),
        guide('knee-right', KNEE_RIGHT, 'construction'),
        guide('foot-left', FOOT_LEFT, 'construction'),
        guide('foot-right', FOOT_RIGHT, 'construction'),
      ], 'Dari pinggul ke lutut, lalu ke telapak. Garis ini penolong.'),
      outline('arms', 'Gambar dua lengan sampai tangan.', [
        guide('torso', TORSO, 'construction'),
        guide('hip', HIP, 'construction'),
        guide('leg-left', LEG_LEFT, 'construction'),
        guide('leg-right', LEG_RIGHT, 'construction'),
        guide('knee-left', KNEE_LEFT, 'construction'),
        guide('knee-right', KNEE_RIGHT, 'construction'),
        guide('foot-left', FOOT_LEFT, 'construction'),
        guide('foot-right', FOOT_RIGHT, 'construction'),
        guide('arm-left', ARM_LEFT, 'construction'),
        guide('arm-right', ARM_RIGHT, 'construction'),
        guide('elbow-left', ELBOW_LEFT, 'construction'),
        guide('elbow-right', ELBOW_RIGHT, 'construction'),
        guide('hand-guide-left', HAND_GUIDE_LEFT, 'construction'),
        guide('hand-guide-right', HAND_GUIDE_RIGHT, 'construction'),
      ], 'Dari bahu ke siku, lalu ke tangan yang bulat. Garis ini penolong.'),
      outline('contour', 'Gambar garis badan di atas penolong.', [
        ...BODY_GUIDES,
        guide('shirt', SHIRT),
        guide('hand-left', HAND_LEFT),
        guide('hand-right', HAND_RIGHT),
        guide('cloak-edge', CLOAK_EDGE),
      ], 'Baju, lengan, dan tangan. Garis putus-putus tidak ikut disimpan.'),
      outline('trousers', 'Gambar celana.', [
        ...LEG_GUIDES,
        guide('trouser-left-outer', TROUSER_LEFT_OUTER),
        guide('trouser-left-inner', TROUSER_LEFT_INNER),
        guide('trouser-crotch', TROUSER_CROTCH),
        guide('trouser-right-inner', TROUSER_RIGHT_INNER),
        guide('trouser-right-outer', TROUSER_RIGHT_OUTER),
      ], 'Dua kaki di bawah baju.'),
      outline('shoes', 'Gambar sepatu.', [
        guide('foot-left', FOOT_LEFT, 'construction'),
        guide('foot-right', FOOT_RIGHT, 'construction'),
        guide('shoe-left', SHOE_LEFT),
        guide('shoe-right', SHOE_RIGHT),
      ], 'Sepatu menutup ujung kaki.'),
      detail('face', 'Gambar mata, hidung, mulut, dan telinga.', [
        ...FACE_CROSS,
        guide('brow-left', 'M 472 96 Q 484 90 496 96'),
        guide('brow-right', 'M 504 96 Q 516 90 528 96'),
        guide('eye-left', ellipse(484, 108, 7, 5)),
        guide('eye-right', ellipse(516, 108, 7, 5)),
        guide('pupil-left', circle(486, 109, 2)),
        guide('pupil-right', circle(514, 109, 2)),
        guide('nose', 'M 500 114 L 494 128 L 506 130'),
        guide('mouth', 'M 488 136 Q 500 144 512 136'),
        guide('ear-left', 'M 462 96 C 448 100 446 124 462 130'),
        guide('ear-right', 'M 538 96 C 552 100 554 124 538 130'),
      ], 'Garis silang hanya penolong. Mata duduk di garis mendatar.'),
      detail('hair', 'Gambar rambut di atas kepala.', [
        guide('bangs', BANGS),
      ], 'Garis poni di dahi. Bagian atas kepala ikut terwarnai rambut.'),
      colorStep('color-bottom', 'Warnai celana.', ['trousers'], BOTTOM, 'Isi kedua kaki. Warna naik sampai ke balik baju.', 48),
      colorStep('color-robe', 'Warnai baju.', ['robe'], ROBE, 'Isi sisi kiri baju dan lengan kirinya.', 52),
      colorStep('color-cloak', 'Warnai mantel.', ['cloak'], CLOAK, 'Isi kain di bahu kanan gambar. Tumpuk sedikit di garis tengah.', 48),
      colorStep('color-shoes', 'Warnai sepatu.', ['shoe-left', 'shoe-right'], SHOES, 'Isi kedua sepatu sampai menutup ujung celana.', 36),
      colorStep('color-skin', 'Warnai kulit wajah, leher, dan tangan.', ['face', 'neck', 'hand-left', 'hand-right'], SKIN, 'Wajah, leher, lalu kedua tangan.', 32),
      colorStep('color-hair', 'Warnai rambut.', ['hair'], HAIR, 'Isi bagian atas kepala, sampai menutup dahi di balik poni.', 28),
    ],
  }),
};

/**
 * A front-facing standing person. Step 1 is the head circle. The triangle,
 * the hip, and the stick limbs are dashed construction: they show on their
 * own steps and again while the contour is traced, then they drop out.
 * The finished ink is only the contour, the clothes, and the face, so no
 * guide is left inside a flat colour.
 *
 * The cloak is the cloth on the figure's left shoulder (the right side of
 * the page). There is no key, halo, or costume mark.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const SKIN = '#f0c2a0';
const HAIR = '#3a2e28';
const ROBE = '#3d74c4';
const BOTTOM = '#2c3d6e';
const SHOES = '#6b4428';
const CLOAK = '#d24b45';

const HEAD = circle(500, 118, 64);

const TORSO = 'M 408 198 L 592 198 L 500 352 Z';
const HIP = 'M 458 328 L 542 328 L 500 392 Z';

const LEG_LEFT = 'M 472 378 L 442 510 L 418 628';
const LEG_RIGHT = 'M 528 378 L 558 510 L 582 628';
const KNEE_LEFT = ellipse(442, 510, 18, 14);
const KNEE_RIGHT = ellipse(558, 510, 18, 14);
const HIP_LEFT = ellipse(472, 378, 16, 12);
const HIP_RIGHT = ellipse(528, 378, 16, 12);
const FOOT_LEFT = 'M 418 628 L 368 656 L 458 656';
const FOOT_RIGHT = 'M 582 628 L 542 656 L 632 656';

const ARM_LEFT = 'M 408 204 L 342 300 L 298 408';
const ARM_RIGHT = 'M 592 204 L 658 300 L 702 408';
const ELBOW_LEFT = ellipse(342, 300, 16, 13);
const ELBOW_RIGHT = ellipse(658, 300, 16, 13);
const SHOULDER_LEFT = ellipse(408, 200, 16, 12);
const SHOULDER_RIGHT = ellipse(592, 200, 16, 12);
const HAND_GUIDE_LEFT = circle(290, 440, 22);
const HAND_GUIDE_RIGHT = circle(710, 440, 22);

const CONSTRUCTION = [
  guide('torso', TORSO, 'construction'),
  guide('hip', HIP, 'construction'),
  guide('leg-left', LEG_LEFT, 'construction'),
  guide('leg-right', LEG_RIGHT, 'construction'),
  guide('knee-left', KNEE_LEFT, 'construction'),
  guide('knee-right', KNEE_RIGHT, 'construction'),
  guide('hip-joint-left', HIP_LEFT, 'construction'),
  guide('hip-joint-right', HIP_RIGHT, 'construction'),
  guide('foot-left', FOOT_LEFT, 'construction'),
  guide('foot-right', FOOT_RIGHT, 'construction'),
  guide('arm-left', ARM_LEFT, 'construction'),
  guide('arm-right', ARM_RIGHT, 'construction'),
  guide('elbow-left', ELBOW_LEFT, 'construction'),
  guide('elbow-right', ELBOW_RIGHT, 'construction'),
  guide('shoulder-left', SHOULDER_LEFT, 'construction'),
  guide('shoulder-right', SHOULDER_RIGHT, 'construction'),
  guide('hand-guide-left', HAND_GUIDE_LEFT, 'construction'),
  guide('hand-guide-right', HAND_GUIDE_RIGHT, 'construction'),
];

const NECK_LEFT = 'M 474 172 L 458 214';
const NECK_RIGHT = 'M 526 172 L 542 214';
const TUNIC = 'M 462 206 L 398 196 C 348 232 308 312 290 388 L 330 414 C 362 332 402 272 428 250 L 396 512 L 604 512 L 572 250 C 598 272 638 332 670 414 L 710 388 C 692 312 652 232 602 196 L 538 206 C 522 228 478 228 462 206 Z';
const HAND_LEFT = 'M 268 400 C 248 448 270 482 308 484 C 346 486 366 448 344 402 C 322 416 292 416 268 400 Z';
const HAND_RIGHT = 'M 732 400 C 752 448 730 482 692 484 C 654 486 634 448 656 402 C 678 416 708 416 732 400 Z';

const TROUSER_LEFT_OUTER = 'M 404 512 L 386 624';
const TROUSER_LEFT_INNER = 'M 478 536 L 466 626';
const TROUSER_RIGHT_INNER = 'M 522 536 L 534 626';
const TROUSER_RIGHT_OUTER = 'M 596 512 L 614 624';
const TROUSER_CROTCH = 'M 478 536 L 522 536';
const SHOE_LEFT = 'M 352 618 L 344 678 L 484 684 L 470 626 Z';
const SHOE_RIGHT = 'M 530 626 L 516 684 L 656 678 L 648 618 Z';
const CLOAK_EDGE = 'M 508 214 C 528 318 492 420 516 512';

const BANGS = 'M 440 96 C 470 126 530 126 560 96';

const FACE_CROSS = [
  guide('face-cross-v', 'M 500 54 L 500 182', 'construction'),
  guide('face-cross-h', 'M 440 132 L 560 132', 'construction'),
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
    subtitle: 'Kepala bulat, badan, lalu baju',
    colorRegions: [
      region('trousers', 'Celana', 'M 388 478 L 368 650 L 478 658 L 492 548 L 508 548 L 522 658 L 632 650 L 612 478 Z', BOTTOM),
      region('robe', 'Baju', 'M 530 188 L 462 206 L 398 196 C 348 232 308 312 290 388 L 330 414 C 362 332 402 272 428 250 L 396 528 L 548 528 L 548 250 Z', ROBE),
      region('cloak', 'Mantel', 'M 496 206 C 520 310 484 412 510 528 L 604 528 L 572 250 C 598 272 638 332 670 414 L 710 388 C 692 312 652 232 602 196 L 538 206 C 520 230 500 230 496 206 Z', CLOAK),
      region('shoe-left', 'Sepatu kiri', SHOE_LEFT, SHOES),
      region('shoe-right', 'Sepatu kanan', SHOE_RIGHT, SHOES),
      region('neck', 'Leher', 'M 470 158 L 450 228 L 550 228 L 530 158 Z', SKIN),
      region('face', 'Wajah', `${HEAD} Z`, SKIN),
      region('hand-left', 'Tangan kiri', HAND_LEFT, SKIN),
      region('hand-right', 'Tangan kanan', HAND_RIGHT, SKIN),
      region('hair', 'Rambut', 'M 440 96 C 470 126 530 126 560 96 A 64 64 0 0 0 440 96 Z', HAIR),
    ],
    steps: [
      outline('head', 'Gambar lingkaran untuk kepala.', [
        guide('head', HEAD),
      ], 'Mulai dari atas, lalu putar sampai kembali ke titik awal.'),
      outline('torso', 'Gambar segitiga badan dan segitiga pinggul.', [
        guide('torso', TORSO, 'construction'),
        guide('hip', HIP, 'construction'),
      ], 'Segitiga besar menghadap ke bawah, lalu segitiga kecil untuk pinggul.'),
      outline('legs', 'Gambar dua kaki, lutut, dan telapak.', [
        guide('leg-left', LEG_LEFT, 'construction'),
        guide('leg-right', LEG_RIGHT, 'construction'),
        guide('knee-left', KNEE_LEFT, 'construction'),
        guide('knee-right', KNEE_RIGHT, 'construction'),
        guide('hip-joint-left', HIP_LEFT, 'construction'),
        guide('hip-joint-right', HIP_RIGHT, 'construction'),
        guide('foot-left', FOOT_LEFT, 'construction'),
        guide('foot-right', FOOT_RIGHT, 'construction'),
      ], 'Garis dari pinggul, lonjong di lutut, lalu telapak.'),
      outline('arms', 'Gambar dua lengan dan tangan.', [
        guide('arm-left', ARM_LEFT, 'construction'),
        guide('arm-right', ARM_RIGHT, 'construction'),
        guide('elbow-left', ELBOW_LEFT, 'construction'),
        guide('elbow-right', ELBOW_RIGHT, 'construction'),
        guide('shoulder-left', SHOULDER_LEFT, 'construction'),
        guide('shoulder-right', SHOULDER_RIGHT, 'construction'),
        guide('hand-guide-left', HAND_GUIDE_LEFT, 'construction'),
        guide('hand-guide-right', HAND_GUIDE_RIGHT, 'construction'),
      ], 'Dari bahu ke siku, lalu ke tangan yang bulat.'),
      outline('contour', 'Gambar garis badan di atas penolong.', [
        ...CONSTRUCTION,
        guide('neck-left', NECK_LEFT),
        guide('neck-right', NECK_RIGHT),
        guide('tunic', TUNIC),
        guide('hand-left', HAND_LEFT),
        guide('hand-right', HAND_RIGHT),
      ], 'Leher, baju, lengan, dan tangan. Garis putus-putus tidak ikut disimpan.'),
      outline('clothes', 'Gambar celana, sepatu, dan tepi mantel.', [
        guide('trouser-left-outer', TROUSER_LEFT_OUTER),
        guide('trouser-left-inner', TROUSER_LEFT_INNER),
        guide('trouser-crotch', TROUSER_CROTCH),
        guide('trouser-right-inner', TROUSER_RIGHT_INNER),
        guide('trouser-right-outer', TROUSER_RIGHT_OUTER),
        guide('shoe-left', SHOE_LEFT),
        guide('shoe-right', SHOE_RIGHT),
        guide('cloak-edge', CLOAK_EDGE),
      ], 'Celana di bawah baju, sepatu di ujung kaki, satu garis mantel di depan.'),
      detail('face', 'Gambar mata, hidung, mulut, dan telinga.', [
        ...FACE_CROSS,
        guide('brow-left', 'M 464 116 Q 476 108 490 116'),
        guide('brow-right', 'M 510 116 Q 524 108 536 116'),
        guide('eye-left', ellipse(476, 132, 9, 6)),
        guide('eye-right', ellipse(524, 132, 9, 6)),
        guide('pupil-left', circle(478, 133, 3)),
        guide('pupil-right', circle(526, 133, 3)),
        guide('nose', 'M 500 140 L 494 156 L 508 158'),
        guide('mouth', 'M 486 168 Q 500 178 514 168'),
        guide('ear-left', 'M 438 118 C 422 122 420 150 440 156'),
        guide('ear-right', 'M 562 118 C 578 122 580 150 560 156'),
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

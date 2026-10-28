/**
 * A long dinosaur in side view, facing right. The neck and tail
 * keep it from reading as a round toy.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const GREEN = '#6f9b4a';
const BELLY = '#d7e6b0';

const BODY = ellipse(430, 500, 155, 95);
const NECK = 'M 545 470 L 700 250 L 760 275 L 610 510 Z';
const HEAD = ellipse(810, 235, 58, 34);
const TAIL = 'M 285 505 C 160 520 70 610 40 700';
const LEG_FRONT = 'M 500 560 L 488 690 Q 530 712 572 688 L 555 552 Z';
const LEG_BACK = 'M 320 565 L 300 692 Q 345 716 392 688 L 375 555 Z';
const PLATE_A = 'M 360 420 L 390 350 L 420 420 Z';
const PLATE_B = 'M 450 415 L 480 345 L 510 415 Z';
const EYE = circle(830, 225, 6);
const PUPIL = circle(832, 226, 3);

const BODY_REGIONS = [
  region('body', 'Badan', `${BODY} Z`, GREEN),
  region('neck', 'Leher', NECK, GREEN),
  region('head', 'Kepala', `${HEAD} Z`, GREEN),
  region('leg-front', 'Kaki depan', LEG_FRONT, GREEN),
  region('leg-back', 'Kaki belakang', LEG_BACK, GREEN),
  region('plate-a', 'Pelat belakang', PLATE_A, GREEN),
  region('plate-b', 'Pelat depan', PLATE_B, GREEN),
];

export const DINOSAUR_CATEGORY: CategoryLesson = {
  id: 'dinosaur',
  status: 'done',
  title: 'Dinosaurus',
  hint: 'a dinosaur, including a long-necked dinosaur. Also called dinosaurus.',
  facing: 'right',
  parts: [
    { id: 'body', label: 'badan', regionIds: BODY_REGIONS.map((item) => item.id) },
    { id: 'belly', label: 'perut', regionIds: ['belly'] },
  ],
  lesson: packageLesson({
    id: 'dinosaur',
    title: 'Dinosaurus',
    subtitle: 'Badan, leher, lalu ekor',
    colorRegions: [
      ...BODY_REGIONS,
      region('belly', 'Perut', ellipse(430, 530, 90, 36) + ' Z', BELLY),
    ],
    steps: [
      outline('body', 'Gambar badan dinosaurus.', [
        guide('body', BODY),
      ], 'Badan lonjong di tengah.'),
      outline('neck', 'Gambar leher.', [
        guide('neck', NECK),
      ], 'Leher naik ke kanan.'),
      outline('head', 'Gambar kepala.', [
        guide('head', HEAD),
      ], 'Kepala kecil di ujung leher.'),
      outline('tail', 'Gambar ekor.', [
        guide('tail', TAIL),
      ], 'Ekor panjang ke kiri, makin kecil di ujung.'),
      outline('legs', 'Gambar dua kaki.', [
        guide('leg-back', LEG_BACK),
        guide('leg-front', LEG_FRONT),
      ], 'Kaki belakang dulu, lalu kaki depan.'),
      outline('plates', 'Gambar pelat di punggung.', [
        guide('plate-a', PLATE_A),
        guide('plate-b', PLATE_B),
      ], 'Dua segitiga di atas badan.'),
      detail('face', 'Gambar mata.', [
        guide('eye', EYE),
        guide('pupil', PUPIL),
      ], 'Mata kecil di kepala.'),
      colorStep('color-body', 'Warnai badan.', BODY_REGIONS.map((item) => item.id), GREEN, 'Badan, leher, kepala, kaki, dan pelat.', 52),
      colorStep('color-belly', 'Warnai perut.', ['belly'], BELLY, 'Perut yang lebih muda di bawah badan.', 28),
    ],
  }),
};

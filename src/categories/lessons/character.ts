/**
 * An original cartoon head and shoulders. Step 1 is the cranium circle,
 * left open at the chin so the jaw can close it. A dashed cross is only
 * there while the jaw and the eyes are placed.
 *
 * The hair, the jaw, and the eyes are generic. Nothing here is a costume,
 * a mask, or a copied character.
 */

import { circle } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const SKIN = '#f3c9a8';
const HAIR = '#2e3348';
const SHIRT = '#3d8b8b';
const IRIS = '#5c4632';
const WHITE = '#f7f7f7';

const CX = 500;
const CY = 295;
const R = 170;

const CROWN = `M 442 455 A ${R} ${R} 0 1 1 558 455`;
const CHIN = 'M 442 455 C 458 528 542 528 558 455';
const FACE = `${CROWN} C 542 528 458 528 442 455 Z`;

const CROSS = [
  guide('cross-v', `M ${CX} 125 L ${CX} 530`, 'construction'),
  guide('cross-h', `M 330 ${CY} L 670 ${CY}`, 'construction'),
];

const EYE_LEFT = 'M 385 302 C 402 258 468 258 482 302 C 468 340 402 340 385 302 Z';
const EYE_RIGHT = 'M 518 302 C 532 258 598 258 615 302 C 598 340 532 340 518 302 Z';
const IRIS_LEFT = circle(438, 308, 18);
const IRIS_RIGHT = circle(562, 308, 18);
const PUPIL_LEFT = circle(442, 310, 8);
const PUPIL_RIGHT = circle(558, 310, 8);
const SHINE_LEFT = circle(428, 298, 5);
const SHINE_RIGHT = circle(552, 298, 5);

const EAR_LEFT = 'M 358 268 C 308 280 304 362 360 392';
const EAR_RIGHT = 'M 642 268 C 692 280 696 362 640 392';
const NECK_LEFT = 'M 452 492 L 424 598';
const NECK_RIGHT = 'M 548 492 L 576 598';
const SHOULDER_LEFT = 'M 424 598 C 330 640 230 700 188 734';
const SHOULDER_RIGHT = 'M 576 598 C 670 640 770 700 812 734';
const COLLAR = 'M 424 598 Q 500 656 576 598';

const BANGS = 'M 353 210 C 420 286 470 268 500 296 C 530 268 580 286 647 210';
const LOCK_LEFT = 'M 348 225 C 290 260 255 370 272 470 C 286 530 350 555 418 525';
const LOCK_RIGHT = 'M 652 225 C 710 260 745 370 728 470 C 714 530 650 555 582 525';

const HAIR_TOP = `${BANGS} A ${R} ${R} 0 0 0 353 210 Z`;
// The inner edge tucks across the cheek so the jaw has no paper seam.
const LOCK_LEFT_FILL = 'M 348 225 C 290 260 255 370 272 470 C 286 530 350 555 418 525 L 470 500 C 430 430 400 330 385 235 Z';
const LOCK_RIGHT_FILL = 'M 652 225 C 710 260 745 370 728 470 C 714 530 650 555 582 525 L 530 500 C 570 430 600 330 615 235 Z';

const SHIRT_FILL = 'M 400 575 C 310 630 210 700 180 740 L 820 740 C 790 700 690 630 600 575 C 555 630 445 630 400 575 Z';
const NECK_FILL = 'M 448 470 L 410 640 L 590 640 L 552 470 Z';
const EAR_LEFT_FILL = `${EAR_LEFT} C 348 360 340 300 358 268 Z`;
const EAR_RIGHT_FILL = `${EAR_RIGHT} C 652 360 660 300 642 268 Z`;

export const CHARACTER_CATEGORY: CategoryLesson = {
  id: 'character',
  status: 'done',
  title: 'Tokoh',
  hint: 'an original cartoon or anime head and shoulders. Also called anime character, cartoon character, face, portrait, doll, action figure, or superhero.',
  facing: 'front',
  parts: [
    { id: 'skin', label: 'kulit', regionIds: ['face', 'neck', 'ear-left', 'ear-right'] },
    { id: 'hair', label: 'rambut', regionIds: ['hair', 'lock-left', 'lock-right'] },
    { id: 'shirt', label: 'baju', regionIds: ['shirt'] },
    { id: 'eyes', label: 'mata', regionIds: ['iris-left', 'iris-right'] },
  ],
  lesson: packageLesson({
    id: 'character',
    title: 'Tokoh',
    subtitle: 'Lingkaran kepala, dagu, lalu rambut',
    colorRegions: [
      region('shirt', 'Baju', SHIRT_FILL, SHIRT),
      region('face', 'Wajah', FACE, SKIN),
      region('neck', 'Leher', NECK_FILL, SKIN),
      region('hair', 'Rambut', HAIR_TOP, HAIR),
      region('lock-left', 'Rambut kiri', LOCK_LEFT_FILL, HAIR),
      region('lock-right', 'Rambut kanan', LOCK_RIGHT_FILL, HAIR),
      region('ear-left', 'Telinga kiri', EAR_LEFT_FILL, SKIN),
      region('ear-right', 'Telinga kanan', EAR_RIGHT_FILL, SKIN),
      region('eye-left', 'Mata kiri', EYE_LEFT, WHITE),
      region('eye-right', 'Mata kanan', EYE_RIGHT, WHITE),
      region('iris-left', 'Iris kiri', `${IRIS_LEFT} Z`, IRIS),
      region('iris-right', 'Iris kanan', `${IRIS_RIGHT} Z`, IRIS),
      region('shine-left', 'Kilau kiri', `${SHINE_LEFT} Z`, WHITE),
      region('shine-right', 'Kilau kanan', `${SHINE_RIGHT} Z`, WHITE),
    ],
    steps: [
      outline('head', 'Gambar lingkaran untuk kepala.', [
        guide('crown', CROWN),
      ], 'Hampir satu lingkaran penuh. Sisakan bagian bawah untuk dagu.'),
      outline('jaw', 'Gambar dagu di bawah lingkaran.', [
        ...CROSS,
        guide('chin', CHIN),
      ], 'Garis silang hanya penolong. Dagu menghubungkan ujung lingkaran.'),
      detail('eyes', 'Gambar dua mata di garis penolong.', [
        ...CROSS,
        guide('eye-left', EYE_LEFT),
        guide('eye-right', EYE_RIGHT),
        guide('iris-left', IRIS_LEFT),
        guide('iris-right', IRIS_RIGHT),
        guide('pupil-left', PUPIL_LEFT),
        guide('pupil-right', PUPIL_RIGHT),
      ], 'Mata besar duduk di garis mendatar. Iris dan pupil di dalamnya.'),
      outline('ears-neck', 'Gambar telinga, leher, dan bahu.', [
        guide('ear-left', EAR_LEFT),
        guide('ear-right', EAR_RIGHT),
        guide('neck-left', NECK_LEFT),
        guide('neck-right', NECK_RIGHT),
        guide('shoulder-left', SHOULDER_LEFT),
        guide('shoulder-right', SHOULDER_RIGHT),
        guide('collar', COLLAR),
      ], 'Telinga di samping kepala, leher turun, bahu melebar.'),
      detail('nose-mouth', 'Gambar hidung dan mulut.', [
        guide('nose', 'M 500 338 L 490 372'),
        guide('mouth', 'M 474 400 Q 500 420 526 400'),
      ], 'Hidung garis pendek. Mulut lengkung kecil di bawahnya.'),
      detail('hair', 'Gambar rambut.', [
        guide('bangs', BANGS),
        guide('lock-left', LOCK_LEFT),
        guide('lock-right', LOCK_RIGHT),
      ], 'Poni di dahi, lalu rambut di samping turun melewati dagu.'),
      colorStep('color-shirt', 'Warnai baju.', ['shirt'], SHIRT, 'Isi bahu dan baju di bawah leher.', 52),
      colorStep('color-skin', 'Warnai kulit wajah dan leher.', ['face', 'neck'], SKIN, 'Isi wajah, lalu leher sampai ke baju.', 48),
      colorStep('color-hair', 'Warnai rambut.', ['hair', 'lock-left', 'lock-right'], HAIR, 'Isi rambut di atas poni dan di kedua sisi. Tumpuk sedikit di pipi.', 44),
      colorStep('color-ears', 'Warnai telinga.', ['ear-left', 'ear-right'], SKIN, 'Isi kedua telinga di atas rambut.', 20),
      colorStep('color-eyes', 'Warnai bagian putih mata.', ['eye-left', 'eye-right'], WHITE, 'Isi kedua mata, jangan sampai keluar garis.', 22),
      colorStep('color-irises', 'Warnai iris mata.', ['iris-left', 'iris-right'], IRIS, 'Lingkaran warna di dalam mata.', 16),
      colorStep('color-shine', 'Warnai kilau pada mata.', ['shine-left', 'shine-right'], WHITE, 'Titik kecil di atas iris.', 10),
    ],
  }),
};

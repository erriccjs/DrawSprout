/**
 * Sitting cat, front view. Step 1 is the head circle. A dashed cross on the
 * face step is construction only and is not part of the finished drawing.
 */

import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const FUR = '#e8a33d';
const PINK = '#f2a6b3';

const HEAD = 'M 385 215 A 115 115 0 1 1 615 215 A 115 115 0 1 1 385 215';
const EAR_LEFT = 'M 400 158 L 405 45 L 470 104';
const EAR_RIGHT = 'M 600 158 L 595 45 L 530 104';
const BODY = 'M 418 300 C 340 360 325 520 352 625 C 372 700 628 700 648 625 C 675 520 660 360 582 300';
const PAW_LEFT = 'M 408 660 C 388 672 390 700 414 704 C 446 708 464 692 458 672 C 452 658 428 652 408 660';
const PAW_RIGHT = 'M 592 660 C 612 672 610 700 586 704 C 554 708 536 692 542 672 C 548 658 572 652 592 660';
const TAIL = 'M 648 575 C 745 595 800 505 776 425 C 762 378 712 362 694 400';
const EYE_LEFT = 'M 438 205 A 17 17 0 1 1 472 205 A 17 17 0 1 1 438 205';
const EYE_RIGHT = 'M 528 205 A 17 17 0 1 1 562 205 A 17 17 0 1 1 528 205';
const NOSE = 'M 484 252 L 516 252 L 500 270 Z';
const MOUTH_LEFT = 'M 500 270 C 500 288 480 292 468 280';
const MOUTH_RIGHT = 'M 500 270 C 500 288 520 292 532 280';
const WHISKERS_LEFT = ['M 470 262 L 378 246', 'M 470 272 L 372 272', 'M 470 282 L 378 300'];
const WHISKERS_RIGHT = ['M 530 262 L 622 246', 'M 530 272 L 628 272', 'M 530 282 L 622 300'];
const INNER_EAR_LEFT = 'M 408 141 L 411 62 L 457 104 Z';
const INNER_EAR_RIGHT = 'M 592 141 L 589 62 L 543 104 Z';

const FUR_REGIONS = [
  region('fur-head', 'Kepala', `${HEAD} Z`, FUR),
  region('fur-ear-left', 'Telinga kiri', `${EAR_LEFT} Z`, FUR),
  region('fur-ear-right', 'Telinga kanan', `${EAR_RIGHT} Z`, FUR),
  region('fur-body', 'Badan', `${BODY} Z`, FUR),
  region('fur-paw-left', 'Kaki kiri', `${PAW_LEFT} Z`, FUR),
  region('fur-paw-right', 'Kaki kanan', `${PAW_RIGHT} Z`, FUR),
  region('fur-tail', 'Ekor', `${TAIL} Z`, FUR),
];

const FACE_REGIONS = [
  region('inner-ear-left', 'Dalam telinga kiri', INNER_EAR_LEFT, PINK),
  region('inner-ear-right', 'Dalam telinga kanan', INNER_EAR_RIGHT, PINK),
  region('nose', 'Hidung', NOSE, PINK),
];

export const CAT_CATEGORY: CategoryLesson = {
  id: 'cat',
  status: 'done',
  title: 'Kucing',
  hint: 'a cat or kitten',
  facing: 'right',
  parts: [
    { id: 'fur', label: 'bulu', regionIds: FUR_REGIONS.map((item) => item.id) },
    { id: 'face', label: 'hidung dan telinga', regionIds: FACE_REGIONS.map((item) => item.id) },
  ],
  lesson: packageLesson({
    id: 'cat',
    title: 'Kucing',
    subtitle: 'Lingkaran kepala, lalu badan dan wajah',
    colorRegions: [...FUR_REGIONS, ...FACE_REGIONS],
    steps: [
      outline('head', 'Gambar lingkaran besar untuk kepala.', [
        guide('head', HEAD),
      ], 'Mulai dari atas, lalu putar sampai kembali ke titik awal.'),
      outline('ears', 'Tambahkan dua telinga di atas kepala.', [
        guide('ear-left', EAR_LEFT),
        guide('ear-right', EAR_RIGHT),
      ], 'Seperti dua gunung kecil yang menempel di kepala.'),
      outline('body', 'Gambar badan kucing di bawah kepala.', [
        guide('body', BODY),
      ], 'Badan kucing duduk melebar ke bawah, seperti buah pir.'),
      outline('paws', 'Gambar dua kaki depan di bawah badan.', [
        guide('paw-left', PAW_LEFT),
        guide('paw-right', PAW_RIGHT),
      ], 'Dua bulatan kecil yang duduk di lantai.', 6),
      detail('tail', 'Gambar ekor yang melengkung ke kanan.', [
        guide('tail', TAIL),
      ], 'Satu garis panjang dari samping badan, naik lalu melengkung.', 6),
      detail('face', 'Gambar dua mata dan satu hidung.', [
        guide('face-cross-v', 'M 500 120 L 500 310', 'construction'),
        guide('face-cross-h', 'M 400 215 L 600 215', 'construction'),
        guide('eye-left', EYE_LEFT),
        guide('eye-right', EYE_RIGHT),
        guide('nose', NOSE),
      ], 'Garis putus-putus hanya penolong. Mata di tengah, hidung di bawahnya.'),
      detail('whiskers', 'Gambar mulut dan kumis.', [
        guide('mouth-left', MOUTH_LEFT),
        guide('mouth-right', MOUTH_RIGHT),
        ...WHISKERS_LEFT.map((d, index) => guide(`whisker-left-${index + 1}`, d)),
        ...WHISKERS_RIGHT.map((d, index) => guide(`whisker-right-${index + 1}`, d)),
      ], 'Mulut seperti huruf w kecil, lalu tiga kumis di setiap sisi.'),
      colorStep('color-fur', 'Warnai bulu kucing.', FUR_REGIONS.map((item) => item.id), FUR, 'Pakai kuas besar. Warna dari fotomu juga boleh.', 48),
      colorStep('color-face', 'Warnai dalam telinga dan hidung.', FACE_REGIONS.map((item) => item.id), PINK, 'Bagian ini kecil, jadi kuasnya lebih kecil.', 18),
    ],
  }),
};

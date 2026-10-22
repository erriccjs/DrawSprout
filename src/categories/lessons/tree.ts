/**
 * A tree, not an apple tree. Step 1 is the round crown. The trunk fill runs
 * up into the crown, and the leaf colour covers that overlap so the trunk
 * looks as if it goes behind the leaves.
 */

import { circle, ellipse } from '../shapes';
import { colorStep, detail, guide, outline, packageLesson, region } from '../author';
import type { CategoryLesson } from '../types';

const LEAF = '#3e9a55';
const BARK = '#8b5a2b';

const CROWN = circle(500, 270, 165);
const CLUMP_LEFT = ellipse(345, 335, 100, 78);
const CLUMP_RIGHT = ellipse(650, 305, 95, 72);
const TRUNK = 'M 458 360 L 542 360 L 542 640 L 458 640 Z';
const BRANCH_RIGHT = 'M 510 400 Q 590 330 640 220';
const BRANCH_LEFT = 'M 490 430 Q 410 350 360 240';
const ROOT_LEFT = 'M 475 600 L 345 695 L 505 650 Z';
const ROOT_RIGHT = 'M 525 600 L 665 700 L 495 650 Z';

const BARK_REGIONS = ['trunk', 'root-left', 'root-right'];
const LEAF_REGIONS = ['crown', 'clump-left', 'clump-right'];

export const TREE_CATEGORY: CategoryLesson = {
  id: 'tree',
  status: 'done',
  title: 'Pohon',
  hint: 'a tree with a round crown and a trunk, not a fruit tree',
  facing: 'front',
  parts: [
    { id: 'leaves', label: 'daun', regionIds: LEAF_REGIONS },
    { id: 'trunk', label: 'batang', regionIds: BARK_REGIONS },
  ],
  lesson: packageLesson({
    id: 'tree',
    title: 'Pohon',
    subtitle: 'Daun bulat, batang, lalu cabang',
    colorRegions: [
      region('trunk', 'Batang', TRUNK, BARK),
      region('root-left', 'Akar kiri', ROOT_LEFT, BARK),
      region('root-right', 'Akar kanan', ROOT_RIGHT, BARK),
      region('crown', 'Daun', `${CROWN} Z`, LEAF),
      region('clump-left', 'Daun kiri', `${CLUMP_LEFT} Z`, LEAF),
      region('clump-right', 'Daun kanan', `${CLUMP_RIGHT} Z`, LEAF),
    ],
    steps: [
      outline('crown', 'Gambar lingkaran besar untuk daun.', [
        guide('crown', CROWN),
      ], 'Ini bagian pohon yang paling besar.'),
      outline('trunk', 'Gambar batang di bawah daun.', [
        guide('trunk', TRUNK),
      ], 'Persegi panjang yang masuk ke dalam lingkaran.'),
      outline('clumps', 'Gambar dua gumpalan daun di samping.', [
        guide('clump-left', CLUMP_LEFT),
        guide('clump-right', CLUMP_RIGHT),
      ], 'Satu di kiri dan satu di kanan, menempel di lingkaran.'),
      detail('branches', 'Gambar dua cabang di dalam daun.', [
        guide('branch-left', BRANCH_LEFT),
        guide('branch-right', BRANCH_RIGHT),
      ], 'Garis melengkung dari batang ke dalam daun.'),
      outline('roots', 'Gambar dua akar di bawah batang.', [
        guide('root-left', ROOT_LEFT),
        guide('root-right', ROOT_RIGHT),
      ], 'Seperti dua kaki kecil yang menempel di tanah.', 6),
      colorStep('color-trunk', 'Warnai batang dan akar.', BARK_REGIONS, BARK, 'Batang dulu, lalu kedua akar.', 40),
      colorStep('color-leaves', 'Warnai daun.', LEAF_REGIONS, LEAF, 'Lingkaran besar dulu, lalu dua gumpalan.', 52),
    ],
  }),
};

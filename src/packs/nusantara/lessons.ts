/**
 * Eight simple pictures with Indonesian subjects.
 *
 * The drawing is a how-to-draw page: one big shape, then parts, then colour.
 * Shapes sit apart or meet only at an endpoint, so the outline check stays clear.
 * Wayang here is the gunungan mountain, a scenic frame, not a sacred figure.
 * Ondel-ondel is the tall Jakarta costume, drawn gently.
 */

import { circle, ellipse } from '../../categories/shapes';
import { colorStep, guide, outline, packageLesson, region } from '../../categories/author';
import type { LessonPackage } from '../../lesson-data/schema';

const GOLD = '#e6b84a';
const RED = '#c23b3b';
const BROWN = '#8b5a2b';
const GREEN = '#2f7d4a';
const CREAM = '#f3e2b3';
const BLUE = '#7eb6e8';
const INK = '#3a3a3a';
const SKIN = '#e0b080';

function box(x: number, y: number, w: number, h: number): string {
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

export const GUNUNGAN_LESSON: LessonPackage = packageLesson({
  id: 'wayang-gunungan',
  title: 'Gunungan',
  subtitle: 'Gunung wayang, lalu pohon di dalamnya',
  colorRegions: [
    region('mountain', 'Gunung', 'M 500 80 L 190 640 L 810 640 Z', GOLD),
    region('panel', 'Panel', box(430, 430, 140, 140), RED),
    region('trunk', 'Batang', box(470, 250, 60, 150), BROWN),
    region('jewel', 'Hiasan', `${circle(500, 500, 22)} Z`, GREEN),
  ],
  steps: [
    outline('mountain', 'Gambar gunung besar, lancip di atas.', [
      guide('mountain', 'M 500 80 L 190 640 L 810 640 Z'),
    ], 'Dua sisi miring, lalu garis bawah.'),
    outline('panel', 'Gambar panel di tengah gunung.', [
      guide('panel', box(430, 430, 140, 140)),
    ], 'Persegi di dalam gunung.'),
    outline('trunk', 'Gambar batang pohon di atas panel.', [
      guide('trunk', box(470, 250, 60, 150)),
    ], 'Persegi panjang yang berdiri.'),
    outline('branches', 'Gambar dua cabang dari batang.', [
      guide('branch-left', 'M 470 300 L 430 270'),
      guide('branch-right', 'M 530 300 L 570 270'),
    ], 'Satu ke kiri, satu ke kanan.'),
    outline('jewel', 'Gambar lingkaran hiasan di panel.', [
      guide('jewel', circle(500, 500, 22)),
    ], 'Lingkaran kecil di tengah panel.'),
    colorStep('color-mountain', 'Warnai gunung.', ['mountain'], GOLD, 'Isi bentuk gunung.', 56),
    colorStep('color-panel', 'Warnai panel.', ['panel'], RED, 'Isi persegi di tengah.', 36),
    colorStep('color-trunk', 'Warnai batang.', ['trunk'], BROWN, 'Isi batang pohon.', 28),
    colorStep('color-jewel', 'Warnai hiasan.', ['jewel'], GREEN, 'Isi lingkaran kecil.', 16),
  ],
});

export const RUMAH_GADANG_LESSON: LessonPackage = packageLesson({
  id: 'rumah-gadang',
  title: 'Rumah Gadang',
  subtitle: 'Atap melengkung, lalu dinding',
  colorRegions: [
    region('walls', 'Dinding', box(300, 400, 400, 240), CREAM),
    region('roof', 'Atap', 'M 180 370 Q 340 120 500 230 Q 660 120 820 370 Z', RED),
    region('door', 'Pintu', box(455, 500, 110, 140), BROWN),
    region('window', 'Jendela', box(340, 460, 80, 80), BLUE),
  ],
  steps: [
    outline('walls', 'Gambar persegi besar untuk dinding.', [
      guide('walls', box(300, 400, 400, 240)),
    ], 'Ini badan rumah.'),
    outline('stilts', 'Gambar dua tiang di bawah dinding.', [
      guide('stilt-left', 'M 380 640 L 360 710'),
      guide('stilt-right', 'M 620 640 L 640 710'),
    ], 'Tiang menopang rumah.'),
    outline('roof', 'Gambar atap yang melengkung ke atas.', [
      guide('roof', 'M 180 370 Q 340 120 500 230 Q 660 120 820 370 Z'),
    ], 'Dua tanduk di kiri dan kanan.'),
    outline('door', 'Gambar pintu di dinding.', [
      guide('door', box(455, 500, 110, 140)),
    ], 'Persegi panjang di tengah bawah.'),
    outline('window', 'Gambar jendela di samping pintu.', [
      guide('window', box(340, 460, 80, 80)),
    ], 'Persegi kecil di kiri.'),
    colorStep('color-walls', 'Warnai dinding.', ['walls'], CREAM, 'Isi persegi dinding.', 52),
    colorStep('color-roof', 'Warnai atap.', ['roof'], RED, 'Isi atap yang melengkung.', 40),
    colorStep('color-door', 'Warnai pintu.', ['door'], BROWN, 'Isi pintu.', 28),
    colorStep('color-window', 'Warnai jendela.', ['window'], BLUE, 'Isi jendela.', 20),
  ],
});

export const KAWUNG_LESSON: LessonPackage = packageLesson({
  id: 'batik-kawung',
  title: 'Batik Kawung',
  subtitle: 'Empat kelopak di dalam lingkaran',
  colorRegions: [
    region('frame', 'Bingkai', box(180, 70, 640, 620), CREAM),
    region('ring', 'Lingkaran', `${circle(500, 380, 230)} Z`, GOLD),
    region('petal-n', 'Kelopak atas', `${ellipse(500, 270, 36, 28)} Z`, BROWN),
    region('petal-e', 'Kelopak kanan', `${ellipse(610, 380, 36, 28)} Z`, BROWN),
    region('petal-s', 'Kelopak bawah', `${ellipse(500, 490, 36, 28)} Z`, BROWN),
    region('petal-w', 'Kelopak kiri', `${ellipse(390, 380, 36, 28)} Z`, BROWN),
    region('seed', 'Biji', `${circle(500, 380, 18)} Z`, INK),
    region('dot-ne', 'Titik', `${circle(575, 310, 10)} Z`, INK),
    region('dot-se', 'Titik', `${circle(575, 450, 10)} Z`, INK),
    region('dot-sw', 'Titik', `${circle(425, 450, 10)} Z`, INK),
    region('dot-nw', 'Titik', `${circle(425, 310, 10)} Z`, INK),
  ],
  steps: [
    outline('frame', 'Gambar persegi besar untuk bingkai.', [
      guide('frame', box(180, 70, 640, 620)),
    ], 'Ini tepi kain.'),
    outline('ring', 'Gambar lingkaran di tengah bingkai.', [
      guide('ring', circle(500, 380, 230)),
    ], 'Lingkaran besar.'),
    outline('petals', 'Gambar empat kelopak di dalam lingkaran.', [
      guide('petal-n', ellipse(500, 270, 36, 28)),
      guide('petal-e', ellipse(610, 380, 36, 28)),
      guide('petal-s', ellipse(500, 490, 36, 28)),
      guide('petal-w', ellipse(390, 380, 36, 28)),
    ], 'Atas, kanan, bawah, kiri. Mereka tidak saling menempel.'),
    outline('seed', 'Gambar biji kecil di tengah.', [
      guide('seed', circle(500, 380, 18)),
    ], 'Lingkaran kecil di pusat.'),
    outline('dots', 'Gambar empat titik di antara kelopak.', [
      guide('dot-ne', circle(575, 310, 10)),
      guide('dot-se', circle(575, 450, 10)),
      guide('dot-sw', circle(425, 450, 10)),
      guide('dot-nw', circle(425, 310, 10)),
    ], 'Titik kecil di sela kelopak.'),
    colorStep('color-frame', 'Warnai bingkai.', ['frame'], CREAM, 'Isi di luar lingkaran juga boleh, yang di dalam bingkai.', 56),
    colorStep('color-ring', 'Warnai lingkaran.', ['ring'], GOLD, 'Isi lingkaran besar.', 48),
    colorStep('color-petals', 'Warnai empat kelopak.', ['petal-n', 'petal-e', 'petal-s', 'petal-w'], BROWN, 'Satu warna untuk semua kelopak.', 24),
    colorStep('color-seed', 'Warnai biji dan titik.', ['seed', 'dot-ne', 'dot-se', 'dot-sw', 'dot-nw'], INK, 'Isi biji, lalu empat titik.', 14),
  ],
});

export const KOMODO_LESSON: LessonPackage = packageLesson({
  id: 'komodo',
  title: 'Komodo',
  subtitle: 'Badan lonjong, kepala, lalu ekor',
  colorRegions: [
    region('body', 'Badan', `${ellipse(500, 390, 170, 78)} Z`, GREEN),
    region('head', 'Kepala', `${ellipse(760, 340, 62, 40)} Z`, GREEN),
    region('tail', 'Ekor', 'M 300 400 L 150 500 L 180 545 L 330 445 Z', BROWN),
    region('leg-1', 'Kaki', box(390, 480, 36, 90), GREEN),
    region('leg-2', 'Kaki', box(470, 480, 36, 90), GREEN),
    region('leg-3', 'Kaki', box(560, 480, 36, 90), GREEN),
    region('leg-4', 'Kaki', box(640, 480, 36, 90), GREEN),
    region('eye', 'Mata', `${circle(785, 330, 8)} Z`, INK),
  ],
  steps: [
    outline('body', 'Gambar badan lonjong untuk komodo.', [
      guide('body', ellipse(500, 390, 170, 78)),
    ], 'Lebih panjang ke samping.'),
    outline('head', 'Gambar kepala di depan badan.', [
      guide('head', ellipse(760, 340, 62, 40)),
    ], 'Kepala lebih kecil dari badan.'),
    outline('tail', 'Gambar ekor di belakang badan.', [
      guide('tail', 'M 300 400 L 150 500 L 180 545 L 330 445 Z'),
    ], 'Ekor menyempit ke belakang.'),
    outline('legs', 'Gambar empat kaki di bawah badan.', [
      guide('leg-1', box(390, 480, 36, 90)),
      guide('leg-2', box(470, 480, 36, 90)),
      guide('leg-3', box(560, 480, 36, 90)),
      guide('leg-4', box(640, 480, 36, 90)),
    ], 'Kaki pendek, berjajar.'),
    outline('eye', 'Gambar mata di kepala.', [
      guide('eye', circle(785, 330, 8)),
    ], 'Lingkaran kecil.'),
    colorStep('color-body', 'Warnai badan, kepala, dan kaki.', ['body', 'head', 'leg-1', 'leg-2', 'leg-3', 'leg-4'], GREEN, 'Satu warna untuk badan, kepala, dan kaki.', 48),
    colorStep('color-tail', 'Warnai ekor.', ['tail'], BROWN, 'Isi ekor.', 32),
    colorStep('color-eye', 'Warnai mata.', ['eye'], INK, 'Isi mata.', 12),
  ],
});

export const ORANGUTAN_LESSON: LessonPackage = packageLesson({
  id: 'orangutan',
  title: 'Orangutan',
  subtitle: 'Kepala bulat, lalu badan dan lengan',
  colorRegions: [
    region('head', 'Kepala', `${circle(500, 220, 100)} Z`, BROWN),
    region('body', 'Badan', `${ellipse(500, 500, 110, 120)} Z`, BROWN),
    region('arm-left', 'Lengan kiri', `${ellipse(300, 480, 36, 80)} Z`, BROWN),
    region('arm-right', 'Lengan kanan', `${ellipse(700, 480, 36, 80)} Z`, BROWN),
    region('face', 'Wajah', `${circle(500, 230, 48)} Z`, SKIN),
    region('eye-left', 'Mata kiri', `${circle(478, 220, 8)} Z`, INK),
    region('eye-right', 'Mata kanan', `${circle(522, 220, 8)} Z`, INK),
  ],
  steps: [
    outline('head', 'Gambar lingkaran besar untuk kepala.', [
      guide('head', circle(500, 220, 100)),
    ], 'Kepala di atas.'),
    outline('body', 'Gambar badan di bawah kepala.', [
      guide('body', ellipse(500, 500, 110, 120)),
    ], 'Badan lebih besar dari kepala.'),
    outline('arms', 'Gambar dua lengan di samping badan.', [
      guide('arm-left', ellipse(300, 480, 36, 80)),
      guide('arm-right', ellipse(700, 480, 36, 80)),
    ], 'Lengan panjang di kiri dan kanan.'),
    outline('face', 'Gambar wajah di dalam kepala.', [
      guide('face', circle(500, 230, 48)),
    ], 'Lingkaran lebih kecil di dalam kepala.'),
    outline('eyes', 'Gambar dua mata.', [
      guide('eye-left', circle(478, 220, 8)),
      guide('eye-right', circle(522, 220, 8)),
    ], 'Dua lingkaran kecil.'),
    outline('mouth', 'Gambar senyum kecil.', [
      guide('mouth', 'M 475 250 Q 500 270 525 250'),
    ], 'Satu lengkung pendek.'),
    colorStep('color-fur', 'Warnai bulu.', ['head', 'body', 'arm-left', 'arm-right'], BROWN, 'Kepala, badan, lalu kedua lengan.', 48),
    colorStep('color-face', 'Warnai wajah.', ['face'], SKIN, 'Isi lingkaran wajah.', 28),
    colorStep('color-eyes', 'Warnai mata.', ['eye-left', 'eye-right'], INK, 'Isi kedua mata.', 12),
  ],
});

export const BECAK_LESSON: LessonPackage = packageLesson({
  id: 'becak',
  title: 'Becak',
  subtitle: 'Tempat duduk, kap, lalu tiga roda',
  colorRegions: [
    region('cabin', 'Badan', box(340, 250, 340, 180), GREEN),
    region('hood', 'Kap', 'M 360 240 Q 510 80 660 240 L 660 250 L 360 250 Z', RED),
    region('seat', 'Jok', box(400, 300, 160, 70), BROWN),
    region('wheel-back', 'Roda belakang', `${circle(280, 560, 48)} Z`, INK),
    region('wheel-mid', 'Roda tengah', `${circle(510, 560, 48)} Z`, INK),
    region('wheel-front', 'Roda depan', `${circle(760, 560, 48)} Z`, INK),
  ],
  steps: [
    outline('cabin', 'Gambar kotak untuk tempat duduk.', [
      guide('cabin', box(340, 250, 340, 180)),
    ], 'Badan becak.'),
    outline('hood', 'Gambar kap di atas kotak.', [
      guide('hood', 'M 360 240 Q 510 80 660 240 L 660 250 L 360 250 Z'),
    ], 'Lengkung seperti atap.'),
    outline('seat', 'Gambar jok di dalam kotak.', [
      guide('seat', box(400, 300, 160, 70)),
    ], 'Persegi kecil di dalam.'),
    outline('wheels', 'Gambar tiga roda di bawah.', [
      guide('wheel-back', circle(280, 560, 48)),
      guide('wheel-mid', circle(510, 560, 48)),
      guide('wheel-front', circle(760, 560, 48)),
    ], 'Roda belakang, tengah, dan depan.'),
    outline('fork', 'Gambar garis ke roda depan.', [
      guide('fork', 'M 620 430 L 760 500'),
    ], 'Garis dari badan ke arah roda depan.'),
    colorStep('color-cabin', 'Warnai badan.', ['cabin'], GREEN, 'Isi kotak.', 44),
    colorStep('color-hood', 'Warnai kap.', ['hood'], RED, 'Isi atap lengkung.', 32),
    colorStep('color-seat', 'Warnai jok.', ['seat'], BROWN, 'Isi jok.', 24),
    colorStep('color-wheels', 'Warnai tiga roda.', ['wheel-back', 'wheel-mid', 'wheel-front'], INK, 'Satu warna untuk semua roda.', 28),
  ],
});

export const ONDEL_LESSON: LessonPackage = packageLesson({
  id: 'ondel-ondel',
  title: 'Ondel-ondel',
  subtitle: 'Badan tinggi, kepala bulat, lalu mahkota',
  colorRegions: [
    region('body', 'Badan', box(400, 300, 200, 380), RED),
    region('head', 'Kepala', `${circle(500, 190, 80)} Z`, SKIN),
    region('crown', 'Mahkota', 'M 430 90 L 500 20 L 570 90 Z', GOLD),
    region('eye-left', 'Mata kiri', `${circle(470, 185, 10)} Z`, INK),
    region('eye-right', 'Mata kanan', `${circle(530, 185, 10)} Z`, INK),
    region('arm-left', 'Lengan kiri', box(330, 340, 50, 160), RED),
    region('arm-right', 'Lengan kanan', box(620, 340, 50, 160), RED),
  ],
  steps: [
    outline('body', 'Gambar persegi tinggi untuk badan.', [
      guide('body', box(400, 300, 200, 380)),
    ], 'Ini pakaian ondel-ondel.'),
    outline('head', 'Gambar kepala bulat di atas badan.', [
      guide('head', circle(500, 190, 80)),
    ], 'Lingkaran di atas pakaian.'),
    outline('crown', 'Gambar mahkota di atas kepala.', [
      guide('crown', 'M 430 90 L 500 20 L 570 90 Z'),
    ], 'Segitiga di atas kepala.'),
    outline('eyes', 'Gambar dua mata.', [
      guide('eye-left', circle(470, 185, 10)),
      guide('eye-right', circle(530, 185, 10)),
    ], 'Dua lingkaran kecil di wajah.'),
    outline('arms', 'Gambar dua lengan di samping badan.', [
      guide('arm-left', box(330, 340, 50, 160)),
      guide('arm-right', box(620, 340, 50, 160)),
    ], 'Lengan di kiri dan kanan.'),
    colorStep('color-body', 'Warnai pakaian dan lengan.', ['body', 'arm-left', 'arm-right'], RED, 'Isi badan, lalu kedua lengan.', 48),
    colorStep('color-head', 'Warnai wajah.', ['head'], SKIN, 'Isi lingkaran kepala.', 32),
    colorStep('color-crown', 'Warnai mahkota.', ['crown'], GOLD, 'Isi segitiga.', 24),
    colorStep('color-eyes', 'Warnai mata.', ['eye-left', 'eye-right'], INK, 'Isi kedua mata.', 12),
  ],
});

export const PINISI_LESSON: LessonPackage = packageLesson({
  id: 'perahu-pinisi',
  title: 'Pinisi',
  subtitle: 'Lambung perahu, lalu tiang dan layar',
  colorRegions: [
    region('hull', 'Lambung', 'M 160 460 L 840 420 L 800 530 L 200 550 Z', BROWN),
    region('cabin', 'Kabin', box(380, 300, 180, 100), CREAM),
    region('sail-main', 'Layar besar', 'M 500 150 L 700 210 L 500 270 Z', CREAM),
    region('sail-front', 'Layar depan', 'M 460 160 L 280 220 L 460 260 Z', CREAM),
  ],
  steps: [
    outline('hull', 'Gambar lambung perahu.', [
      guide('hull', 'M 160 460 L 840 420 L 800 530 L 200 550 Z'),
    ], 'Panjang di atas air, lebih sempit di bawah.'),
    outline('cabin', 'Gambar kabin di atas lambung.', [
      guide('cabin', box(380, 300, 180, 100)),
    ], 'Kotak kecil di tengah.'),
    outline('mast', 'Gambar tiang ke atas.', [
      guide('mast', 'M 480 300 L 480 120'),
    ], 'Satu garis tegak.'),
    outline('sail-main', 'Gambar layar besar di kanan tiang.', [
      guide('sail-main', 'M 500 150 L 700 210 L 500 270 Z'),
    ], 'Segitiga di samping tiang.'),
    outline('sail-front', 'Gambar layar depan di kiri tiang.', [
      guide('sail-front', 'M 460 160 L 280 220 L 460 260 Z'),
    ], 'Segitiga yang lebih kecil.'),
    colorStep('color-hull', 'Warnai lambung.', ['hull'], BROWN, 'Isi badan perahu.', 48),
    colorStep('color-cabin', 'Warnai kabin.', ['cabin'], CREAM, 'Isi kotak.', 28),
    colorStep('color-sails', 'Warnai kedua layar.', ['sail-main', 'sail-front'], CREAM, 'Layar besar, lalu layar depan.', 32),
  ],
});

export function packLesson(id: string): LessonPackage | undefined {
  return NUSANTARA_LESSONS.find((lesson) => lesson.id === id);
}

export const NUSANTARA_LESSONS: readonly LessonPackage[] = [
  GUNUNGAN_LESSON,
  RUMAH_GADANG_LESSON,
  KAWUNG_LESSON,
  KOMODO_LESSON,
  ORANGUTAN_LESSON,
  BECAK_LESSON,
  ONDEL_LESSON,
  PINISI_LESSON,
];

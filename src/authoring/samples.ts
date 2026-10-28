/**
 * Starter drafts for the authoring tool.
 * They follow the lesson rules and are here so a person can see the preview
 * without calling the model. They are not part of the shipped lesson library.
 */

import { circle, ellipse } from '../categories/shapes';
import type { DraftLesson } from './model';

const INK = '#3a3a3a';

function line(
  id: string,
  instruction: string,
  hint: string,
  instructionEn: string,
  hintEn: string,
  guides: DraftLesson['steps'][number]['guides'],
  phase: 'outline' | 'detail' = 'outline',
): DraftLesson['steps'][number] {
  return {
    id, phase, instruction, hint, instructionEn, hintEn, guides,
    colorRegionIds: [], color: INK,
  };
}

function paint(
  id: string,
  instruction: string,
  hint: string,
  instructionEn: string,
  hintEn: string,
  regionId: string,
  color: string,
): DraftLesson['steps'][number] {
  return {
    id, phase: 'color', instruction, hint, instructionEn, hintEn,
    guides: [], colorRegionIds: [regionId], color,
  };
}

const body = ellipse(400, 450, 160, 90);
const head = circle(760, 230, 46);
const eye = circle(778, 218, 7);

export const DINOSAUR_DRAFT: DraftLesson = {
  id: 'dinosaur',
  title: 'Dinosaurus',
  subtitle: 'Badan lonjong, lalu kepala',
  regions: [
    { id: 'body', label: 'Badan', d: `${body} Z`, suggestedColor: '#6f9b4a' },
    { id: 'belly', label: 'Perut', d: `${ellipse(400, 485, 110, 36)} Z`, suggestedColor: '#d7e6b0' },
    { id: 'head', label: 'Kepala', d: `${head} Z`, suggestedColor: '#5e8a40' },
  ],
  steps: [
    line('body', 'Gambar lonjong untuk badan.', 'Satu bentuk besar di tengah.', 'Draw an oval for the body.', 'One big shape in the middle.', [
      { id: 'body', d: body, role: 'final-outline' },
    ]),
    line('tail', 'Gambar ekor ke kiri.', 'Ekor panjang, makin kecil di ujung.', 'Draw the tail to the left.', 'A long tail, smaller at the end.', [
      { id: 'tail', d: 'M 250 440 C 160 420 90 480 60 560', role: 'final-outline' },
    ]),
    line('neck', 'Gambar leher ke atas.', 'Leher naik ke kanan.', 'Draw the neck going up.', 'The neck rises to the right.', [
      { id: 'neck', d: 'M 545 390 C 630 350 690 290 720 250', role: 'final-outline' },
    ]),
    line('head', 'Gambar lingkaran untuk kepala.', 'Kepala duduk di ujung leher.', 'Draw a circle for the head.', 'The head sits on the end of the neck.', [
      { id: 'head', d: head, role: 'final-outline' },
    ]),
    line('plate', 'Gambar satu pelat di punggung.', 'Segitiga kecil di atas badan.', 'Draw one plate on the back.', 'A small triangle on top of the body.', [
      { id: 'plate', d: 'M 360 370 L 400 300 L 440 370 Z', role: 'final-outline' },
    ]),
    line('legs', 'Gambar dua kaki.', 'Kaki depan dan kaki belakang.', 'Draw two legs.', 'A front leg and a back leg.', [
      { id: 'leg-back', d: 'M 320 520 L 290 660', role: 'final-outline' },
      { id: 'leg-front', d: 'M 490 530 L 530 670', role: 'final-outline' },
    ]),
    line('eye', 'Gambar mata.', 'Lingkaran kecil di kepala.', 'Draw the eye.', 'A small circle on the head.', [
      { id: 'eye', d: eye, role: 'final-outline' },
    ], 'detail'),
    paint('color-body', 'Warnai badan.', 'Isi lonjong besar.', 'Colour the body.', 'Fill the big oval.', 'body', '#6f9b4a'),
    paint('color-belly', 'Warnai perut.', 'Perut yang lebih muda di bawah.', 'Colour the belly.', 'The lighter belly underneath.', 'belly', '#d7e6b0'),
    paint('color-head', 'Warnai kepala.', 'Isi lingkaran kepala.', 'Colour the head.', 'Fill the head circle.', 'head', '#5e8a40'),
  ],
};

const hull = 'M 160 470 L 840 470 L 740 580 L 260 580 Z';
const cabin = 'M 560 470 L 560 330 L 740 330 L 740 470 Z';
const sail = 'M 418 200 L 418 450 L 640 450 Z';

export const BOAT_DRAFT: DraftLesson = {
  id: 'boat',
  title: 'Perahu',
  subtitle: 'Badan perahu, lalu layar',
  regions: [
    { id: 'hull', label: 'Badan', d: hull, suggestedColor: '#c4653a' },
    { id: 'cabin', label: 'Kabin', d: cabin, suggestedColor: '#f2e2c4' },
    { id: 'sail', label: 'Layar', d: sail, suggestedColor: '#f7f4ee' },
  ],
  steps: [
    line('hull', 'Gambar badan perahu.', 'Lebar di atas, lebih sempit di bawah.', 'Draw the hull.', 'Wide at the top, narrower below.', [
      { id: 'hull', d: hull, role: 'final-outline' },
    ]),
    line('cabin', 'Gambar kabin.', 'Kotak di belakang perahu.', 'Draw the cabin.', 'A box at the back of the boat.', [
      { id: 'cabin', d: cabin, role: 'final-outline' },
    ]),
    line('mast', 'Gambar tiang.', 'Satu garis tegak.', 'Draw the mast.', 'One upright line.', [
      { id: 'mast', d: 'M 400 470 L 400 170', role: 'final-outline' },
    ]),
    line('sail', 'Gambar layar.', 'Segitiga di samping tiang.', 'Draw the sail.', 'A triangle beside the mast.', [
      { id: 'sail', d: sail, role: 'final-outline' },
    ]),
    line('window', 'Gambar jendela kabin.', 'Kotak kecil di kabin.', 'Draw the cabin window.', 'A small box on the cabin.', [
      { id: 'window', d: 'M 600 370 L 680 370 L 680 420 L 600 420 Z', role: 'final-outline' },
    ], 'detail'),
    paint('color-hull', 'Warnai badan perahu.', 'Isi bentuk yang lebar.', 'Colour the hull.', 'Fill the wide shape.', 'hull', '#c4653a'),
    paint('color-cabin', 'Warnai kabin.', 'Isi kotak kabin.', 'Colour the cabin.', 'Fill the cabin box.', 'cabin', '#f2e2c4'),
    paint('color-sail', 'Warnai layar.', 'Isi segitiga layar.', 'Colour the sail.', 'Fill the sail triangle.', 'sail', '#f4efe6'),
  ],
};

const cake = 'M 250 430 L 750 430 L 750 590 L 250 590 Z';
const frosting = ellipse(500, 430, 260, 40);
const candle = 'M 478 250 L 522 250 L 522 420 L 478 420 Z';
const flame = circle(500, 220, 22);

export const CAKE_DRAFT: DraftLesson = {
  id: 'cake',
  title: 'Kue',
  subtitle: 'Kue, krim, lalu lilin',
  regions: [
    { id: 'cake', label: 'Kue', d: cake, suggestedColor: '#f0c2d8' },
    { id: 'frosting', label: 'Krim', d: `${frosting} Z`, suggestedColor: '#fff6ea' },
    { id: 'candle', label: 'Lilin', d: candle, suggestedColor: '#f2d56b' },
    { id: 'flame', label: 'Api', d: `${flame} Z`, suggestedColor: '#e07a32' },
  ],
  steps: [
    line('cake', 'Gambar kue.', 'Kotak besar di bawah.', 'Draw the cake.', 'A big box at the bottom.', [
      { id: 'cake', d: cake, role: 'final-outline' },
    ]),
    line('frosting', 'Gambar krim di atas kue.', 'Lonjong di tepi atas.', 'Draw the frosting on top.', 'An oval along the top edge.', [
      { id: 'frosting', d: frosting, role: 'final-outline' },
    ]),
    line('candle', 'Gambar lilin.', 'Kotak kecil di tengah.', 'Draw the candle.', 'A small box in the middle.', [
      { id: 'candle', d: candle, role: 'final-outline' },
    ]),
    line('flame', 'Gambar api.', 'Lingkaran di ujung lilin.', 'Draw the flame.', 'A circle at the top of the candle.', [
      { id: 'flame', d: flame, role: 'final-outline' },
    ]),
    paint('color-cake', 'Warnai kue.', 'Isi kotak besar.', 'Colour the cake.', 'Fill the big box.', 'cake', '#f0c2d8'),
    paint('color-frosting', 'Warnai krim.', 'Isi lonjong krim.', 'Colour the frosting.', 'Fill the frosting oval.', 'frosting', '#fff6ea'),
    paint('color-candle', 'Warnai lilin.', 'Isi lilin.', 'Colour the candle.', 'Fill the candle.', 'candle', '#f2d56b'),
    paint('color-flame', 'Warnai api.', 'Isi lingkaran api.', 'Colour the flame.', 'Fill the flame circle.', 'flame', '#e07a32'),
  ],
};

export const SAMPLE_DRAFTS = [DINOSAUR_DRAFT, BOAT_DRAFT, CAKE_DRAFT] as const;

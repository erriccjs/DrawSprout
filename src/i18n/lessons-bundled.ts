/**
 * English for the hand-authored lessons. The packages themselves stay
 * Indonesian, so saved drawings and the lesson schema do not change.
 */

export interface StepEnglish {
  readonly instruction: string;
  readonly hint: string;
}

export interface LessonEnglish {
  readonly title: string;
  readonly subtitle: string;
  readonly steps: Readonly<Record<string, StepEnglish>>;
  readonly regions: Readonly<Record<string, string>>;
}

export const LESSON_EN: Readonly<Record<string, LessonEnglish>> = {
  'cat-sitting': {
    title: 'Sitting Cat',
    subtitle: 'Seven line steps, then two colour steps',
    steps: {
      'head-outline': { instruction: 'Draw a big circle for the head.', hint: 'Start at the top and go around until you meet the start. It does not have to be a perfect circle.' },
      ears: { instruction: 'Add two ears on top of the head.', hint: 'Like two little mountains sitting on the head.' },
      body: { instruction: 'Draw the cat’s body under the head.', hint: 'A sitting cat gets wider toward the bottom, like a pear.' },
      paws: { instruction: 'Draw two front paws under the body.', hint: 'Two small round shapes sitting on the floor.' },
      tail: { instruction: 'Draw a tail that curves to the right.', hint: 'One long line from the side of the body, up and then curved.' },
      'eyes-nose': { instruction: 'Draw two eyes and one nose.', hint: 'Eyes in the middle of the head, nose a little below them.' },
      'mouth-whiskers': { instruction: 'Draw the cat’s mouth and whiskers.', hint: 'The mouth is like a small letter w, then three whiskers on each side.' },
      'color-fur': { instruction: 'Colour the cat’s fur.', hint: 'Use a big brush. Any colour is fine — this is your cat.' },
      'color-face': { instruction: 'Colour the inside of the ears and the nose.', hint: 'These parts are small, so the brush is smaller too.' },
    },
    regions: {
      'fur-head': 'Head',
      'fur-ear-left': 'Left ear',
      'fur-ear-right': 'Right ear',
      'fur-body': 'Body',
      'fur-paw-left': 'Left paw',
      'fur-paw-right': 'Right paw',
      'fur-tail': 'Tail',
      'inner-ear-left': 'Inside the left ear',
      'inner-ear-right': 'Inside the right ear',
      nose: 'Nose',
    },
  },
  'flower-cheerful': {
    title: 'Happy Flower',
    subtitle: 'A smiling flower with five petals',
    steps: {
      'center-outline': { instruction: 'Draw a big circle in the middle for the flower’s face.', hint: 'Turn the pencil slowly. The circle can be a little tilted.' },
      'petals-outline': { instruction: 'Draw five big petals around the circle.', hint: 'The petals are like balloons stuck to the flower’s face.' },
      'stem-outline': { instruction: 'Draw a long stem under the flower.', hint: 'Two long lines that meet at the bottom.' },
      'leaves-outline': { instruction: 'Add two big leaves beside the stem.', hint: 'One leaf to the left and one to the right.' },
      'face-detail': { instruction: 'Give the flower two eyes and a smile.', hint: 'Small eyes on top, a curved smile below.' },
      'veins-detail': { instruction: 'Draw one line down the middle of each leaf.', hint: 'Follow the leaf from the stem to the tip.' },
      'color-petals': { instruction: 'Colour the flower’s petals.', hint: 'Use a big brush on the petals. Your favourite colour is fine too.' },
      'color-center': { instruction: 'Colour the flower’s face.', hint: 'A smaller brush makes the circle easier to fill.' },
      'color-greenery': { instruction: 'Colour the stem and both leaves.', hint: 'Start with the stem, then fill the left leaf and the right leaf.' },
    },
    regions: {
      'petal-1': 'Petal 1', 'petal-2': 'Petal 2', 'petal-3': 'Petal 3', 'petal-4': 'Petal 4', 'petal-5': 'Petal 5',
      center: 'Flower centre', stem: 'Stem', 'leaf-left': 'Left leaf', 'leaf-right': 'Right leaf',
    },
  },
  'fish-cheerful': {
    title: 'Cheerful Fish',
    subtitle: 'A little fish with a fan-shaped tail',
    steps: {
      'body-outline': { instruction: 'Draw a big egg shape for the fish’s body.', hint: 'Start at the front and go around slowly until you meet the start.' },
      'tail-outline': { instruction: 'Draw a fan-shaped tail behind the body.', hint: 'Two slanted lines from the body, then one upright line at the end.' },
      'fins-outline': { instruction: 'Add one fin on top and one under the body.', hint: 'The fins are like small curved hills.' },
      'face-detail': { instruction: 'Give the fish one eye and a mouth.', hint: 'A round eye at the front, a small curved mouth below it.' },
      'extras-detail': { instruction: 'Draw a cheek line and two bubbles.', hint: 'The line curves behind the eye, and the bubbles float up.' },
      'color-body': { instruction: 'Colour the fish’s body orange.', hint: 'Sweep a big brush from front to back. Your favourite colour is fine too.' },
      'color-tail': { instruction: 'Colour the fish’s tail light orange.', hint: 'Fill the tail fan all the way to the tip.' },
      'color-fins': { instruction: 'Colour both fins yellow.', hint: 'The top fin first, then the bottom fin.' },
    },
    regions: { body: 'Body', tail: 'Tail', 'fin-top': 'Top fin', 'fin-bottom': 'Bottom fin' },
  },
  'sun-smiling': {
    title: 'Happy Sun',
    subtitle: 'A round sun that smiles',
    steps: {
      'face-outline': { instruction: 'Draw a big circle for the sun’s face.', hint: 'Go around slowly until the line meets itself.' },
      'vertical-rays-outline': { instruction: 'Draw rays on the top and the bottom.', hint: 'Make two small triangles.' },
      'horizontal-rays-outline': { instruction: 'Draw rays on the left and the right.', hint: 'Make two more triangles.' },
      'eyes-smile-detail': { instruction: 'Draw two eyes and a smile.', hint: 'Small round eyes, then a curved smile.' },
      'cheeks-detail': { instruction: 'Draw two round cheeks.', hint: 'One on the left of the smile, one on the right.' },
      'color-rays': { instruction: 'Colour all the rays orange.', hint: 'Fill the four rays outside the face.' },
      'color-face': { instruction: 'Colour the sun’s face yellow.', hint: 'Sweep the brush inside the big circle.' },
      'color-cheeks': { instruction: 'Colour both cheeks pink.', hint: 'Fill the left cheek and the right cheek.' },
    },
    regions: {
      'ray-top': 'Ray', 'ray-bottom': 'Ray', 'ray-right': 'Ray', 'ray-left': 'Ray',
      face: 'Face', 'cheek-left': 'Cheek', 'cheek-right': 'Cheek',
    },
  },
  'apple-tree': {
    title: 'Apple Tree',
    subtitle: 'A small tree with two apples',
    steps: {
      'crown-outline': { instruction: 'Draw the round top of the tree.', hint: 'Make a big round shape like a cloud.' },
      'trunk-outline': { instruction: 'Draw a long tree trunk.', hint: 'Make a long box under the tree.' },
      'ground-outline': { instruction: 'Draw the ground on the left and the right of the trunk.', hint: 'Draw two short lines.' },
      'apples-detail': { instruction: 'Draw two round apples in the tree.', hint: 'One on the left, one on the right.' },
      'bark-detail': { instruction: 'Draw a small line on the trunk.', hint: 'Draw a straight line downward.' },
      'color-crown': { instruction: 'Colour the top of the tree green.', hint: 'Fill the big round shape.' },
      'color-trunk': { instruction: 'Colour the trunk brown.', hint: 'Fill the long box.' },
      'color-apples': { instruction: 'Colour both apples red.', hint: 'Fill the left apple and the right apple.' },
    },
    regions: { crown: 'Top of the tree', trunk: 'Trunk', 'apple-left': 'Apple', 'apple-right': 'Apple' },
  },
  basketball: {
    title: 'Basketball',
    subtitle: 'A round ball with curved lines',
    steps: {
      'ball-outline': { instruction: 'Draw a big circle for the ball.', hint: 'Go around slowly until the line meets itself.' },
      'center-seam': { instruction: 'Draw a curved line through the middle of the ball.', hint: 'Start at the top, curve, then go down.' },
      'side-seams': { instruction: 'Draw two curved lines on the left and the right.', hint: 'One on the left side, one on the right side.' },
      'color-ball': { instruction: 'Colour the ball orange.', hint: 'Sweep the brush inside the circle.' },
    },
    regions: { ball: 'Ball' },
  },
  house: {
    title: 'House',
    subtitle: 'Walls, a roof, a door, and a window',
    steps: {
      'walls-outline': { instruction: 'Draw a big box for the walls.', hint: 'Four straight lines, then join them.' },
      'roof-outline': { instruction: 'Draw a triangle roof on top of the walls.', hint: 'The peak is in the middle. The roof is wider than the walls.' },
      'door-window-outline': { instruction: 'Draw a door and a window.', hint: 'The door is at the bottom, the window is on the left, with a cross.' },
      'color-walls': { instruction: 'Colour the walls yellow.', hint: 'Sweep the brush inside the big box.' },
      'color-roof': { instruction: 'Colour the roof red.', hint: 'Fill the triangle above the walls.' },
      'color-door': { instruction: 'Colour the door brown.', hint: 'Fill the door at the bottom of the walls.' },
      'color-window': { instruction: 'Colour the window blue.', hint: 'Fill the window box on the left.' },
    },
    regions: { walls: 'Walls', roof: 'Roof', door: 'Door', window: 'Window' },
  },
  car: {
    title: 'Car',
    subtitle: 'A body, a window, and two wheels',
    steps: {
      'body-outline': { instruction: 'Draw a long box for the car’s body.', hint: 'Wide from side to side, not too tall.' },
      'cabin-outline': { instruction: 'Draw a roof on top of the car.', hint: 'Two slanted sides, then a flat line on top.' },
      'window-outline': { instruction: 'Draw a window inside the roof.', hint: 'A smaller slanted box inside the roof.' },
      'wheels-outline': { instruction: 'Draw two round wheels.', hint: 'One under the left side, one under the right side.' },
      'color-body': { instruction: 'Colour the car’s body blue.', hint: 'Sweep the brush inside the long box.' },
      'color-window': { instruction: 'Colour the window light blue.', hint: 'Fill the window inside the roof.' },
      'color-wheels': { instruction: 'Colour both wheels a dark colour.', hint: 'Fill the left circle and the right circle.' },
    },
    regions: { body: 'Body', window: 'Window', 'wheel-left': 'Left wheel', 'wheel-right': 'Right wheel' },
  },
  butterfly: {
    title: 'Butterfly',
    subtitle: 'A left wing and a right wing',
    steps: {
      'body-outline': { instruction: 'Draw the butterfly’s body, long in the middle.', hint: 'A small box standing upright.' },
      'upper-wings-outline': { instruction: 'Draw two big wings on top.', hint: 'One on the left, one on the right, the same size.' },
      'lower-wings-outline': { instruction: 'Draw two small wings underneath.', hint: 'Smaller than the top wings.' },
      'antennae-detail': { instruction: 'Draw two antennae above the head.', hint: 'Curved lines to the left and to the right.' },
      'color-upper-wings': { instruction: 'Colour the two top wings pink.', hint: 'Fill the left wing and the right wing.' },
      'color-lower-wings': { instruction: 'Colour the two lower wings purple.', hint: 'Fill the small wings underneath.' },
      'color-body': { instruction: 'Colour the body brown.', hint: 'Sweep the brush inside the middle box.' },
    },
    regions: {
      'wing-upper-left': 'Upper left wing', 'wing-upper-right': 'Upper right wing',
      'wing-lower-left': 'Lower left wing', 'wing-lower-right': 'Lower right wing', body: 'Body',
    },
  },
  star: {
    title: 'Star',
    subtitle: 'A smiling five-point star',
    steps: {
      'star-outline': { instruction: 'Draw a five-point star.', hint: 'Five points. Join them until the line closes.' },
      'face-detail': { instruction: 'Draw two eyes and a smile.', hint: 'Small round eyes inside the star.' },
      'color-star': { instruction: 'Colour the star yellow.', hint: 'Sweep the brush inside the star.' },
    },
    regions: { star: 'Star' },
  },
};

/**
 * The category catalogue. Done entries can be opened. Planned entries are
 * names the matcher may return, which the app answers with the friendly list.
 */

import { getLesson } from '../lesson-data';
import type { LessonPackage } from '../lesson-data/schema';
import { CAT_CATEGORY } from './lessons/cat';
import { CUP_CATEGORY } from './lessons/cup';
import { DOG_CATEGORY } from './lessons/dog';
import { FISH_CATEGORY } from './lessons/fish';
import { FLOWER_CATEGORY } from './lessons/flower';
import { TOY_CAR_CATEGORY } from './lessons/toy-car';
import { isDone, type CategoryEntry, type CategoryLesson, type PlannedCategory } from './types';

const PLANNED: readonly PlannedCategory[] = [
  planned('house', 'Rumah', 'a house'),
  planned('dinosaur', 'Dinosaurus', 'a dinosaur'),
  planned('robot', 'Robot', 'a robot'),
  planned('person', 'Orang', 'a person'),
  planned('butterfly', 'Kupu-kupu', 'a butterfly'),
  planned('bird', 'Burung', 'a bird'),
  planned('tree', 'Pohon', 'a tree'),
  planned('rabbit', 'Kelinci', 'a rabbit'),
  planned('turtle', 'Kura-kura', 'a turtle'),
  planned('sun', 'Matahari', 'a sun'),
  planned('rocket', 'Roket', 'a rocket'),
  planned('boat', 'Perahu', 'a boat'),
  planned('apple', 'Apel', 'an apple'),
  planned('elephant', 'Gajah', 'an elephant'),
  planned('horse', 'Kuda', 'a horse'),
  planned('lion', 'Singa', 'a lion'),
  planned('penguin', 'Pinguin', 'a penguin'),
  planned('frog', 'Katak', 'a frog'),
  planned('snail', 'Siput', 'a snail'),
  planned('ice-cream', 'Es Krim', 'an ice cream'),
  planned('cake', 'Kue', 'a cake'),
  planned('train', 'Kereta', 'a train'),
  planned('plane', 'Pesawat', 'an airplane'),
  planned('truck', 'Truk', 'a truck'),
  planned('bicycle', 'Sepeda', 'a bicycle'),
  planned('mushroom', 'Jamur', 'a mushroom'),
  planned('rainbow', 'Pelangi', 'a rainbow'),
  planned('moon', 'Bulan', 'a moon'),
  planned('crab', 'Kepiting', 'a crab'),
  planned('whale', 'Paus', 'a whale'),
  planned('octopus', 'Gurita', 'an octopus'),
  planned('duck', 'Bebek', 'a duck'),
  planned('pig', 'Babi', 'a pig'),
  planned('bear', 'Beruang', 'a bear'),
];

export const CATEGORY_LESSONS: readonly CategoryLesson[] = [
  CAT_CATEGORY,
  DOG_CATEGORY,
  FLOWER_CATEGORY,
  CUP_CATEGORY,
  TOY_CAR_CATEGORY,
  FISH_CATEGORY,
];

export const CATEGORY_CATALOGUE: readonly CategoryEntry[] = [
  ...CATEGORY_LESSONS,
  ...PLANNED,
];

export function categoryById(id: string): CategoryEntry | undefined {
  return CATEGORY_CATALOGUE.find((entry) => entry.id === id);
}

export function doneCategory(id: string): CategoryLesson | undefined {
  const entry = categoryById(id);
  return entry && isDone(entry) ? entry : undefined;
}

/** A lesson the drawing screen can open: a done category, else a bundled id. */
export function categoryLessonPackage(id: string): LessonPackage | undefined {
  return doneCategory(id)?.lesson;
}

export function getPlayableLesson(id: string): LessonPackage {
  return categoryLessonPackage(id) ?? getLesson(id);
}

function planned(id: string, title: string, hint: string): PlannedCategory {
  return { id, status: 'planned', title, hint };
}

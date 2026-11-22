/**
 * Phase A catalogue: a short beginner path, a theme, and a difficulty.
 *
 * Near-duplicate lessons stay in the list. Eric decides whether any pair
 * should go. See docs/roadmap-growth.md.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ThemeId = 'nature' | 'animals' | 'things' | 'people';

export const THEME_ORDER: readonly ThemeId[] = ['nature', 'animals', 'things', 'people'];

/**
 * Eight easy pictures, simplest shape first.
 * Ids are the packages the picker opens.
 */
export const BEGINNER_PATH = [
  'sun-smiling',
  'apple',
  'star',
  'cup',
  'flower',
  'fish',
  'cat',
  'house-front',
] as const;

/** Pairs that look like the same subject. Not removed. */
export const NEAR_DUPLICATE_PAIRS = [
  ['cat', 'cat-sitting'],
  ['flower', 'flower-cheerful'],
  ['fish', 'fish-cheerful'],
  ['tree', 'apple-tree'],
  ['toy-car', 'car'],
] as const;

const THEME: Readonly<Record<string, ThemeId>> = {
  flower: 'nature',
  'flower-cheerful': 'nature',
  tree: 'nature',
  'apple-tree': 'nature',
  apple: 'nature',
  'sun-smiling': 'nature',
  cat: 'animals',
  'cat-sitting': 'animals',
  dog: 'animals',
  fish: 'animals',
  'fish-cheerful': 'animals',
  'butterfly-front': 'animals',
  bird: 'animals',
  rabbit: 'animals',
  turtle: 'animals',
  elephant: 'animals',
  lion: 'animals',
  giraffe: 'animals',
  panda: 'animals',
  chicken: 'animals',
  duck: 'animals',
  horse: 'animals',
  cow: 'animals',
  dinosaur: 'animals',
  cup: 'things',
  'toy-car': 'things',
  'house-front': 'things',
  rocket: 'things',
  basketball: 'things',
  car: 'things',
  star: 'things',
  'teddy-bear': 'things',
  'person-standing': 'people',
  character: 'people',
};

const DIFFICULTY: Readonly<Record<string, Difficulty>> = {
  'sun-smiling': 'easy',
  apple: 'easy',
  star: 'easy',
  cup: 'easy',
  flower: 'easy',
  fish: 'easy',
  cat: 'easy',
  'house-front': 'easy',
  tree: 'easy',
  bird: 'easy',
  'butterfly-front': 'easy',
  basketball: 'easy',
  dog: 'medium',
  rabbit: 'medium',
  turtle: 'medium',
  chicken: 'medium',
  duck: 'medium',
  panda: 'medium',
  'teddy-bear': 'medium',
  'toy-car': 'medium',
  rocket: 'medium',
  'flower-cheerful': 'medium',
  'fish-cheerful': 'medium',
  'apple-tree': 'medium',
  car: 'medium',
  elephant: 'hard',
  lion: 'hard',
  giraffe: 'hard',
  horse: 'hard',
  cow: 'hard',
  dinosaur: 'hard',
  'person-standing': 'hard',
  character: 'hard',
  'cat-sitting': 'hard',
};

export function lessonTheme(lessonId: string): ThemeId {
  return THEME[lessonId] ?? 'things';
}

export function lessonDifficulty(lessonId: string): Difficulty {
  return DIFFICULTY[lessonId] ?? 'medium';
}

export function hasLessonMeta(lessonId: string): boolean {
  return Object.prototype.hasOwnProperty.call(THEME, lessonId)
    && Object.prototype.hasOwnProperty.call(DIFFICULTY, lessonId);
}

/** The next path lesson that has no stamp yet, or the first lesson. */
export function nextBeginnerLesson(
  availableIds: readonly string[],
  stampedIds: readonly string[],
): string | null {
  const available = BEGINNER_PATH.filter((id) => availableIds.includes(id));
  if (available.length === 0) return null;
  const stamped = new Set(stampedIds);
  return available.find((id) => !stamped.has(id)) ?? available[0]!;
}

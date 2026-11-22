/**
 * A grown-up check for this tab only.
 *
 * The sum is not stored. Passing it unlocks parent actions for a few minutes
 * in memory, then it asks again. Nothing here is a name, an account, or a photo.
 */

const UNLOCK_MS = 5 * 60 * 1000;

let unlockedUntil = 0;

export interface ParentQuestion {
  readonly left: number;
  readonly right: number;
  readonly answer: number;
}

export function makeParentQuestion(random: () => number = Math.random): ParentQuestion {
  const left = 4 + Math.floor(random() * 8);
  const right = 3 + Math.floor(random() * 7);
  return { left, right, answer: left + right };
}

export function parentUnlocked(now = Date.now()): boolean {
  return now < unlockedUntil;
}

export function grantParent(now = Date.now()): void {
  unlockedUntil = now + UNLOCK_MS;
}

export function clearParentUnlock(): void {
  unlockedUntil = 0;
}

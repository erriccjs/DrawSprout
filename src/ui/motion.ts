/** Whether decorative motion should play. The lesson itself never depends on it. */
export type MotionPreference = 'reduce' | 'full';

export function motionPreference(reduce: boolean): MotionPreference {
  return reduce ? 'reduce' : 'full';
}

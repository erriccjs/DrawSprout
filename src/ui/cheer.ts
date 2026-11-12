/**
 * A very short star sound. It runs only after a tap, and only when sound is on.
 * Reduced motion skips it. A browser without Web Audio does nothing.
 */

import type { MotionPreference } from './motion';

export function playCheer(motion: MotionPreference, muted: boolean): void {
  if (muted || motion === 'reduce') return;
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 784;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    /* A blocked audio device must not stop the next step. */
  }
}

/**
 * When a downloaded update may be offered or applied.
 *
 * A new shell is allowed to load only from the picture-choosing screen, after
 * any save started on the way there has finished, and only because someone
 * asked. The drawing screen never shows the prompt and never reloads.
 */

export type AppSurface = 'picker' | 'drawing';

export interface UpdateGateInput {
  readonly surface: AppSurface;
  /** A worker has installed and is waiting to take over. */
  readonly updateWaiting: boolean;
  /** A save started while leaving a drawing has not settled yet. */
  readonly saveInFlight: boolean;
  /** Someone chose "Muat versi baru" on this visit to the picker. */
  readonly applyRequested: boolean;
  /** Someone chose "Nanti saja" and has not left the picker since. */
  readonly dismissed: boolean;
}

export interface UpdateGate {
  /** Show the prompt, including the "still loading" line after they accept. */
  readonly showPrompt: boolean;
  /** Tell the waiting worker to take over and reload once it does. */
  readonly mayApply: boolean;
}

export function gateUpdate(input: UpdateGateInput): UpdateGate {
  const safePoint = input.surface === 'picker'
    && input.updateWaiting
    && !input.saveInFlight
    && !input.dismissed;
  return {
    showPrompt: safePoint,
    mayApply: safePoint && input.applyRequested,
  };
}

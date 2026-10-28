import type { TracePlacement } from './placement';

/** The photo for the drawing that is open. It is not uploaded. */
export interface TraceSession {
  readonly image: HTMLImageElement;
  readonly url: string;
  readonly placement: TracePlacement;
  readonly opacity: number;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly includeInExport: boolean;
}

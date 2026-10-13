/** Opaque ids for sessions and strokes. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Only reached on a browser without `randomUUID`; ids are local keys, never
  // security tokens, so a timestamp plus randomness is enough.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

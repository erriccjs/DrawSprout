/**
 * Recently used colours for the corner picker.
 *
 * This list is interface memory. It is not part of the drawing session, so a
 * checkpoint never has to know which swatches the child opened.
 */

export const RECENT_COLOR_LIMIT = 5;

/** Most recent first, duplicates dropped, capped at `limit`. */
export function rememberColor(
  history: readonly string[],
  color: string,
  limit = RECENT_COLOR_LIMIT,
): readonly string[] {
  const key = color.toLowerCase();
  return [color, ...history.filter((entry) => entry.toLowerCase() !== key)].slice(0, limit);
}

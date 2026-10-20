/**
 * The one question asked before a drawing is taken away.
 *
 * Both places that can empty the canvas — the finish screen's "Gambar lagi"
 * and the eraser's "Hapus semua" — render this, so the child meets the same
 * words and the same clearly-labelled way out of it every time. Backing out is
 * the focused button: a stray tap keeps the drawing.
 */

interface ClearArtworkPromptProps {
  /** Names the group for assistive technology; the question itself is shared. */
  readonly label: string;
  /** Chosen by "Gambar lama tetap ada": nothing is cleared. */
  readonly onKeep: () => void;
  /** Chosen by "Ya, mulai gambar baru": the drawing goes. */
  readonly onClear: () => void;
  /** `true` in the drawing screen's narrow control column. */
  readonly compact?: boolean;
}

export function ClearArtworkPrompt({ label, onKeep, onClear, compact = false }: ClearArtworkPromptProps) {
  return (
    <div
      className={compact ? 'finish__choice finish__choice--compact' : 'finish__choice'}
      role="group"
      aria-label={label}
    >
      <h2>Mau mulai dengan gambar kosong?</h2>
      <div className="finish__actions">
        <button type="button" className="button" onClick={onKeep} autoFocus>
          Gambar lama tetap ada
        </button>
        <button type="button" className="button" onClick={onClear}>
          Ya, mulai gambar baru
        </button>
      </div>
    </div>
  );
}

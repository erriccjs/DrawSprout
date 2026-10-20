/**
 * A short note for phone-sized screens. Drawing still works; the note only
 * says a tablet is the more comfortable place.
 */

interface TabletNoticeProps {
  readonly onDismiss: () => void;
}

export function TabletNotice({ onDismiss }: TabletNoticeProps) {
  return (
    <div className="tablet-notice" role="status">
      <p>
        <strong>DrawSprout paling nyaman di tablet.</strong> Di HP tetap bisa menggambar.
      </p>
      <button type="button" className="button" onClick={onDismiss}>
        Mengerti
      </button>
    </div>
  );
}

/**
 * A short note for phone-sized screens. Drawing still works; the note only
 * says a tablet is the more comfortable place.
 */

import { useI18n } from '../i18n/context';

interface TabletNoticeProps {
  readonly onDismiss: () => void;
}

export function TabletNotice({ onDismiss }: TabletNoticeProps) {
  const { t } = useI18n();
  return (
    <div className="tablet-notice" role="status">
      <p>
        <strong>{t('tabletNotice')}</strong>
      </p>
      <button type="button" className="button" onClick={onDismiss}>
        {t('tabletOk')}
      </button>
    </div>
  );
}

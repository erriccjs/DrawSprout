import { useI18n } from './context';

/** Two words a child can press. The pressed one is the language on screen. */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-switch" role="group" aria-label={t('language')}>
      <button type="button" className="chip" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
        {t('english')}
      </button>
      <button type="button" className="chip" aria-pressed={locale === 'id'} onClick={() => setLocale('id')}>
        {t('indonesian')}
      </button>
    </div>
  );
}

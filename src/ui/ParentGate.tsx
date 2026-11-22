/**
 * Asks for a sum before a parent action. A wrong answer only asks again.
 */

import { useState } from 'react';
import { useI18n } from '../i18n/context';
import { grantParent, makeParentQuestion, type ParentQuestion } from './parent-session';

interface ParentGateProps {
  readonly onPass: () => void;
  readonly onCancel: () => void;
  readonly question?: ParentQuestion;
}

export function ParentGate({ onPass, onCancel, question }: ParentGateProps) {
  const { t } = useI18n();
  const [sum] = useState(() => question ?? makeParentQuestion());
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (Number(value) !== sum.answer) {
      setWrong(true);
      return;
    }
    grantParent();
    onPass();
  };

  return (
    <section className="parent-gate" role="dialog" aria-labelledby="parent-gate-title">
      <h2 id="parent-gate-title">{t('parentTitle')}</h2>
      <p>{t('parentQuestion', { left: sum.left, right: sum.right })}</p>
      <label className="parent-gate__field">
        <span>{t('parentAnswer')}</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setWrong(false);
          }}
        />
      </label>
      {wrong && <p className="banner banner--warning" role="alert">{t('parentWrong')}</p>}
      <div className="button-row">
        <button type="button" className="button" onClick={onCancel}>{t('cancel')}</button>
        <button type="button" className="button button--primary" onClick={submit}>{t('parentContinue')}</button>
      </div>
    </section>
  );
}

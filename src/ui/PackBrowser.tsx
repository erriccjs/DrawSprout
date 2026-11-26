/**
 * Pack cards on the home screen.
 *
 * With the freemium flag off, every card opens. With the flag on, a premium
 * pack shows a quiet lock. The lock leads through the parent gate to a page
 * with no price. The child never sees a cost.
 */

import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/context';
import { presentLesson } from '../i18n/present';
import { PREVIEW_INK, stepPreview } from '../lesson-data/step-preview';
import type { LessonPackage } from '../lesson-data/schema';
import { PACKS, lessonsIn, type ContentPack } from '../packs/catalogue';
import {
  IndexedDbEntitlementStore,
  deviceMayOpen,
  type DeviceEntitlement,
  type EntitlementStore,
} from '../packs/entitlement';
import { premiumFlagEnabled } from '../packs/flag';
import { recordUsage } from '../usage/client';
import { ParentGate } from './ParentGate';
import { parentUnlocked } from './parent-session';

interface PackBrowserProps {
  readonly disabled: boolean;
  readonly onSelect: (lessonId: string) => void;
}

export function PackBrowser({ disabled, onSelect }: PackBrowserProps) {
  const { t, locale } = useI18n();
  const [store] = useState<EntitlementStore>(() => new IndexedDbEntitlementStore());
  const [entitlement, setEntitlement] = useState<DeviceEntitlement | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [parentPage, setParentPage] = useState(false);
  const [gating, setGating] = useState(false);
  const flagged = premiumFlagEnabled();

  useEffect(() => {
    let gone = false;
    void store.read().then((record) => {
      if (!gone) setEntitlement(record);
    }).catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [store]);

  useEffect(() => () => store.close(), [store]);

  const locked = (pack: ContentPack) => flagged && pack.tier === 'premium' && !deviceMayOpen(entitlement, pack.id);

  const openPack = (pack: ContentPack) => {
    if (pack.id === 'inti') {
      recordUsage('pack_open', pack.id);
      document.getElementById('theme-nature')?.scrollIntoView({ block: 'start' });
      setOpenId(null);
      return;
    }
    recordUsage('pack_open', pack.id);
    setOpenId(pack.id);
  };

  const askParent = (pack: ContentPack) => {
    recordUsage('premium_lock_view', pack.id);
    if (parentUnlocked()) setParentPage(true);
    else setGating(true);
  };

  const unlock = async (packId: string) => {
    const next = await store.grant(packId);
    setEntitlement(next);
    setParentPage(false);
    setOpenId(packId);
  };

  const opened = PACKS.find((pack) => pack.id === openId) ?? null;

  return (
    <section className="pack-browser" aria-labelledby="pack-browser-title">
      <h2 id="pack-browser-title">{t('packsTitle')}</h2>
      <div className="pack-browser__row">
        {PACKS.map((pack) => {
          const name = pack.name[locale];
          if (locked(pack)) {
            return (
              <button
                key={pack.id}
                type="button"
                className="pack-card pack-card--locked"
                disabled={disabled}
                onClick={() => askParent(pack)}
              >
                <PackCover packId={pack.id} />
                <span className="pack-card__name">{name}</span>
                <span className="pack-card__ask">{t('askGrownup')}</span>
              </button>
            );
          }
          return (
            <button
              key={pack.id}
              type="button"
              className="pack-card"
              disabled={disabled}
              onClick={() => openPack(pack)}
            >
              <PackCover packId={pack.id} />
              <span className="pack-card__name">{name}</span>
              <span className="pack-card__blurb">{pack.blurb[locale]}</span>
            </button>
          );
        })}
      </div>
      {opened && !locked(opened) && (
        <div className="pack-browser__lessons">
          <h3>{opened.name[locale]}</h3>
          <div className="lesson-picker__choices">
            {lessonsIn(opened).map((lesson) => {
              const shown = presentLesson(lesson, locale);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  className="lesson-picker__choice"
                  disabled={disabled}
                  onClick={() => onSelect(lesson.id)}
                >
                  <FinishedMark lesson={shown} />
                  <span className="lesson-picker__name">{shown.title}</span>
                  <span className="lesson-picker__subtitle">{shown.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {gating && (
        <ParentGate
          onPass={() => {
            setGating(false);
            setParentPage(true);
          }}
          onCancel={() => setGating(false)}
        />
      )}
      {parentPage && (
        <section className="parent-gate premium-page" role="dialog" aria-labelledby="premium-title">
          <h2 id="premium-title">{t('premiumTitle')}</h2>
          <p>{t('premiumLead')}</p>
          {PACKS.filter((pack) => pack.tier === 'premium').map((pack) => (
            <div key={pack.id} className="premium-page__pack">
              <h3>{pack.name[locale]}</h3>
              <p>{pack.blurb[locale]}</p>
              {deviceMayOpen(entitlement, pack.id) ? (
                <p role="status">{t('premiumOpen')}</p>
              ) : (
                <button type="button" className="button button--primary" onClick={() => void unlock(pack.id)}>
                  {t('premiumUnlock')}
                </button>
              )}
            </div>
          ))}
          <button type="button" className="button" onClick={() => setParentPage(false)}>{t('premiumBack')}</button>
        </section>
      )}
    </section>
  );
}

function FinishedMark({ lesson }: { readonly lesson: LessonPackage }) {
  const preview = stepPreview(lesson, Math.max(0, lesson.steps.length - 1));
  return (
    <svg className="lesson-picker__picture" viewBox={`0 0 ${lesson.coordinateSpace.width} ${lesson.coordinateSpace.height}`} aria-hidden="true">
      {preview.fills.map((fill) => (
        <path key={fill.id} d={fill.d} fill={fill.fill === 'paper' ? 'var(--paper)' : fill.fill} stroke="none" />
      ))}
      {preview.strokes.map((stroke) => (
        <path key={stroke.id} d={stroke.d} fill="none" stroke={PREVIEW_INK[stroke.kind]} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function PackCover({ packId }: { readonly packId: string }) {
  const gold = packId === 'nusantara';
  return (
    <svg className="pack-card__cover" viewBox="0 0 120 80" aria-hidden="true">
      <rect width="120" height="80" rx="12" fill={gold ? '#f3e2b3' : '#e7eefc'} />
      {gold ? (
        <path d="M60 14 L28 66 L92 66 Z" fill="#e6b84a" />
      ) : (
        <circle cx="60" cy="40" r="18" fill="#3350d6" />
      )}
    </svg>
  );
}

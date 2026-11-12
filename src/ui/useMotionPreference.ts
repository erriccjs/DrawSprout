import { useEffect, useState } from 'react';
import { motionPreference, type MotionPreference } from './motion';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useMotionPreference(): MotionPreference {
  const [motion, setMotion] = useState<MotionPreference>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'full';
    return motionPreference(window.matchMedia(QUERY).matches);
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(QUERY);
    const update = () => setMotion(motionPreference(query.matches));
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return motion;
}

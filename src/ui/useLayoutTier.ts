import { useLayoutEffect, useState } from 'react';
import { layoutTier, type LayoutTier } from './layout-tier';

function readTier(): LayoutTier {
  return layoutTier(window.innerWidth, window.innerHeight);
}

/**
 * Tracks the viewport tier. `useLayoutEffect` applies a resize before paint so
 * a rotation does not flash the tablet columns on a phone.
 */
export function useLayoutTier(): LayoutTier {
  const [tier, setTier] = useState<LayoutTier>(readTier);

  useLayoutEffect(() => {
    const update = () => {
      const next = readTier();
      setTier((current) => (current === next ? current : next));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      viewport?.removeEventListener('resize', update);
    };
  }, []);

  return tier;
}

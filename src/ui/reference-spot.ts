import type { LayoutTier } from './layout-tier';

/** Landscape tablet has a side margin. Portrait and phone do not. */
export function referencePresentation(layout: LayoutTier, landscape: boolean): 'card' | 'thumb' {
  return layout === 'tablet' && landscape ? 'card' : 'thumb';
}

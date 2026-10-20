import { describe, expect, it } from 'vitest';
import {
  EDGE_DEAD_ZONE_PX,
  PALM_CONTACT_PX,
  fingerTouchGuard,
  isPalmContact,
  isScreenEdge,
} from './edge-guard';

describe('finger-mode edge and palm filters', () => {
  it('treats a wide or tall contact as a palm, and an unreported size as a finger', () => {
    expect(isPalmContact(1, 1)).toBe(false);
    expect(isPalmContact(0, 0)).toBe(false);
    expect(isPalmContact(24, 30)).toBe(false);
    expect(isPalmContact(PALM_CONTACT_PX, 20)).toBe(true);
    expect(isPalmContact(20, PALM_CONTACT_PX)).toBe(true);
    expect(isPalmContact(Number.NaN, 100)).toBe(false);
  });

  it('marks the viewport margin and leaves the middle of the screen free', () => {
    expect(isScreenEdge(4, 200, 1024, 768)).toBe(true);
    expect(isScreenEdge(200, 4, 1024, 768)).toBe(true);
    expect(isScreenEdge(1024 - 4, 400, 1024, 768)).toBe(true);
    expect(isScreenEdge(400, 768 - 4, 1024, 768)).toBe(true);
    expect(isScreenEdge(EDGE_DEAD_ZONE_PX, 200, 1024, 768)).toBe(false);
    expect(isScreenEdge(200, 400, 1024, 768)).toBe(false);
  });

  it('does not block a viewport that is smaller than the margin', () => {
    expect(isScreenEdge(2, 2, 40, 40)).toBe(false);
  });

  it('ignores a palm and an edge touch, and lets a mouse or a normal finger through', () => {
    const view = { viewportWidth: 1024, viewportHeight: 768, contactWidth: 20, contactHeight: 24 };
    expect(fingerTouchGuard({ ...view, pointerType: 'touch', clientX: 8, clientY: 400 })).toBe('edge');
    expect(
      fingerTouchGuard({
        ...view,
        pointerType: 'touch',
        clientX: 400,
        clientY: 400,
        contactWidth: 120,
        contactHeight: 90,
      }),
    ).toBe('palm');
    expect(fingerTouchGuard({ ...view, pointerType: 'touch', clientX: 400, clientY: 400 })).toBe('ok');
    expect(fingerTouchGuard({ ...view, pointerType: 'mouse', clientX: 4, clientY: 4 })).toBe('ok');
    expect(fingerTouchGuard({ ...view, pointerType: 'pen', clientX: 4, clientY: 4, contactWidth: 200, contactHeight: 200 })).toBe('ok');
  });
});

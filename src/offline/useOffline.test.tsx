import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUNDLED_LESSONS } from '../lesson-data';
import type * as RegisterModule from './register';
import { resetOfflineStatus } from './status';
import { useOfflineSupport } from './useOffline';

const registration = vi.hoisted(() => ({
  applyUpdate: vi.fn(),
  checkForUpdate: vi.fn(() => Promise.resolve()),
  settled: Promise.resolve(),
  dispose: vi.fn(),
}));

const registerOffline = vi.hoisted(() => vi.fn<
  (container: RegisterModule.WorkerContainerLike, options: RegisterModule.RegisterOfflineOptions) => RegisterModule.RegisteredOffline
>(() => registration));

vi.mock('./register', async () => {
  const actual = await vi.importActual<typeof RegisterModule>('./register');
  return { ...actual, registerOffline };
});

describe('useOfflineSupport', () => {
  beforeEach(() => {
    resetOfflineStatus();
    registerOffline.mockClear();
    registration.applyUpdate.mockClear();
    registration.checkForUpdate.mockClear();
    registration.dispose.mockClear();
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('does not register outside a production build', () => {
    renderHook(() => useOfflineSupport());
    expect(registerOffline).not.toHaveBeenCalled();
  });

  it('registers in production and publishes the worker events it is given', () => {
    const container = { marker: true };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: container });
    const { result, unmount } = renderHook(() => useOfflineSupport({ production: true }));

    expect(registerOffline).toHaveBeenCalledOnce();
    const call = registerOffline.mock.calls[0];
    expect(call?.[0]).toBe(container);
    expect(call?.[1].requiredLessons).toEqual(BUNDLED_LESSONS.map((lesson) => ({
      id: lesson.id,
      contentVersion: lesson.contentVersion,
    })));

    act(() => { call?.[1].onWaiting(); });
    expect(result.current.updateWaiting).toBe(true);
    act(() => { call?.[1].onReady(); });
    expect(result.current.ready).toBe(true);

    act(() => { result.current.requestApply(); });
    expect(result.current.applyRequested).toBe(true);
    act(() => { result.current.applyUpdate(); });
    expect(registration.applyUpdate).toHaveBeenCalledOnce();

    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(registration.checkForUpdate).toHaveBeenCalledOnce();

    unmount();
    expect(registration.dispose).toHaveBeenCalledOnce();
  });
});

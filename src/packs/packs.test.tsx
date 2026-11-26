import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { answerParentGate } from '../test/parent-gate';
import { clearParentUnlock } from '../ui/parent-session';
import { PackBrowser } from '../ui/PackBrowser';
import { MemoryEntitlementStore, deviceMayOpen } from './entitlement';
import { setPremiumFlag } from './flag';

afterEach(() => {
  setPremiumFlag(null);
  clearParentUnlock();
});

describe('picture packs', () => {
  it('opens Nusantara while the flag is off, with no lock and no price', () => {
    setPremiumFlag(false);
    render(<PackBrowser disabled={false} onSelect={() => undefined} />);
    expect(screen.queryByText('Minta orang tua')).toBeNull();
    expect(screen.queryByText(/harga|beli|Rp|segera|coming soon/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Nusantara/ }));
    expect(screen.getByRole('button', { name: /Gunungan/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pinisi/ })).toBeTruthy();
  });

  it('shows a parent page instead of a price when the flag is on', async () => {
    setPremiumFlag(true);
    clearParentUnlock();
    const calls = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', calls);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const onSelect = vi.fn();
    render(<PackBrowser disabled={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Minta orang tua/ }));
    expect(calls.mock.calls.some((call) => typeof call[1]?.body === 'string' && call[1].body.includes('premium_lock_view'))).toBe(true);
    answerParentGate();
    expect(screen.getByRole('dialog', { name: 'Paket premium' })).toBeTruthy();
    expect(screen.getByText(/Tidak ada pembayaran/)).toBeTruthy();
    expect(screen.queryByText(/harga|beli|Rp|segera|coming soon/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Buka di perangkat ini' }));
    expect(await screen.findByRole('button', { name: /Gunungan/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Gunungan/ }));
    expect(onSelect).toHaveBeenCalledWith('wayang-gunungan');
    vi.unstubAllGlobals();
  });

  it('stores an entitlement without a payment source', async () => {
    const store = new MemoryEntitlementStore();
    expect(deviceMayOpen(await store.read(), 'nusantara')).toBe(false);
    const granted = await store.grant('nusantara', 'placeholder', 10);
    expect(granted).toEqual({ version: 1, packs: ['nusantara'], source: 'placeholder', grantedAt: 10 });
    expect(deviceMayOpen(await store.read(), 'nusantara')).toBe(true);
  });
});

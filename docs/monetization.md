# Monetization

DrawSprout should not charge until about 10–20 families are actually coming
back. This document is the shape of a later freemium product. The code behind
it does not take a payment.

## The flag

The freemium flag is **off** by default. While it is off, every pack opens,
including a pack whose metadata says `premium`. Nothing that is free today
becomes locked.

Turn it on for a look:

- Add `?premium=1` to the page address, or
- Set `localStorage` key `drawsprout.premium` to `on`.

`?premium=0` forces it off for that visit even if the key is `on`. Tests set
the flag in memory with `setPremiumFlag`. There is no server switch.

## What the child sees

With the flag off, pack cards are ordinary buttons. With the flag on, a
premium pack that this device has not opened shows a quiet lock and the words
"Minta orang tua" / "Ask a grown-up". There is no price, no "buy", and no
"coming soon" on any child screen.

The lock goes through the parent gate. The page after that is for a grown-up.
Its button, "Buka di perangkat ini", writes a local entitlement. It does not
charge anyone.

## Entitlement

The record lives in IndexedDB, database `drawsprout-entitlement`, store
`grants`, key `device`. It is not in the drawing database.

```ts
{
  version: 1,
  packs: ['nusantara'],
  source: 'placeholder',
  grantedAt: 1710000000000
}
```

`source` is `placeholder` today. A later grant can use `play` or `web` and
write the same record, so the drawing screen does not need to know which
store sold the pack. A real grant should be signed, or checked once and then
stored, so a paid child can keep drawing with no network. The placeholder is
not signed. It only exists so the lock and the parent page can be tried while
the flag is on.

The core pack `inti` is `tier: 'free'` forever, along with "Mulai di sini" and
the daily challenge. Nusantara is `tier: 'premium'` in its metadata and is
still open while the flag is off.

## Providers to compare later

Do not add a payment SDK until the retention trial says a family would pay.

| Option | Fits | Trade-off |
| --- | --- | --- |
| Google Play Billing, after a TWA / Bubblewrap wrap | Families who install from Play | The web app itself cannot call Play Billing. A wrapper has to own the purchase and then write the local entitlement. Play's fee and review rules apply. Offline use still needs the entitlement stored on the device. |
| Midtrans or Xendit on a small server | A browser purchase in Indonesia: cards, bank transfer, e-wallet, QRIS | DrawSprout would send a parent to a checkout and later receive a server notice. That is a new server, a new secret, and a child must not see the checkout. The device still needs a stored entitlement for offline drawing. |
| QRIS through one of those gateways | A parent who already pays with a QR code | QRIS is a rail, not a full SDK. The same server checkout would show the code. There is still no charge in this app. |

None of these is wired up. The app does not load a payment script, does not
call a payment host, and does not show an amount.

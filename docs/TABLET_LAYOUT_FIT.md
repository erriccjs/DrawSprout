# Drawing screen: tablet fit measurements

Measured in headless Chrome (viewport emulation, touch, DPR 1) against the dev
server, lesson "Kucing Duduk", worst case over steps 1, 8 and 9 (the last two
are colour steps, which add the boundary-assist group to the Bantuan tab).
"-100px" rows subtract 100px from the nominal height to simulate browser
chrome (address bar, tabs).

Layout rules this verifies:

- The page never scrolls (`page scroll` is always 0).
- Landscape at 620px height or more: canvas left, controls column on the right.
- Landscape under 620px height, and portrait: controls use two columns
  (navigation and tabs share a row, tools/colours left and right) so the
  Drawing tab stays short. Portrait keeps instruction and example on top and the
  canvas dominant.
- If the controls still exceed the column, `.pad__side` scrolls internally. No
  measured case needs this for the Drawing tab. At 1024x430 the Drawing tab is
  243px in a 225px column, with tools, colours, width and Batalkan/Ulangi still
  above the fold; only the last 18px scrolls. This row was measured on step 1 only.
- The Bantuan tab opens with the palm-rejection / stylus guidance first, and it
  was visible without scrolling in every case below.

Columns: Drawing = natural height of the Drawing tab column, Bantuan = natural
height of the Bantuan tab column, Column = height available to the controls
column, Canvas = drawing surface size.

| Size | Orientation | Viewport h | Drawing | Bantuan | Column | Fits | Canvas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1024x768 | landscape | 768 | 399 | 463 | 563 | yes | 668x501 |
| 1024x768 -100 | landscape | 668 | 399 | 463 | 463 | yes | 617x463 |
| 1180x820 | landscape | 820 | 399 | 463 | 615 | yes | 820x615 |
| 1180x820 -100 | landscape | 720 | 399 | 463 | 515 | yes | 687x515 |
| 1280x800 | landscape | 800 | 399 | 463 | 595 | yes | 793x595 |
| 1280x800 -100 | landscape | 700 | 399 | 463 | 495 | yes | 660x495 |
| 1024x700 | landscape | 700 | 399 | 463 | 495 | yes | 660x495 |
| 1024x700 -100 | landscape | 600 | 243 | 274 | 395 | yes | 440x330 |
| 1133x680 | landscape | 680 | 399 | 463 | 475 | yes | 633x475 |
| 1133x680 -100 | landscape | 580 | 243 | 274 | 375 | yes | 500x375 |
| 1024x600 | landscape | 600 | 243 | 274 | 395 | yes | 440x330 |
| 1024x600 -100 | landscape | 500 | 243 | 274 | 295 | yes | 393x295 |
| 960x600 | landscape | 600 | 243 | 274 | 395 | yes | 376x282 |
| 960x600 -100 | landscape | 500 | 243 | 274 | 295 | yes | 376x282 |
| 768x1024 | portrait | 1024 | 240 | 274 | 240 | yes | 744x558 |
| 768x1024 -100 | portrait | 924 | 240 | 274 | 240 | yes | 706x530 |
| 820x1180 | portrait | 1180 | 240 | 259 | 240 | yes | 796x597 |
| 820x1180 -100 | portrait | 1080 | 240 | 259 | 240 | yes | 796x597 |
| 744x1133 | portrait | 1133 | 240 | 274 | 240 | yes | 720x540 |
| 744x1133 -100 | portrait | 1033 | 240 | 274 | 240 | yes | 720x540 |
| 600x960 | portrait | 960 | 243 | 274 | 243 | yes | 576x432 |
| 600x960 -100 | portrait | 860 | 243 | 274 | 243 | yes | 491x368 |

In portrait the controls row is content-sized (capped at 50vh), so Column equals
the Drawing height; the canvas takes the rest. Every Drawing column is under the
580px target. At 1024x768 and 1180x820, with or without simulated chrome, no
internal scrolling is needed in either tab.

## The eraser's "Hapus semua" and its question

Measured the same way, on step 1 of "Kucing Duduk", in three states: the pen
chosen (the rows above), the eraser chosen (which reveals "Hapus semua" on its
own row inside the tool group), and the question "Mau mulai dengan gambar
kosong?" open in place of that button.

The Drawing tab's natural column height goes 397 → 476 with the button → 510
with the question open, in the one-column landscape layout. Where the controls
use two columns (portrait, and landscape under 620px) the button costs nothing
measurable and the question adds 12-38px.

| Size | Orientation | Column | Pen | + Hapus semua | + question | Page scroll | Batalkan in view |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1024x768 | landscape | 563 | 397 | 476 | 510 | 0 | yes |
| 1024x768 -100 | landscape | 463 | 397 | 476 | 510 | 0 | only until the question is answered |
| 1180x820 | landscape | 615 | 397 | 476 | 510 | 0 | yes |
| 1180x820 -100 | landscape | 515 | 397 | 476 | 510 | 0 | yes |
| 1024x600 | landscape | 395 | 395 | 395 | 395 | 0 | yes |
| 1024x600 -100 | landscape | 295 | 295 | 295 | 333 | 0 | only until the question is answered |
| 768x1024 | portrait | 240 | 240 | 240 | 252 | 0 | yes |
| 820x1180 | portrait | 240 | 240 | 240 | 252 | 0 | yes |
| 600x1024 | portrait | 246 | 243 | 246 | 280 | 0 | yes |

The page never scrolls in any of these, in either axis, and nothing is clipped.

Two rows need the caveat in the last column. At 1024x668 and 1024x500 — the
simulated-browser-chrome rows — the open question pushes the column 49px and
38px past its height, so `.pad__side` scrolls internally and Batalkan sits just
below the fold while the question is on screen. Answering the question takes the
block away again and Batalkan comes back into view, which is the moment it is
needed: the child cannot reach for undo until the clear has happened. The three
sizes the feature was required to fit — 1024x768, 1180x820 and 1024x600, in both
orientations — need no internal scrolling in any of the three states.

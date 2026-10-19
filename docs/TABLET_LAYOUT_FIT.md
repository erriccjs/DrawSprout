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

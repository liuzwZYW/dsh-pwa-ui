# Changelog

## 1.0.2

- The caption band above the main column is draggable again on the sessionless
  and blank pages. The shell collapses the header row to no height there
  (`_headerBlank` sets `min-height: 0`, `_headerSessionless` drops the top
  padding) around an empty title row, so the row's drag box had no height and
  the band could not move the window. That collapsed state now takes the
  caption's height; the ordinary 76px header row is untouched.

## 1.0.1

Verification release for the npm Trusted Publisher. No functional change: the
tree is 1.0.0 plus this changelog and the version bump. Published by
`.github/workflows/publish.yml` through OIDC, with no token.

## 1.0.0

First release.

- Host half: `/manifest.webmanifest` is served with
  `display_override: ["window-controls-overlay"]` first, every other field of
  the shipped frontend manifest passed through, and an embedded copy as the
  fallback.
- Client half: the app's own `data-window-drag` rows (the sidebar brand row and
  the session header) become the overlay drag region, the app's controls stay
  clickable through the mirrored `no-drag` list, several restated paddings and
  the sidebar root's own `6px` box are cancelled on the brand row, and whichever
  surface owns the window's trailing edge is inset clear of the browser's
  caption chrome.
- `::window-controls-overlay { background: transparent }` ships as two
  independent rules for the still-open
  [WICG proposal](https://github.com/WICG/window-controls-overlay/issues/67);
  browsers drop them today and they take effect once one implements it.

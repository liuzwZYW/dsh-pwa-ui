# dsh-pwa-ui

[中文](README.md) | English

DeepSeek Harness (`dsh`) web plugin that gives the **installed** web app a
native-looking window caption, using the
[Window Controls Overlay](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/window-controls-overlay)
API.

No extra title bar is drawn. The manifest opts into the overlay, and the app's
**own** chrome — the sidebar's logo row and the session header — becomes the
window's title bar: that strip is where the window is dragged from, and the
app's own controls are pushed clear of the system window buttons.

![An installed app window: the app's own logo row and session header are the caption](assets/screenshot-1.png)

## Install

```sh
dsh plugin --profile web add @liuzw/dsh-pwa-ui
```

Then restart `dsh web` (the manifest route is claimed at startup) and install
the UI as an app in Edge or Chrome: address bar → **Install**. The app window
opens with its own header as the caption.

To check it without installing: Microsoft Edge DevTools →
**Application → Window Controls Overlay** simulates the overlay; the plugin
treats the simulated `env()` geometry as an active overlay even while the
`navigator.windowControlsOverlay` API stays hidden.

## What it does

| Half | File | Responsibility |
| --- | --- | --- |
| Host | `index.js` | Claims the exact `/manifest.webmanifest` route and answers with the shipped frontend manifest plus `display_override: ["window-controls-overlay"]` as its first candidate. Every other field (`name`, `short_name`, `start_url`, `scope`, `display`, `icons`) is passed through from `@deepseek-ai/dsh-web-frontend/dist/manifest.webmanifest`; only an unreadable shipped manifest falls back to an embedded copy. `display: "fullscreen"` stays the fallback mode, so platforms without overlay support keep the stock behavior. |
| Client | `client.js` | Publishes `data-dsh-wco` on `<html>` while the overlay is visible, injects one stylesheet, and removes both on unload. |

### The caption is the app's own chrome

The shell already declares which rows are window drag handles for desktop
windows: the sidebar's brand row and the conversation header mark themselves
`data-window-drag`, and `ui-web` base.css turns that single mark into the macOS
drag rule. The client half reuses that contract instead of adding chrome:

- `html[data-dsh-wco] [data-window-drag]` becomes the `app-region: drag`
  handle, so the window is dragged from the logo row and the session header
  exactly as the desktop builds drag from their chrome.
- The app's own controls stay clickable through the mirrored `no-drag` list
  (`button`, `a`, `[role=tab]`, …) plus the app's `data-window-drag-recall`
  opt-out marker.
- The sidebar root's own `6px` top / `--dsh-sidebar-inline-padding` box is
  cancelled on the brand row (negative margins, the same insets re-added as row
  padding), so the brand row's border box — and therefore its drag region —
  reaches the window's top-left corner without moving a pixel of content.
- `--dsh-wco-controls-start` / `--dsh-wco-controls-end` measure the strip the
  browser's caption chrome occupies (empty on the trailing side on Windows, on
  the leading side on macOS, and on Edge it covers every browser button, not
  just the window buttons). Only the surface that actually owns the window's
  trailing edge takes the inset, because only that surface can reach those
  buttons: an open right panel insets its own docking-tab strip, and with no
  panel open the session header takes it instead. The sidebar's brand row and
  the docking kit's own leading inset take `controls-start`, so the macOS
  traffic lights never overlap app controls.
- `--dsh-frame-leading-clearance` and `--dsh-frame-overlay-top` are published so
  the frame's title row and its dialog/popover surfaces stay clear of the
  controls. `--dsh-frame-chrome-top` is deliberately left alone: the caption is
  app content now, so modal masks cover it.

## Requirements

- A DSH **web** profile (`dsh web`); the desktop/Electron windows use their own
  `data-platform="darwin"` / `data-windows-titlebar` chrome and are untouched.
- A browser with Window Controls Overlay support for installed apps: Edge or
  Chrome on Windows/macOS. The app must actually be installed — in a normal
  browser tab `navigator.windowControlsOverlay.visible` is false and
  `env(titlebar-area-height)` resolves to `0px`, so nothing is drawn, no padding
  is reserved and the layout is untouched.

## Notes and caveats

- No dependencies, no build step: the package ships plain ES modules and is
  installed from npm or straight from this repository.
- **The caption backdrop.** On a reload the browser can paint its own backdrop
  behind the caption buttons before the app repaints the same strip, so the
  top-right corner briefly disagrees with the rest. That is exactly what the
  [`::window-controls-overlay`](https://github.com/WICG/window-controls-overlay/issues/67)
  proposal is for, and the plugin already ships
  `::window-controls-overlay { background: transparent }` — as two separate
  rules, so an unsupported form cannot invalidate the other. No browser
  implements the proposal yet: today they drop these rules as unknown selectors
  and the stylesheet starts working the day one ships. Until then the only knob
  that reaches that backdrop is the manifest's `theme_color`.
- The plugin targets the shipped frontend's own hooks, so a frontend change can
  need a follow-up: the `data-window-drag` markers, the right panel's
  `data-sidebar-right-panel` / `data-sidebar-right-open` / `data-dockkit-float`
  attributes and `--dsh-dockkit-strip-inline-start`, plus a few restated values
  (the conversation header's `28px` trailing padding, the docking tab strip's
  `6px`, the brand row's `4px` inline-start padding and its `60px` / `36px`
  heights, and the sidebar root's `6px` box) and the `_logoRow` / `_root` /
  `_collapsed` / `_headerBlank` / `_headerSessionless` / `_tabStrip` CSS-module
  suffixes.
- On the sessionless and blank pages the shell collapses the header row to no
  height, which would leave the caption band above the main column with no drag
  surface; that collapsed state is given the caption’s height instead.
- The reserved strip is measured from the browser, not assumed: on Edge the
  caption chrome can be several hundred pixels wide, and that is the width the
  app's trailing controls are inset by.
- macOS is implemented (leading insets through the same variables) but was not
  verified on a real macOS window.

## License

MIT

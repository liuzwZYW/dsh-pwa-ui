/**
 * Client half: the app's own chrome rows become the window's title bar.
 *
 * No bar is drawn. The shell already declares which rows are window drag
 * handles for desktop windows — the sidebar's brand row and the conversation
 * header mark themselves `data-window-drag`, and `ui-web` base.css turns that
 * mark into the single drag rule on macOS. Here the same mark becomes the
 * Window Controls Overlay drag handle, the app's own controls stay clickable
 * through the mirrored `no-drag` list, and whichever surface owns the window's
 * trailing edge is inset by the strip the browser's caption chrome occupies,
 * so no app button lands under a system button.
 * See
 * https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/window-controls-overlay.
 *
 * Everything here is inert while the overlay is hidden: an ordinary browser tab
 * never receives the marker, and the fallback for every `titlebar-area-*`
 * environment variable is zero.
 */
window.__ModuleLoader__.load({
  id: 'dsh-pwa-ui',
  factory() {
    /** Marker that switches the caption rules on. */
    const ACTIVE_ATTR = 'data-dsh-wco';
    /** The overlay API; undefined in browsers without it (Firefox, Safari). */
    const overlay = typeof navigator === 'undefined' ? undefined : navigator.windowControlsOverlay;

    /**
     * `--dsh-wco-controls-start` / `--dsh-wco-controls-end` are the strips the
     * window controls occupy: empty on the trailing side on Windows, on the
     * leading side on macOS. `--dsh-frame-leading-clearance` is the frame's own
     * published leading inset, which the conversation title row already reads;
     * `--dsh-frame-overlay-top` keeps dialog surfaces and popovers clear of the
     * controls. The frame's `--dsh-frame-chrome-top` is deliberately untouched:
     * the caption is now the app's own header, so modal masks cover it.
     * `--dsh-dockkit-strip-inline-start` is the docking kit's own leading inset
     * (10px by default), which the desktop builds raise to clear the macOS
     * traffic lights.
     *
     * The app's own chrome rows are the caption. Their interactive descendants
     * opt back out with the same list `ui-web` base.css uses for macOS, plus the
     * app's `data-window-drag-recall` opt-out marker.
     */
    const CSS = [
      `html[${ACTIVE_ATTR}]{`,
      '--dsh-wco-controls-start:env(titlebar-area-x, 0px);',
      '--dsh-wco-controls-end:calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw));',
      '--dsh-frame-leading-clearance:var(--dsh-wco-controls-start);',
      '--dsh-frame-overlay-top:calc(env(titlebar-area-height, 0px) + 20px);',
      '--dsh-dockkit-strip-inline-start:calc(10px + var(--dsh-wco-controls-start));',
      '}',
      `html[${ACTIVE_ATTR}] [data-window-drag]{`,
      '-webkit-app-region:drag;',
      'app-region:drag;',
      '}',
      `html[${ACTIVE_ATTR}] [data-window-drag-recall],`,
      `html[${ACTIVE_ATTR}] :is(button,a,input,select,textarea,summary,[contenteditable=true],[tabindex],[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=radio],[role=switch],[role=slider],[role=combobox],[role=textbox]){`,
      '-webkit-app-region:no-drag;',
      'app-region:no-drag;',
      '}',
      /* Only the surface that owns the window's trailing edge can reach the
         window controls. An open right panel owns it: the panel's own controls
         ride the end of its docking strip, so the strip takes the inset (its own
         trailing padding is 6px; a floating pane never touches the edge). */
      `html[${ACTIVE_ATTR}] [data-sidebar-right-panel][data-sidebar-right-open] [class*="_tabStrip"]:not([data-dockkit-float] *){`,
      'padding-right:calc(6px + var(--dsh-wco-controls-end));',
      '}',
      /* With no panel open the conversation header itself ends at the window
         edge, so its trailing controls (page actions, panel toggle) take the
         inset instead; its own trailing padding is 28px. */
      `html[${ACTIVE_ATTR}]:not(:has([data-sidebar-right-panel][data-sidebar-right-open])) header[data-window-drag]{`,
      'padding-right:calc(28px + var(--dsh-wco-controls-end));',
      '}',
      /* The sidebar root's own 6px top / `--dsh-sidebar-inline-padding` box keeps
         the brand row off the window edges, so the caption's top-left corner was
         not draggable. Cancel that box on the brand row alone and carry the same
         insets as row padding: the row's border box then spans the whole sidebar
         column from y=0, and the drag region reaches the window edges while no
         pixel of the row's content moves. The shipped row is 60px tall expanded
         and 36px in the rail; the padding and the trailing margin compensate for
         the box that moved up, so the flow below the row is unchanged too. */
      `html[${ACTIVE_ATTR}] [class*="_root"]:not([class*="_collapsed"]) [class*="_logoRow"]{`,
      'margin:-6px calc(-1 * var(--dsh-sidebar-inline-padding, 12px)) 10px;',
      'padding:20px var(--dsh-sidebar-inline-padding, 12px) 8px calc(var(--dsh-sidebar-inline-padding, 12px) + 4px + var(--dsh-wco-controls-start));',
      '}',
      `html[${ACTIVE_ATTR}] [class*="_root"][class*="_collapsed"] [class*="_logoRow"]{`,
      'margin:-6px calc(-1 * var(--dsh-sidebar-inline-padding, 12px)) 18px;',
      'padding:12px var(--dsh-sidebar-inline-padding, 12px) 0 calc(var(--dsh-sidebar-inline-padding, 12px) + var(--dsh-wco-controls-start));',
      '}',
    ].join('');

    return {
      apply(ctx) {
        ctx.effect(() => {
          const root = document.documentElement;
          const style = document.createElement('style');
          style.textContent = CSS;
          document.head.append(style);
          /* Zero-size probe: resolves `env(titlebar-area-height)` for the
             visible/hidden decision without trusting one API alone. */
          const probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(titlebar-area-height, 0px);visibility:hidden;pointer-events:none';
          (document.body ?? root).append(probe);
          const evaluate = () => {
            const active = (overlay !== undefined && overlay.visible === true) || probe.getBoundingClientRect().height > 0;
            if (active) root.setAttribute(ACTIVE_ATTR, '');
            else root.removeAttribute(ACTIVE_ATTR);
          };
          /* geometrychange fires on every resize step; coalesce to one layout read per frame. */
          let frame;
          const schedule = () => {
            if (frame !== undefined) return;
            frame = requestAnimationFrame(() => {
              frame = undefined;
              evaluate();
            });
          };
          evaluate();
          if (overlay !== undefined) overlay.addEventListener('geometrychange', schedule);
          return () => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            if (overlay !== undefined) overlay.removeEventListener('geometrychange', schedule);
            root.removeAttribute(ACTIVE_ATTR);
            probe.remove();
            style.remove();
          };
        }, 'web-overlay-titlebar: window caption');
      },
    };
  },
});

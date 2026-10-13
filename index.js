/**
 * Host half of the Window Controls Overlay bundle.
 *
 * A desktop PWA only receives the Window Controls Overlay when its web app
 * manifest opts in with `display_override: ["window-controls-overlay"]`
 * (https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/window-controls-overlay).
 * The shipped frontend serves its manifest as a plain dist file, so this row
 * claims that one exact route and answers with the shipped manifest plus the
 * overlay entry, keeping every other field (name, icons, start_url, scope,
 * display) exactly as the frontend declared it.
 *
 * The route is public like the static file it replaces: only the index
 * response passes browser authentication. The Client half draws the title bar
 * and reserves its height.
 * @module @liuzw/dsh-pwa-ui
 */
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** Stable Cordis plugin name. */
export const name = "web-overlay-titlebar";
/** Services required before the manifest route can be claimed. */
export const inject = ["webServer"];

/** The manifest URL the built index.html links, relative to the dist root. */
const MANIFEST_ROUTE = "/manifest.webmanifest";
/** Manifest display mode that turns on the window controls overlay. */
const OVERLAY_DISPLAY = "window-controls-overlay";
const CONTENT_TYPE = "application/manifest+json; charset=utf-8";

/**
 * Manifest used only when the shipped frontend manifest cannot be read; it
 * mirrors the fields the current frontend ships so an installed app still
 * gets a valid manifest in that failure case.
 */
const FALLBACK_MANIFEST = {
  name: "DeepSeek Harness",
  short_name: "DSH",
  start_url: "./",
  scope: "./",
  display: "fullscreen",
  icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
};

/**
 * Locate the built frontend's own manifest. The dist location is an assembly
 * fact of the shipped Web app, so it is resolved from the running
 * installation rather than configured: the CLI entry is realpathed first so
 * the lookup starts inside the installation's own store, where the frontend
 * package is linked beside the CLI, instead of the profile's module scope.
 * @returns absolute path of the shipped manifest.
 */
function resolveShippedManifest() {
  const anchor = process.argv[1] === undefined ? import.meta.url : realpathSync(process.argv[1]);
  const require = createRequire(anchor);
  const manifest = require.resolve("@deepseek-ai/dsh-web-frontend/package.json");
  return join(dirname(manifest), "dist", "manifest.webmanifest");
}

/**
 * Read the shipped manifest.
 * @returns the parsed manifest, or {@link FALLBACK_MANIFEST} when it is
 * unreadable or is not a JSON object.
 */
async function readShippedManifest() {
  try {
    const parsed = JSON.parse(await readFile(resolveShippedManifest(), "utf8"));
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    /* A missing frontend manifest keeps the app installable with the fallback. */
  }
  return FALLBACK_MANIFEST;
}

/**
 * Add the overlay display mode as the first `display_override` candidate,
 * preserving any candidates the frontend already declares.
 * @param manifest - the shipped manifest object.
 * @returns a new manifest object carrying the overlay entry.
 */
export function withOverlayDisplay(manifest) {
  const declared = Array.isArray(manifest.display_override)
    ? manifest.display_override.filter((value) => typeof value === "string")
    : [];
  const display_override = declared.includes(OVERLAY_DISPLAY) ? declared : [OVERLAY_DISPLAY, ...declared];
  return { ...manifest, display_override };
}

/**
 * Claim the manifest route and answer with the overlay-enabled manifest.
 * @param ctx - plugin context carrying the webServer service.
 */
export function apply(ctx) {
  let served;
  const render = async () => {
    served ??= `${JSON.stringify(withOverlayDisplay(await readShippedManifest()), null, 2)}\n`;
    return served;
  };
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: MANIFEST_ROUTE,
    handler: async (req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      const body = await render();
      res.writeHead(200, {
        "content-type": CONTENT_TYPE,
        /* Revalidate so an updated manifest reaches an already-installed app. */
        "cache-control": "no-cache",
      });
      if (req.method === "HEAD") res.end();
      else res.end(body);
    },
  }), "web-overlay-titlebar: web app manifest");
}

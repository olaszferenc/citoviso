// Prospect configurator injector (ADR-0015) — the visible sell layer.
//
// Serve-time only: the console injects this into a mock when serving the
// prospect-facing /configure/:artifactId route. It is NOT baked into the stored
// artifact file (which stays a pure snapshot) nor into the emailed link target's
// source — the configurator is an overlay the prospect interacts with BEFORE
// paying (module toggle + live preview + §B.17 sample state).
//
// Same inline-runtime approach as runtime.ts (ADR-0011): the CSS/JS are read from
// assets/runtime and inlined so the page stays standalone. A JSON manifest of the
// module catalog (present vs sample) is embedded for the client to render.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MODULE_CATALOG, detectPresentModules } from "../modules.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.resolve(HERE, "../../assets/runtime");

let cached: string | null = null;

async function configuratorBlock(): Promise<string> {
  if (cached) return cached;
  const css = await readFile(path.join(RUNTIME_DIR, "cit-configurator.css"), "utf8");
  const js = await readFile(path.join(RUNTIME_DIR, "cit-configurator.js"), "utf8");
  cached = `<style data-cit-configurator-css>\n${css}\n</style>\n<script data-cit-configurator-js>\n${js}\n</script>\n`;
  return cached;
}

export interface ConfiguratorManifest {
  readonly artifactId: string;
  readonly requestUrl: string;
  readonly modules: {
    readonly id: string;
    readonly label: string;
    readonly present: boolean;
    readonly spine: boolean;
    readonly domType?: string;
  }[];
}

/** Build the module manifest the client renders: present (anchored) vs sample. */
export function buildManifest(html: string, artifactId: string): ConfiguratorManifest {
  const present = new Set(detectPresentModules(html));
  return {
    artifactId,
    requestUrl: `/configure/${artifactId}/request`,
    modules: MODULE_CATALOG.map((m) => ({
      id: m.id,
      label: m.label,
      present: present.has(m.id),
      spine: !!m.spine,
      ...(m.domType ? { domType: m.domType } : {}),
    })),
  };
}

/**
 * Inject the prospect configurator (manifest + inline CSS/JS) before </body>.
 * Idempotent. The manifest is a JSON script tag the client runtime reads.
 */
export async function injectConfigurator(
  html: string,
  artifactId: string,
): Promise<string> {
  if (html.includes("data-cit-configurator")) return html; // already injected
  const manifest = buildManifest(html, artifactId);
  const manifestTag =
    `<script type="application/json" data-cit-configurator>` +
    JSON.stringify(manifest) +
    `</script>\n`;
  const block = manifestTag + (await configuratorBlock());
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + "\n" + block; // no </body> — append as a safe fallback
}

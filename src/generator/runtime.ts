// Runtime injector (UI-CONTRACT, ADR-0011). Generated mocks are standalone HTML
// (emailed / hosted / opened from file://), so the shared module runtime is
// INLINED into each document rather than linked — no external dependency, works
// everywhere. The generator emits only the theme tokens (:root) + module slots
// (data-cit-module); this helper injects the CSS + JS before </body>. Idempotent.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_DIR = path.resolve(HERE, "../../assets/runtime");

let cached: string | null = null;

async function runtimeBlock(): Promise<string> {
  if (cached) return cached;
  const css = await readFile(path.join(RUNTIME_DIR, "cit-modules.css"), "utf8");
  const js = await readFile(path.join(RUNTIME_DIR, "cit-runtime.js"), "utf8");
  cached = `<style data-cit-runtime>\n${css}\n</style>\n<script data-cit-runtime>\n${js}\n</script>\n`;
  return cached;
}

/** Inline the module runtime (CSS+JS) before </body>. No-op if already present. */
export async function injectRuntime(html: string): Promise<string> {
  if (html.includes("data-cit-runtime")) return html; // already injected
  const block = await runtimeBlock();
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`);
  return html + "\n" + block; // no </body> — append as a safe fallback
}

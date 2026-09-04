// Elek run report — ONE self-contained HTML file (owner decree, 2026-09-04:
// "mindenről kell proof hogy ment! printscreennel … egy html filbe").
// Embeds every step's screenshot (proof-of-work) plus the LELETEK.md findings
// with their referenced shots/crops inlined, as base64 JPEG (downscaled for
// phone viewing — these are report illustrations, not grounding inputs).
//
//   npx tsx elek/bin/report-html.mts <run-dir>   →  <run-dir>/JELENTES.html
//
// NOTE on colors: this artifact is a gitignored, standalone run report opened
// outside the app (no citui.css reachable) — not a product surface, so the
// design-token doctrine's surface chain does not apply to it.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const runDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!runDir || !existsSync(path.join(runDir, "result.jsonl"))) {
  console.error("használat: npx tsx elek/bin/report-html.mts <run-dir>  (result.jsonl kell)");
  process.exit(1);
}

interface StepRow {
  section: string;
  step: number;
  text: string;
  status: "pass" | "fail" | "manual" | "blocked";
  kezi?: string;
  checks: { expr: string; ok: boolean; detail?: string }[];
  console_errors: string[];
  http_errors: string[];
  dialogs: string[];
  shot: string | null;
  error?: string;
}

const rows: StepRow[] = readFileSync(path.join(runDir, "result.jsonl"), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as StepRow);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Downscaled inline JPEG — a phone-openable report, not an archive. */
async function embed(rel: string): Promise<string> {
  const f = path.join(runDir!, rel);
  if (!existsSync(f)) return `<p class="miss">[hiányzó kép: ${esc(rel)}]</p>`;
  const buf = await sharp(f).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 74 }).toBuffer();
  return `<figure><img src="data:image/jpeg;base64,${buf.toString("base64")}" alt="${esc(rel)}" loading="lazy"><figcaption>${esc(rel)}</figcaption></figure>`;
}

/** Finding headings (### H1 — …) for the top index list. */
function leletekIndex(md: string): { id: string; title: string }[] {
  return [...md.matchAll(/^###\s+(.*)$/gm)].map((m, i) => ({ id: `lelet-${i + 1}`, title: m[1] }));
}

/** Minimal markdown → HTML for LELETEK.md; every shots/…​.png / crops/…​.png reference becomes the inline image. */
async function renderLeletek(md: string): Promise<string> {
  const inline = async (s: string): Promise<string> => {
    let out = esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    const refs = [...new Set([...s.matchAll(/(?:shots|crops)\/[\w.-]+\.png/g)].map((m) => m[0]))];
    for (const r of refs) out += await embed(r);
    return out;
  };
  const parts: string[] = [];
  let leletNo = 0;
  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      // ### finding headings get stable anchors for the top index list.
      const id = h[1].length === 3 ? ` id="lelet-${++leletNo}"` : "";
      parts.push(`<h${h[1].length + 1}${id}>${await inline(h[2])}</h${h[1].length + 1}>`);
    } else if (/^\s*-\s+/.test(line)) {
      parts.push(`<div class="li">• ${await inline(line.replace(/^\s*-\s+/, ""))}</div>`);
    } else if (line.trim()) {
      parts.push(`<p>${await inline(line)}</p>`);
    }
  }
  return parts.join("\n");
}

const tally = { pass: 0, fail: 0, manual: 0, blocked: 0 };
for (const r of rows) tally[r.status]++;
const runName = path.basename(runDir);

const stepHtml: string[] = [];
let lastSection = "";
for (const r of rows) {
  if (r.section !== lastSection) {
    stepHtml.push(`<h2>${esc(r.section)}</h2>`);
    lastSection = r.section;
  }
  const checks = r.checks
    .map(
      (c) =>
        `<div class="chk ${c.ok ? "ok" : "bad"}">${c.ok ? "✔" : "✘"} <code>${esc(c.expr)}</code>${c.detail ? ` <span class="mut">(${esc(c.detail)})</span>` : ""}</div>`,
    )
    .join("");
  const errs = [
    ...r.console_errors.map((e) => `console: ${e}`),
    ...r.http_errors.map((e) => `http: ${e}`),
    ...r.dialogs.map((d) => `dialog: ${d}`),
    ...(r.error ? [`hiba: ${r.error}`] : []),
  ]
    .map((e) => `<div class="err">${esc(e)}</div>`)
    .join("");
  stepHtml.push(`
    <section class="step ${r.status}" id="step-${r.step}">
      <div class="head"><span class="badge ${r.status}">${r.status}</span> <b>${r.step}. ${esc(r.text)}</b></div>
      ${r.kezi ? `<div class="kezi">kézi: ${esc(r.kezi)}</div>` : ""}
      ${checks}${errs}
      ${r.shot ? await embed(r.shot) : `<p class="miss">[nincs shot]</p>`}
    </section>`);
}

const leletekPath = path.join(runDir, "LELETEK.md");
const leletekMd = existsSync(leletekPath) ? readFileSync(leletekPath, "utf8") : null;
const leletekHtml = leletekMd
  ? await renderLeletek(leletekMd)
  : "<p class='miss'>LELETEK.md még nincs (kiértékelés előtt generált jelentés).</p>";

// Top index — everything LISTED first (owner decree), jump links to the details.
const indexHtml = `
<h2>Tartalom</h2>
<div class="idx">
  <b>Leletek</b>
  ${(leletekMd ? leletekIndex(leletekMd) : [])
    .map((l) => `<div class="li"><a href="#${l.id}">${esc(l.title)}</a></div>`)
    .join("")}
  <b style="display:block;margin-top:8px">Lépések (proof)</b>
  ${rows
    .map(
      (r) =>
        `<div class="li"><span class="badge ${r.status}">${r.status}</span> <a href="#step-${r.step}">${r.step}. ${esc(r.text)}</a></div>`,
    )
    .join("")}
</div>`;

const html = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elek-jelentés · ${esc(runName)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#111417;color:#e8edf2;line-height:1.45}
  h1{font-size:20px}h2{font-size:17px;margin:26px 0 8px;border-bottom:1px solid #2a3138;padding-bottom:4px}
  h3{font-size:15px;margin:18px 0 6px}h4{font-size:14px;margin:14px 0 4px}
  .badge{display:inline-block;padding:1px 8px;border-radius:9px;font-size:12px;font-weight:700;text-transform:uppercase}
  .badge.pass{background:#123b24;color:#5ad48a}.badge.fail{background:#43181b;color:#ff8d95}
  .badge.manual{background:#3d3113;color:#ffce54}.badge.blocked{background:#333;color:#aaa}
  .step{border:1px solid #2a3138;border-radius:10px;padding:10px 12px;margin:10px 0}
  .step .head{margin-bottom:6px}
  .chk{font-size:13px;margin:2px 0}.chk.ok{color:#5ad48a}.chk.bad{color:#ff8d95}
  .err{font-size:13px;color:#ffce54;margin:2px 0}
  .kezi{font-size:13px;color:#9fb3c8;font-style:italic;margin:2px 0 6px}
  .mut{color:#8494a5}.miss{color:#ff8d95;font-size:13px}
  figure{margin:10px 0}figure img{max-width:100%;border:1px solid #2a3138;border-radius:8px}
  figcaption{font-size:12px;color:#8494a5;margin-top:2px}
  code{background:#1b2127;padding:1px 5px;border-radius:4px;font-size:12.5px}
  .li{margin:3px 0 3px 10px}
  .idx{border:1px solid #2a3138;border-radius:10px;padding:10px 12px;margin:10px 0}
  .idx a{color:#7ec3ff;text-decoration:none}.idx .badge{font-size:10px;padding:0 6px}
  .tally{margin:6px 0 2px}.tally .badge{margin-right:6px}
</style></head><body>
<h1>Elek-jelentés — ${esc(runName)}</h1>
<div class="tally">
  <span class="badge pass">pass ${tally.pass}</span>
  <span class="badge fail">fail ${tally.fail}</span>
  <span class="badge manual">manual ${tally.manual}</span>
  <span class="badge blocked">blocked ${tally.blocked}</span>
</div>
${indexHtml}
<h2>Leletek (Elek kiértékelése)</h2>
${leletekHtml}
<h2 style="margin-top:34px">Proof — minden lépés, képpel</h2>
${stepHtml.join("\n")}
</body></html>`;

const out = path.join(runDir, "JELENTES.html");
writeFileSync(out, html);
console.log(`${out} · ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB`);

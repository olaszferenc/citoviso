// Operator console — server-rendered HTML (hand-rolled template literals, the
// same approach as the mock render.ts). No framework, no emoji icons (design
// doctrine). Every dynamic value goes through esc().

import type {
  ConversionView,
  LeadDetail,
  LeadListRow,
  LeadQuery,
  TenantAdminView,
} from "./data.js";

// Module catalog (05-MODULES.md) offered at conversion. Single-sourced in
// ../modules.js so the operator convert form and the prospect configurator
// never drift on module ids (they feed module_entitlement).
export { MODULE_CATALOG } from "../modules.js";
import { MODULE_CATALOG } from "../modules.js";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
  :root { --bg:#0f1115; --panel:#171a21; --line:#252a34; --fg:#e6e9ef; --mut:#9aa4b2;
          --acc:#4c9aff; --ok:#3fb950; --bad:#f85149; --warn:#d29922; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  a { color:var(--acc); text-decoration:none; } a:hover { text-decoration:underline; }
  header { padding:16px 24px; border-bottom:1px solid var(--line); display:flex; gap:16px; align-items:baseline; }
  header h1 { font-size:17px; margin:0; letter-spacing:.02em; }
  header .mut { color:var(--mut); font-size:13px; }
  main { padding:24px; max-width:1100px; margin:0 auto; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--mut); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  tr:hover td { background:var(--panel); }
  .pill { display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); color:var(--mut); }
  .pill.no_site { color:var(--ok); border-color:var(--ok); }
  .pill.outdated { color:var(--warn); border-color:var(--warn); }
  .pill.approved { color:var(--ok); border-color:var(--ok); }
  .pill.rejected { color:var(--bad); border-color:var(--bad); }
  .pill.generated { color:var(--acc); border-color:var(--acc); }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px 18px; margin:0 0 18px; }
  .panel h2 { font-size:14px; margin:0 0 12px; color:var(--mut); text-transform:uppercase; letter-spacing:.04em; }
  .kv { display:grid; grid-template-columns:160px 1fr; gap:4px 16px; }
  .kv dt { color:var(--mut); } .kv dd { margin:0; }
  form { display:inline; }
  button { font:inherit; padding:7px 14px; border-radius:8px; border:1px solid var(--line);
           background:#20252f; color:var(--fg); cursor:pointer; }
  button:hover { border-color:var(--acc); }
  button.ok { border-color:var(--ok); color:var(--ok); }
  button.bad { border-color:var(--bad); color:var(--bad); }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px; }
  .mut { color:var(--mut); } .small { font-size:13px; }
  code { background:#0b0d11; padding:1px 5px; border-radius:4px; }
  th a{color:var(--mut);text-decoration:none} th a:hover{color:var(--fg)}
  td.num{font-variant-numeric:tabular-nums;font-size:15px}
  .q-good{color:var(--ok);font-weight:700} .q-mid{color:var(--warn);font-weight:700} .q-bad{color:var(--bad);font-weight:700}
  .sv{font-size:10px;color:var(--mut);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:5px;vertical-align:middle}
  .filters{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:16px}
  .filters label{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em;display:flex;flex-direction:column;gap:4px}
  .filters select,.filters input{background:#20252f;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font:inherit}
`;

export function layout(title: string, body: string): string {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Citoviso konzol</title><style>${CSS}</style></head>
<body><header><h1>Citoviso · operátor-konzol</h1>
<span class="mut">lead-pipeline &amp; kuráció (pilot)</span>
<span class="mut" style="margin-left:auto"><a href="/">leadek</a></span></header>
<main>${body}</main></body></html>`;
}

function confCell(c: number | null): string {
  if (c == null) return `<span class="mut">–</span>`;
  return c.toFixed(2);
}

/** Build a query string from the current query with overrides applied. */
function qs(q: LeadQuery, over: Record<string, string | number | undefined>): string {
  const merged: Record<string, unknown> = { ...q, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "/";
}

/** Sortable header link (toggles asc/desc; arrow shows current sort). */
function sortHead(label: string, key: string, q: LeadQuery): string {
  const active = q.sort === key;
  const nextDir = active && q.dir !== "asc" ? "asc" : "desc";
  const arrow = active ? (q.dir === "asc" ? " ↑" : " ↓") : "";
  return `<a href="${qs(q, { sort: key, dir: nextDir })}">${esc(label)}${arrow}</a>`;
}

function photoCell(n: number, sv: boolean): string {
  const cls = n >= 3 ? "q-good" : n >= 1 ? "q-mid" : "q-bad";
  return `<span class="${cls}">${n}</span>${sv ? `<span class="sv">SV</span>` : ""}`;
}

function contactCell(c: string): string {
  const cls = c === "email" ? "q-good" : c === "none" ? "q-bad" : "q-mid";
  return `<span class="${cls}">${esc(c)}</span>`;
}

function sel(
  name: string,
  current: string | undefined,
  opts: [string, string][],
): string {
  return `<select name="${name}">${opts
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}"${(current ?? "") === v ? " selected" : ""}>${esc(l)}</option>`,
    )
    .join("")}</select>`;
}

export function leadsPage(rows: LeadListRow[], q: LeadQuery = {}): string {
  const filters = `<form method="get" class="filters">
    ${q.sort ? `<input type="hidden" name="sort" value="${esc(q.sort)}">` : ""}
    ${q.dir ? `<input type="hidden" name="dir" value="${esc(q.dir)}">` : ""}
    <label>Kvalifikáció ${sel("qualification", q.qualification, [["", "mind"], ["no_site", "no_site"], ["outdated", "outdated"], ["modern", "modern"], ["unknown", "unknown"]])}</label>
    <label>Kontakt ${sel("contact", q.contact, [["", "mind"], ["email", "email"], ["sms", "sms"], ["voice", "voice"], ["none", "none"]])}</label>
    <label>Mock ${sel("mock", q.mock, [["", "mind"], ["none", "nincs"], ["generated", "generated"], ["approved", "approved"], ["rejected", "rejected"]])}</label>
    <label>Min. fotó <input type="number" name="minPhotos" min="0" style="width:74px" value="${q.minPhotos ?? ""}"></label>
    <label>&nbsp;<button type="submit">Szűrés</button></label>
    <label>&nbsp;<a class="small" href="/">Törlés</a></label>
  </form>`;

  const head = `<thead><tr>
    <th>${sortHead("Név", "name", q)}</th>
    <th>Régió</th>
    <th>${sortHead("Kvalifikáció", "qualification", q)}</th>
    <th>${sortHead("Fotók", "photos", q)}</th>
    <th>${sortHead("Anyag", "material", q)}</th>
    <th>${sortHead("Match", "match", q)}</th>
    <th>${sortHead("Kontakt", "contact", q)}</th>
    <th>${sortHead("Mock", "mock", q)}</th>
  </tr></thead>`;

  const bodyRows = rows.length
    ? rows
        .map(
          (r) => `<tr>
        <td><a href="/lead/${esc(r.id)}">${esc(r.name)}</a></td>
        <td class="small mut">${esc(r.region)}</td>
        <td>${r.qualification ? `<span class="pill ${esc(r.qualification)}">${esc(r.qualification)}</span>` : `<span class="mut">–</span>`}</td>
        <td class="num">${photoCell(r.photos, r.streetView)}</td>
        <td class="num mut">${r.material || "–"}</td>
        <td class="num">${confCell(r.matchConfidence)}</td>
        <td class="small">${contactCell(r.contact)}</td>
        <td>${
          r.latestArtifact
            ? `<span class="pill ${esc(r.latestArtifact.status)}">${esc(r.latestArtifact.status)}</span>`
            : `<span class="mut small">nincs</span>`
        }</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="8" class="mut" style="padding:24px">Nincs a szűrőnek megfelelő lead. <a href="/">Szűrők törlése</a></td></tr>`;

  const body = `<div class="panel"><h2>Leadek (${rows.length})</h2>
    ${filters}
    <table>${head}<tbody>${bodyRows}</tbody></table></div>`;
  return layout("Leadek", body);
}

/** Converted-state block for the approved artifact this site came from. */
function convertedBlock(c: ConversionView): string {
  const mods = c.modules.length
    ? c.modules.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")
    : `<span class="mut small">nincs aktív modul</span>`;
  return `<div class="row" style="margin-top:10px">
      <span class="pill approved">${esc(c.siteStatus)}</span>
      <a class="small" href="${esc(c.previewUrl)}" target="_blank">privát előnézet ▸</a>
      <a class="small" href="${esc(c.adminUrl)}" target="_blank">tenant-admin ▸</a>
    </div>
    <div class="row" style="margin-top:8px">${mods}</div>
    <div class="mut small" style="margin-top:6px">Provisioned privát előnézet — a nyilvános élesítés fizetés-kapus, ház-oldali (A2).</div>`;
}

/** Convert form (module checkboxes) for an approved, not-yet-converted artifact. */
function convertForm(leadId: string, artifactId: string): string {
  const boxes = MODULE_CATALOG.map(
    (m) =>
      `<label class="small" style="display:inline-flex;gap:6px;align-items:center;margin:2px 10px 2px 0">
        <input type="checkbox" name="module" value="${esc(m.id)}"${m.spine ? " checked" : ""}>
        ${esc(m.label)}</label>`,
  ).join("");
  return `<form method="post" action="/lead/${esc(leadId)}/convert" style="margin-top:10px">
      <input type="hidden" name="artifactId" value="${esc(artifactId)}">
      <div class="mut small" style="margin-bottom:6px">Megrendelt modulok:</div>
      <div style="margin-bottom:8px">${boxes}</div>
      <button class="ok" type="submit">Konvertálás privát előnézetbe ▸</button>
    </form>`;
}

export function leadPage(
  d: LeadDetail,
  generating = false,
  conversion: ConversionView | null = null,
): string {
  const prov = d.provenance.length
    ? `<table><thead><tr><th>Mező</th><th>Érték</th><th>Forrás</th><th>Konf.</th></tr></thead>
       <tbody>${d.provenance
         .map(
           (p) => `<tr><td>${esc(p.field)}</td><td class="small">${esc(p.value)}</td>
           <td class="small mut">${esc(p.source)}</td><td>${confCell(p.confidence)}</td></tr>`,
         )
         .join("")}</tbody></table>`
    : `<p class="mut small">Nincs provenance-rekord.</p>`;

  const artifacts = d.artifacts.length
    ? d.artifacts
        .map((a) => {
          const dec = a.decisions[0];
          const curated = a.status === "approved" || a.status === "rejected";
          const inputs = Object.entries(a.inputs)
            .map(([k, v]) => `${esc(k)}=${esc(v)}`)
            .join(" · ");
          return `<div class="panel">
            <div class="row">
              <span class="pill ${esc(a.status)}">${esc(a.status)}</span>
              <span class="mut small">${esc(a.generatedAt.slice(0, 16).replace("T", " "))}</span>
              ${a.path ? `<a class="small" href="/mock/${esc(a.id)}" target="_blank">előnézet ▸</a>` : ""}
              ${a.path ? `<a class="small" href="/configure/${esc(a.id)}" target="_blank">prospect-konfigurátor ▸</a>` : ""}
            </div>
            <div class="small mut" style="margin-top:8px">${inputs}</div>
            ${
              dec
                ? `<div class="small" style="margin-top:8px">Döntés: <b>${esc(dec.decision)}</b>
                   ${dec.notes ? `— ${esc(dec.notes)}` : ""}
                   <span class="mut">(${esc(dec.decidedBy)}, ${esc(dec.decidedAt.slice(0, 16).replace("T", " "))})</span></div>`
                : ""
            }
            ${
              curated
                ? ""
                : `<div class="row">
                   <form method="post" action="/artifact/${esc(a.id)}/curate">
                     <input type="hidden" name="decision" value="approve">
                     <button class="ok" type="submit">Jóváhagyás</button></form>
                   <form method="post" action="/artifact/${esc(a.id)}/curate">
                     <input type="hidden" name="decision" value="reject">
                     <button class="bad" type="submit">Elutasítás</button></form>
                 </div>`
            }
            ${
              a.status === "approved"
                ? conversion && conversion.sourceArtifactId === a.id
                  ? convertedBlock(conversion)
                  : convertForm(d.id, a.id)
                : ""
            }
          </div>`;
        })
        .join("")
    : `<div class="panel"><p class="mut">Még nincs generált mock ehhez a leadhez.</p></div>`;

  const body = `
    <div class="panel">
      <h2>Lead</h2>
      <div class="row" style="margin-top:0">
        <b style="font-size:18px">${esc(d.name)}</b>
        ${d.qualification ? `<span class="pill ${esc(d.qualification)}">${esc(d.qualification)}</span>` : ""}
      </div>
      <dl class="kv" style="margin-top:12px">
        <dt>Régió</dt><dd>${esc(d.region)}</dd>
        <dt>Cím</dt><dd>${esc(d.address) || `<span class="mut">–</span>`}</dd>
        <dt>Match-konfidencia</dt><dd>${confCell(d.matchConfidence)}</dd>
      </dl>
      ${
        generating
          ? `<div class="row"><span class="pill generated">generálás folyamatban…</span>
             <span class="mut small">~1-2 perc — az oldal automatikusan frissül</span></div>
             <script>setTimeout(function(){location.reload()},6000)</script>`
          : `<div class="row">
             <form method="post" action="/lead/${esc(d.id)}/generate"
                   onsubmit="var b=this.querySelector('button');b.disabled=true;b.textContent='Indítás…'">
               <button type="submit">Mock ${d.artifacts.length ? "újragenerálása" : "generálása"}</button>
             </form>
           </div>`
      }
    </div>
    <div class="panel"><h2>Mock-artefaktumok</h2></div>
    ${artifacts}
    <div class="panel"><h2>Provenance (A4)</h2>${prov}</div>`;
  return layout(d.name, body);
}

/** Read-only tenant self-service view (pilot: content edit stays house-side, A2). */
export function tenantAdminPage(v: TenantAdminView): string {
  const mods = v.modules.length
    ? v.modules.map((m) => `<span class="pill">${esc(m)}</span>`).join(" ")
    : `<span class="mut small">nincs aktív modul</span>`;
  const body = `
    <div class="panel">
      <h2>${esc(v.displayName)} — oldal-kezelő</h2>
      <div class="row" style="margin-top:0">
        <span class="pill approved">${esc(v.siteStatus)}</span>
        <a class="small" href="/site/${esc(v.previewToken)}" target="_blank">privát előnézet ▸</a>
      </div>
      <h3 class="mut small" style="margin-top:18px">Megvett modulok</h3>
      <div class="row">${mods}</div>
      <p class="mut small" style="margin-top:18px">Read-only pilot-nézet. A tartalom/kép szerkesztése és a
      nyilvános élesítés (fizetés-kapus) egyelőre ház-oldali, kézi lépés (A2).</p>
    </div>`;
  return layout(`${v.displayName} — kezelő`, body);
}

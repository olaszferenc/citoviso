// Operator console — server-rendered HTML (hand-rolled template literals, the
// same approach as the mock render.ts). No framework, no emoji icons (design
// doctrine). Every dynamic value goes through esc().

import type { LeadDetail, LeadListRow } from "./data.js";

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

export function leadsPage(rows: LeadListRow[]): string {
  if (!rows.length) {
    return layout(
      "Leadek",
      `<div class="panel"><p class="mut">Nincs lead a DB-ben. Futtasd a scrapert:
       <code>npm run scrape -- badacsony</code></p></div>`,
    );
  }
  const body = `<div class="panel"><h2>Leadek (${rows.length})</h2>
    <table><thead><tr><th>Név</th><th>Régió</th><th>Kvalifikáció</th>
      <th>Match</th><th>Mock</th></tr></thead><tbody>
    ${rows
      .map(
        (r) => `<tr>
        <td><a href="/lead/${esc(r.id)}">${esc(r.name)}</a></td>
        <td class="small mut">${esc(r.region)}</td>
        <td>${r.qualification ? `<span class="pill ${esc(r.qualification)}">${esc(r.qualification)}</span>` : `<span class="mut">–</span>`}</td>
        <td>${confCell(r.matchConfidence)}</td>
        <td>${
          r.latestArtifact
            ? `<span class="pill ${esc(r.latestArtifact.status)}">${esc(r.latestArtifact.status)}</span>`
            : `<span class="mut small">nincs</span>`
        }</td></tr>`,
      )
      .join("")}
    </tbody></table></div>`;
  return layout("Leadek", body);
}

export function leadPage(d: LeadDetail): string {
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
      <div class="row">
        <form method="post" action="/lead/${esc(d.id)}/generate">
          <button type="submit">Mock ${d.artifacts.length ? "újragenerálása" : "generálása"}</button>
        </form>
      </div>
    </div>
    <div class="panel"><h2>Mock-artefaktumok</h2></div>
    ${artifacts}
    <div class="panel"><h2>Provenance (A4)</h2>${prov}</div>`;
  return layout(d.name, body);
}

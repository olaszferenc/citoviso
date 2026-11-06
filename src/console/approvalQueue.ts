// Owner approval page for the new single-pass chain (owner 2026-11-06): every lead the
// single-pass checker let through (MEHET) waits HELD with the PENDING note until the owner
// looks at the whole site and says yes or no. Left: the waiting list. Right: the full site
// of the selected lead (both plans, desktop or phone width), scaled to fit. "Mehet" puts the
// row back on the dispatch queue, "Nem" cancels it; either way the next lead opens.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { esc, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";

/** The dispatch note the single-pass chain writes on a lead waiting for the owner. */
export const APPROVAL_PENDING_NOTE = "JÓVÁHAGYÁSRA VÁR (egylépéses átnéző: MEHET)";
const APPROVED_NOTE = "tulaj jóváhagyta (jóváhagyó lap)";
const REJECTED_NOTE = "tulaj: nem mehet ki (jóváhagyó lap)";

export type PendingApproval = {
  readonly leadId: string;
  readonly name: string;
  readonly city: string;
  readonly qualification: string;
  readonly phone: string;
  readonly email: string;
  readonly mainId: string;
  readonly altId: string | null;
  readonly reason: string;
  readonly queuedAt: Date;
};

export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const rows = await sql<{
    lead_id: string;
    name: string;
    city: string | null;
    qualification: string;
    phone: string | null;
    email: string | null;
    main_id: string;
    alt_id: string | null;
    reason: string | null;
    queued_at: Date;
  }>`
    select d.lead_id, l.name, l.raw->>'city' as city, l.qualification,
           l.raw->>'phone' as phone, l.raw->>'email' as email,
           d.artifact_id as main_id,
           (select m.id from mock_artifact m
             where m.lead_id = d.lead_id and m.id <> d.artifact_id and m.status <> 'rejected'
               and m.inputs->'review'->>'verdict' = 'pass'
             order by m.generated_at desc limit 1) as alt_id,
           (select m.inputs->'review'->>'note' from mock_artifact m where m.id = d.artifact_id) as reason,
           d.queued_at
      from outreach_dispatch d
      join lead l on l.id = d.lead_id
     where d.status = 'held' and d.note = ${APPROVAL_PENDING_NOTE}
     order by (l.qualification = 'no_site') desc, d.queued_at asc`.execute(db);
  return rows.rows.map((r) => ({
    leadId: r.lead_id,
    name: r.name,
    city: r.city ?? "",
    qualification: r.qualification,
    phone: r.phone ?? "",
    email: r.email ?? "",
    mainId: r.main_id,
    altId: r.alt_id,
    reason: (r.reason ?? "").replace(/^MEHET \(egylépéses\):\s*/, ""),
    queuedAt: r.queued_at,
  }));
}

/** Records the owner's yes/no. Only a row still waiting is touched; returns whether it was. */
export async function decideApproval(leadId: string, approve: boolean, by: string): Promise<boolean> {
  const r = await db
    .updateTable("outreach_dispatch")
    .set({ status: approve ? "queued" : "cancelled", note: `${approve ? APPROVED_NOTE : REJECTED_NOTE} · ${by}` })
    .where("lead_id", "=", leadId)
    .where("status", "=", "held")
    .where("note", "=", APPROVAL_PENDING_NOTE)
    .executeTakeFirst();
  return Number(r.numUpdatedRows ?? 0) > 0;
}

const CSS = `<style>
.aq{display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start}
.aq-list{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);max-height:calc(100vh - 140px);overflow:auto}
.aq-list a{display:block;padding:10px 14px;border-bottom:1px solid var(--citui-line);color:inherit;text-decoration:none}
.aq-list a:hover{background:var(--citui-surface-2)}
.aq-list a.on{background:color-mix(in srgb,var(--citui-cyan-500) 10%,var(--citui-white));box-shadow:inset 3px 0 0 var(--citui-cyan-500)}
.aq-list b{display:block;font-size:.9rem}
.aq-list small{color:var(--citui-muted);font-size:.76rem}
.aq-cnt{font-size:.8rem;color:var(--citui-muted);padding:10px 14px;border-bottom:1px solid var(--citui-line)}
.aq-main{min-width:0}
.aq-head{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:12px 14px;margin-bottom:10px}
.aq-head h2{margin:0 0 4px;font-size:1.1rem}
.aq-meta{font-size:.84rem;color:var(--citui-muted);line-height:1.5}
.aq-why{font-size:.82rem;margin-top:6px;line-height:1.45}
.aq-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}
.aq-act form{margin:0}
.aq-btn{font:inherit;font-weight:700;font-size:.95rem;border:0;border-radius:var(--citui-radius-sm);padding:10px 22px;cursor:pointer}
.aq-yes{background:var(--citui-ok-ink);color:var(--citui-white)}
.aq-no{background:var(--citui-surface-2);color:var(--citui-ink);border:1px solid var(--citui-line-strong)}
.aq-tabs{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}
.aq-tabs button{font:inherit;font-size:.82rem;border:1px solid var(--citui-line-strong);background:var(--citui-white);border-radius:var(--citui-radius-pill);padding:5px 12px;cursor:pointer}
.aq-tabs button.on{background:var(--citui-ink);color:var(--citui-white);border-color:var(--citui-ink)}
.aq-tabs .sep{width:10px}
.aq-view{background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);overflow:auto;max-height:calc(100vh - 290px)}
.aq-box{position:relative;overflow:hidden;margin:0 auto}
.aq-box iframe{border:0;transform-origin:0 0;background:var(--citui-white);display:block}
.aq-empty{padding:40px;text-align:center;color:var(--citui-muted)}
@media (max-width:900px){.aq{grid-template-columns:1fr}.aq-list{max-height:220px}}
</style>`;

const SCRIPT = `<script>
(function(){
  var view=document.querySelector('.aq-view'); if(!view) return;
  var box=view.querySelector('.aq-box'), fr=box.querySelector('iframe');
  var w=1280, plan=fr.getAttribute('data-main');
  function fit(){
    var s=Math.min(1,(view.clientWidth-2)/w);
    var h=1200;
    try{ h=Math.max(fr.contentDocument.documentElement.scrollHeight, fr.contentDocument.body.scrollHeight); }catch(e){}
    fr.style.width=w+'px'; fr.style.height=h+'px'; fr.style.transform='scale('+s+')';
    box.style.width=(w*s)+'px'; box.style.height=(h*s)+'px';
  }
  fr.addEventListener('load',function(){ fit(); setTimeout(fit,1500); setTimeout(fit,4000); });
  window.addEventListener('resize',fit);
  document.querySelectorAll('.aq-tabs button').forEach(function(b){
    b.addEventListener('click',function(){
      var g=b.getAttribute('data-g');
      document.querySelectorAll('.aq-tabs button[data-g="'+g+'"]').forEach(function(x){x.classList.remove('on');});
      b.classList.add('on');
      if(g==='plan'){ plan=b.getAttribute('data-id'); fr.src='/mock/'+plan; }
      else { w=Number(b.getAttribute('data-w')); fr.style.width=w+'px'; fit(); fr.src='/mock/'+plan; }
    });
  });
})();
</script>`;

export function approvalPage(items: readonly PendingApproval[], selected: string | null, flash: string): string {
  const lang = consoleLang();
  const cur = items.find((i) => i.leadId === selected) ?? items[0] ?? null;
  const list = items
    .map(
      (i) =>
        `<a href="/jovahagyas?lead=${esc(i.leadId)}"${cur && i.leadId === cur.leadId ? ' class="on"' : ""}><b>${esc(i.name)}</b><small>${esc(i.city)} · ${esc(i.qualification === "no_site" ? T(lang, "nincs honlap") : T(lang, "elavult honlap"))}</small></a>`,
    )
    .join("");
  const left = `<nav class="aq-list"><div class="aq-cnt">${esc(T(lang, "Jóváhagyásra vár"))}: ${items.length}</div>${list}</nav>`;
  if (!cur) {
    return layout(
      T(lang, "Jóváhagyás"),
      `${CSS}${flash ? `<p class="aq-meta">${esc(flash)}</p>` : ""}<div class="aq">${left}<div class="aq-main"><div class="aq-empty">${esc(T(lang, "Nincs jóváhagyásra váró megkeresés."))}</div></div></div>`,
    );
  }
  const contact = [cur.phone, cur.email].filter(Boolean).map(esc).join(" · ") || esc(T(lang, "nincs kontakt"));
  const tabs =
    `<div class="aq-tabs"><button type="button" class="on" data-g="plan" data-id="${esc(cur.mainId)}">${esc(T(lang, "1. terv"))}</button>` +
    (cur.altId ? `<button type="button" data-g="plan" data-id="${esc(cur.altId)}">${esc(T(lang, "2. terv"))}</button>` : "") +
    `<span class="sep"></span><button type="button" class="on" data-g="w" data-w="1280">${esc(T(lang, "Asztali"))}</button>` +
    `<button type="button" data-g="w" data-w="390">${esc(T(lang, "Mobil"))}</button></div>`;
  const form = (approve: boolean) =>
    `<form method="post" action="/jovahagyas/${esc(cur.leadId)}"><input type="hidden" name="d" value="${approve ? "mehet" : "nem"}"><button class="aq-btn ${approve ? "aq-yes" : "aq-no"}">${esc(approve ? T(lang, "Mehet") : T(lang, "Nem mehet ki"))}</button></form>`;
  const head =
    `<div class="aq-head"><h2>${esc(cur.name)}</h2>` +
    `<div class="aq-meta">${esc(cur.city)} · ${esc(T(lang, "Címzett"))}: ${contact} · <a href="/lead/${esc(cur.leadId)}" target="_blank" rel="noopener">${esc(T(lang, "lead lapja"))}</a></div>` +
    (cur.reason ? `<div class="aq-why">${esc(T(lang, "Átnéző"))}: ${esc(cur.reason)}</div>` : "") +
    `<div class="aq-act">${form(true)}${form(false)}</div></div>`;
  const right =
    `<div class="aq-main">${head}${tabs}<div class="aq-view"><div class="aq-box"><iframe src="/mock/${esc(cur.mainId)}" data-main="${esc(cur.mainId)}" title="${esc(cur.name)}"></iframe></div></div></div>`;
  return layout(
    T(lang, "Jóváhagyás"),
    `${CSS}${flash ? `<p class="aq-meta">${esc(flash)}</p>` : ""}<div class="aq">${left}${right}</div>${SCRIPT}`,
  );
}

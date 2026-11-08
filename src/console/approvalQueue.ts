// Owner approval page for the new single-pass chain (owner 2026-11-06): every lead the
// single-pass checker let through (MEHET) waits HELD with the PENDING note until the owner
// looks at the whole site and says yes or no. Left: the waiting list. Right: the full site
// of the selected lead (both plans, desktop or phone width), scaled to fit. "Mehet" puts the
// row back on the dispatch queue, "Nem" cancels it; either way the next lead opens.

import { sql } from "kysely";
import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";
import { esc, helpLink, layout } from "./views.js";
import { T } from "../i18n/mail.js";
import { consoleLang } from "./i18nCtx.js";
import { ic } from "../ui/icons.js";
import { isHuMobileE164, normalizePhone } from "../text/phone.js";
import {
  expectedChannel,
  getMessengerConfig,
  presenceOf,
  NOT_SEEN_AFTER_DAYS,
  type ChannelPlan,
  type MessengerConfig,
  type NotSeenItem,
  type Presence,
} from "../mms/messenger.js";

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
  /**
   * ADR-0430 (approved plan design-refs/console/messenger-felulet): where the first outreach
   * would go — from the phone's presence read (no message sent) and the switch / brake.
   * A lead with no Hungarian mobile number goes by e-mail only.
   */
  readonly channel: ChannelPlan | { readonly channel: "email"; readonly step: 0; readonly reason: string };
  /** The Hungarian mobile number (E.164) and the phone's presence read of it (null = not checked yet). */
  readonly mobile: string | null;
  readonly presence: Presence | null;
};

/** The list's channel groups, in the plan's order. */
export type ApprovalGroup = "viber" | "whatsapp" | "mms" | "email" | "check";
export const APPROVAL_GROUPS: readonly ApprovalGroup[] = ["viber", "whatsapp", "mms", "email", "check"];

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
  const mobile = (raw: string | null): string | null => {
    const e = raw ? normalizePhone(raw) : null;
    return e && isHuMobileE164(e) ? e : null;
  };
  const cfg = await getMessengerConfig();
  const presence = await presenceOf(rows.rows.map((r) => mobile(r.phone)).filter((p): p is string => !!p));
  const lang = consoleLang();
  return rows.rows.map((r) => {
    const m = mobile(r.phone);
    return {
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
      mobile: m,
      presence: m ? (presence.get(m) ?? null) : null,
      channel: m
        ? expectedChannel(presence.get(m) ?? null, cfg)
        : { channel: "email" as const, step: 0 as const, reason: T(lang, "nincs magyar mobilszám — csak e-mail megy") },
    };
  });
}

// Full-page picture of a mock (the right pane): rendered on this server with the same
// Chromium the hero shots use, one at a time, cached per mock file version and width.
const SHOT_DIR = path.resolve(process.cwd(), "sites/_approval-shots");
let shotChain: Promise<unknown> = Promise.resolve();
const shotInFlight = new Map<string, Promise<string | null>>();

async function renderFullShot(artifactId: string, width: number): Promise<string | null> {
  const a = await db.selectFrom("mock_artifact").select("path").where("id", "=", artifactId).executeTakeFirst();
  if (!a?.path) return null;
  const mockAbs = path.resolve(process.cwd(), a.path);
  const mtime = Math.floor((await stat(mockAbs)).mtimeMs / 1000);
  const dest = path.join(SHOT_DIR, `${artifactId}-${width}-${mtime}.jpg`);
  try {
    await access(dest);
    return dest;
  } catch {
    // not cached yet
  }
  await mkdir(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, userAgent: PORTAL_USER_AGENT });
    await page.goto(`file://${mockAbs}`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => undefined);
    // Scroll through once so lazy images and reveal-on-scroll sections render.
    await page.evaluate(async () => {
      const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: dest, fullPage: true, type: "jpeg", quality: 70 });
    return dest;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** The cached (or freshly rendered) full-page JPEG of a mock; serialised, never two Chromiums. */
export function approvalShot(artifactId: string, width: number): Promise<string | null> {
  const key = `${artifactId}-${width}`;
  const running = shotInFlight.get(key);
  if (running) return running;
  const p = shotChain.then(() => renderFullShot(artifactId, width)).catch(() => null);
  shotChain = p;
  shotInFlight.set(key, p);
  void p.finally(() => shotInFlight.delete(key));
  return p;
}

/** Warm the pictures of the waiting list in order (desktop width, both plans). */
export function warmApprovalShots(items: readonly PendingApproval[]): void {
  for (const i of items.slice(0, 12)) {
    void approvalShot(i.mainId, 1280);
    if (i.altId) void approvalShot(i.altId, 1280);
  }
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

// ── The page (approved plan design-refs/console/messenger-felulet, owner 2026-11-08) ──
// Full width on purpose (owner: „jobban látszódjon a jóváhagyandó oldal … túl sok a kihasználatlan
// oldalsó rész”): the console's 1600 px content ceiling does not apply here, the left list stays
// narrow and the preview takes the rest of the width and most of the screen height.
const CSS = `<style>
body:has(.aq-page) .con-main__in{max-width:none}
.aq-page{container-type:inline-size}
.aq-tabbar{display:flex;gap:4px;border-bottom:1px solid var(--citui-line);margin:0 0 8px;flex-wrap:wrap}
.aq-tabbar a{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;color:var(--citui-muted);text-decoration:none;font-weight:600;font-size:.92rem;border-bottom:3px solid transparent;margin-bottom:-1px}
.aq-tabbar a.on{color:var(--citui-ink);border-bottom-color:var(--citui-cyan-500)}
.aq-help{margin-left:auto;align-self:center}
.aq-tabbar .n{font-size:.76rem;font-weight:700;padding:1px 8px;border-radius:var(--citui-radius-pill);background:var(--citui-surface-2);color:var(--citui-ink)}
.aq-tabbar .n.warn{background:color-mix(in srgb,var(--citui-warn) 35%,var(--citui-white));color:var(--citui-warn-ink)}
.aq-intro{font-size:.84rem;color:var(--citui-muted);margin:0 0 8px;line-height:1.45}
.aq-state{display:flex;gap:8px;align-items:center;font-size:.84rem;background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:6px 10px;margin:0 0 10px}
.aq-state .dot{width:9px;height:9px;border-radius:50%;background:var(--citui-ok-ink);flex:none}
.aq-state.off .dot{background:var(--citui-bad-ink)}
.aq-state a{margin-left:auto}
.aq{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px;align-items:start}
.aq-list{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);max-height:calc(100vh - 150px);overflow:auto;position:sticky;top:10px}
.aq-list a{display:block;padding:9px 12px;border-bottom:1px solid var(--citui-line);color:inherit;text-decoration:none}
.aq-list a:hover{background:var(--citui-surface-2)}
.aq-list a.on{background:color-mix(in srgb,var(--citui-cyan-500) 10%,var(--citui-white));box-shadow:inset 3px 0 0 var(--citui-cyan-500)}
.aq-list b{display:block;font-size:.9rem}
.aq-list small{color:var(--citui-muted);font-size:.76rem}
.aq-list a .aq-row{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.aq-cnt{font-size:.8rem;color:var(--citui-muted);padding:9px 12px;border-bottom:1px solid var(--citui-line)}
.aq-filt{padding:8px 12px;border-bottom:1px solid var(--citui-line)}
.aq-filt input{width:100%;box-sizing:border-box;font:inherit;font-size:.84rem;padding:6px 10px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-pill);background:var(--citui-field);color:var(--citui-ink)}
.aq-filt h4{font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--citui-muted);margin:8px 0 4px}
.aq-chips{display:flex;gap:4px;flex-wrap:wrap}
.aq .aq-chips button{font:inherit;font-size:.76rem;border:1px solid var(--citui-line-strong);background:var(--citui-white);color:var(--citui-ink);border-radius:var(--citui-radius-pill);padding:3px 9px;cursor:pointer}
.aq .aq-chips button.on{background:var(--citui-ink);color:var(--citui-white);border-color:var(--citui-ink)}
.aq .aq-chips button:disabled{opacity:.45;cursor:default}
.aq .aq-clear{font:inherit;font-size:.76rem;margin-top:8px;border:0;background:none;color:var(--citui-cyan-500);cursor:pointer;padding:0;text-decoration:underline}
.aq-grp{display:flex;align-items:center;gap:6px;justify-content:space-between;padding:6px 12px;background:var(--citui-surface-2);border-bottom:1px solid var(--citui-line);font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--citui-muted)}
.aq-grp span{display:inline-flex;gap:6px;align-items:center}
.aq-grp small{text-transform:none;letter-spacing:0;font-weight:400}
.aq-none{padding:14px 12px;font-size:.84rem;color:var(--citui-muted)}
.aq-main{min-width:0}
.aq-head{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:10px 14px;margin-bottom:10px}
.aq-head h2{margin:0 0 2px;font-size:1.1rem}
.aq-meta{font-size:.84rem;color:var(--citui-muted);line-height:1.5}
.aq-why{font-size:.82rem;margin-top:4px;line-height:1.45}
.aq-ladder{margin-top:8px;border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:8px 10px;background:color-mix(in srgb,var(--citui-cyan-500) 4%,var(--citui-white))}
.aq-ladder p{margin:0 0 6px;font-size:.86rem}
.aq-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);overflow:hidden;background:var(--citui-white)}
.aq-steps div{padding:5px 9px;font-size:.78rem;color:var(--citui-muted);border-left:1px solid var(--citui-line);display:flex;flex-direction:column}
.aq-steps div:first-child{border-left:0}
.aq-steps b{color:var(--citui-ink);display:inline-flex;gap:5px;align-items:center;font-size:.82rem}
.aq-steps div.on{background:color-mix(in srgb,var(--citui-cyan-500) 12%,var(--citui-white));box-shadow:inset 0 -3px 0 var(--citui-cyan-500);color:var(--citui-ink)}
.aq-ladder small{display:block;font-size:.78rem;color:var(--citui-muted);margin-top:6px;line-height:1.45}
.aq-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}
.aq-act form{margin:0}
.aq .aq-btn{font:inherit;font-weight:700;font-size:.95rem;border:0;border-radius:var(--citui-radius-sm);padding:9px 22px;cursor:pointer}
.aq .aq-btn.aq-yes{background:var(--citui-ok-ink);color:var(--citui-white);border:1px solid var(--citui-ok-ink)}
.aq .aq-btn.aq-no{background:var(--citui-surface-2);color:var(--citui-ink);border:1px solid var(--citui-line-strong)}
.aq-tabs{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}
.aq-tabs button{font:inherit;font-size:.82rem;border:1px solid var(--citui-line-strong);background:var(--citui-white);border-radius:var(--citui-radius-pill);padding:5px 12px;cursor:pointer}
.aq-tabs button.on{background:var(--citui-ink);color:var(--citui-white);border-color:var(--citui-ink)}
.aq-tabs .sep{width:10px}
.aq-view{background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);overflow:hidden}
.aq-frame{display:block;width:100%;height:calc(100vh - 140px);min-height:640px;border:0;margin:0 auto;background:var(--citui-white)}
.aq-frame.m{width:390px;max-width:100%}
.aq-empty{padding:40px;text-align:center;color:var(--citui-muted)}
/* The filters hide rows with the hidden attribute; .aq-list a{display:block} would override it. */
.aq-page [hidden]{display:none!important}
.aq-sub{font-size:.8rem;font-weight:500;color:var(--citui-muted);margin-left:6px}
.aq-city{font-weight:600;color:var(--citui-ink)}
.aq-search{display:inline-flex;gap:4px;align-items:center;font-size:.8rem;font-weight:700;padding:3px 10px;margin-left:8px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-pill);color:var(--citui-ink);text-decoration:none;vertical-align:middle}
.aq-search:hover{background:var(--citui-surface-2)}
.aq-badges--data{margin:6px 0 2px;gap:6px}
.aq-data{font-size:.82rem;font-weight:600;padding:4px 10px;user-select:all}
.aq-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.aq-pill{display:inline-flex;gap:4px;align-items:center;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line-strong);white-space:nowrap}
.aq-pill.viber{color:var(--citui-glow-blue);border-color:color-mix(in srgb,var(--citui-glow-blue) 40%,var(--citui-white));background:color-mix(in srgb,var(--citui-glow-blue) 8%,var(--citui-white))}
.aq-pill.whatsapp{color:var(--citui-ok-ink);border-color:color-mix(in srgb,var(--citui-ok-ink) 35%,var(--citui-white));background:color-mix(in srgb,var(--citui-ok-ink) 6%,var(--citui-white))}
.aq-ns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:16px;align-items:start;background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:14px}
.aq-ns-h{margin:0 0 2px;font-size:1.1rem}
.aq-tl{list-style:none;margin:6px 0 12px;padding:0}
.aq-tl li{display:flex;gap:10px;align-items:flex-start;padding:5px 0;font-size:.88rem;line-height:1.45}
.aq-tl i{width:10px;height:10px;border-radius:50%;background:var(--citui-ok-ink);margin-top:5px;flex:none}
.aq-tl li.no{color:var(--citui-bad-ink);font-weight:700}
.aq-tl li.no i{background:var(--citui-white);border:2px solid var(--citui-bad-ink);width:7px;height:7px}
.aq-tl li.mut i{background:var(--citui-line-strong)}
.aq-if{font-size:.86rem;line-height:1.5;background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:9px 12px}
.aq-msg{background:var(--citui-surface-2);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);padding:8px}
.aq-msg>div{background:var(--citui-white);border-radius:var(--citui-radius-sm);padding:6px;font-size:.84rem;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.aq-msg img{display:block;width:100%;border-radius:var(--citui-radius-sm);margin-bottom:6px}
.aq-msg small{display:block;text-align:right;font-size:.74rem;color:var(--citui-muted);margin-top:4px}
.aq-note{font-size:.78rem;color:var(--citui-muted);margin-top:8px;line-height:1.45}
@container (max-width:900px){.aq{grid-template-columns:1fr}.aq-list{max-height:320px;position:static}.aq-ns{grid-template-columns:1fr}.aq-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.aq-steps div:nth-child(3){border-left:0}.aq-frame{height:70vh;min-height:480px}}
</style>`;

/** Plan switch + width switch of the preview, and the list filters (client-side; the counts move with them). */
/** The selected lead is still waiting for the phone's presence read: poll, reload once decided. */
function presencePoll(cur: PendingApproval | null): string {
  if (!cur || cur.channel.channel !== "check" || !cur.mobile) return "";
  return `<script>(function(){var n=0;var t=setInterval(function(){if(++n>30){clearInterval(t);return;}fetch("/jovahagyas/csatorna/${cur.leadId}",{credentials:"same-origin"}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.channel&&j.channel!=="check"){clearInterval(t);location.reload();}}).catch(function(){});},20000);})();</script>`;
}

const SCRIPT = `<script>
(function(){
  var fr=document.querySelector('.aq-frame');
  if(fr){
    document.querySelectorAll('.aq-tabs button').forEach(function(b){
      b.addEventListener('click',function(){
        var g=b.getAttribute('data-g');
        document.querySelectorAll('.aq-tabs button[data-g="'+g+'"]').forEach(function(x){x.classList.remove('on');});
        b.classList.add('on');
        if(g==='plan'){ fr.src='/mock/'+b.getAttribute('data-id'); }
        else { fr.classList.toggle('m', b.getAttribute('data-w')==='390'); }
      });
    });
  }
  var list=document.querySelector('.aq-list'); if(!list) return;
  var rows=[].slice.call(list.querySelectorAll('a[data-f]'));
  var q=list.querySelector('.aq-filt input'), sel={};
  function val(r,k){ return (r.getAttribute('data-'+k)||'').split(' '); }
  function match(r,skip){
    if(q && q.value.trim()){ var t=q.value.trim().toLowerCase(); if((r.getAttribute('data-s')||'').indexOf(t)<0) return false; }
    for(var k in sel){ if(k===skip||sel[k]==='*') continue; if(val(r,k).indexOf(sel[k])<0) return false; }
    return true;
  }
  function upd(){
    rows.forEach(function(r){ r.hidden=!match(r,null); });
    list.querySelectorAll('.aq-grp').forEach(function(g){
      var n=rows.filter(function(r){ return !r.hidden && r.getAttribute('data-grp')===g.getAttribute('data-grp'); }).length;
      g.hidden=n===0; var c=g.querySelector('.c'); if(c) c.textContent=n;
    });
    list.querySelectorAll('.aq-chips button').forEach(function(b){
      var k=b.getAttribute('data-k'), v=b.getAttribute('data-v');
      var n=rows.filter(function(r){ return match(r,k) && (v==='*'||val(r,k).indexOf(v)>=0); }).length;
      b.querySelector('.c').textContent=n; b.disabled=n===0 && !b.classList.contains('on');
    });
    var none=list.querySelector('.aq-none'); if(none) none.hidden=rows.some(function(r){return !r.hidden;});
  }
  list.querySelectorAll('.aq-chips button').forEach(function(b){
    b.addEventListener('click',function(){
      var k=b.getAttribute('data-k');
      list.querySelectorAll('.aq-chips button[data-k="'+k+'"]').forEach(function(x){x.classList.remove('on');});
      b.classList.add('on'); sel[k]=b.getAttribute('data-v'); upd();
    });
  });
  if(q) q.addEventListener('input',upd);
  var clr=list.querySelector('.aq-clear');
  if(clr) clr.addEventListener('click',function(){
    if(q) q.value=''; sel={};
    list.querySelectorAll('.aq-chips').forEach(function(c){ c.querySelectorAll('button').forEach(function(x,i){ x.classList.toggle('on', i===0); }); });
    upd();
  });
  upd();
})();
</script>`;

/** The lead the page opens: the asked one, else the first waiting. */
export function selectedApproval(items: readonly PendingApproval[], selected: string | null): PendingApproval | null {
  return items.find((i) => i.leadId === selected) ?? items[0] ?? null;
}

function groupOf(i: PendingApproval): ApprovalGroup {
  return i.channel.channel;
}

function chIcon(ch: string, size = 13): string {
  return ic(ch === "email" ? "mail" : ch === "mms" ? "photos" : ch === "check" ? "clock" : "sms", size);
}

function groupTitle(g: ApprovalGroup, lang: string): string {
  switch (g) {
    case "viber":
      return T(lang, "Viberen megy");
    case "whatsapp":
      return T(lang, "WhatsAppon megy");
    case "mms":
      return T(lang, "MMS + SMS megy");
    case "email":
      return T(lang, "E-mailben megy");
    default:
      return T(lang, "Még ellenőrizzük");
  }
}

function groupHint(g: ApprovalGroup, lang: string): string {
  return g === "viber" || g === "whatsapp" ? T(lang, "SMS nélkül") : g === "mms" ? T(lang, "csak együtt") : g === "check" ? T(lang, "üzenet nélkül") : "";
}

function chipName(g: ApprovalGroup, lang: string): string {
  return g === "viber" ? "Viber" : g === "whatsapp" ? "WhatsApp" : g === "mms" ? "MMS + SMS" : g === "email" ? T(lang, "E-mail") : T(lang, "Ellenőrzés vár");
}

/** One chip row of the list filter; the counts are filled in by the page script. */
function chips(key: string, opts: readonly (readonly [string, string])[], lang: string): string {
  return `<div class="aq-chips">${[["*", T(lang, "Mind")] as const, ...opts]
    .map(([v, label], i) => `<button type="button" data-k="${esc(key)}" data-v="${esc(v)}"${i === 0 ? ' class="on"' : ""}>${esc(label)} <span class="c"></span></button>`)
    .join("")}</div>`;
}

/** The two tabs of the page and the messenger state line above both. */
function pageTop(tab: "wait" | "notseen", waiting: number, notSeen: number, cfg: MessengerConfig, lang: string): string {
  const tabs =
    `<nav class="aq-tabbar"><a href="/jovahagyas"${tab === "wait" ? ' class="on"' : ""}>${esc(T(lang, "Jóváhagyásra vár"))} <span class="n">${waiting}</span></a>` +
    `<a href="/jovahagyas?tab=nemnezte"${tab === "notseen" ? ' class="on"' : ""}>${esc(T(lang, "Messengeren nem nézte meg"))} <span class="n${notSeen ? " warn" : ""}">${notSeen}</span></a>` +
    `<span class="aq-help">${helpLink("console.approval")}</span></nav>`;
  const intro =
    tab === "wait"
      ? T(lang, "Itt döntöd el, mehet-e ki a megkeresés. A lista csatornánként csoportosítva mutatja, HOL megy ki: Viberen, WhatsAppon, MMS + SMS-ben vagy e-mailben.")
      : T(lang, "Ide az kerül, akinek legalább {n} napja Viberen vagy WhatsAppon kiment a megkeresés, és nem nézte meg. Aki válaszolt vagy elutasított, ide soha nem kerül. WhatsAppon az is „nem nézte meg”-nek látszik, aki kikapcsolta az olvasási visszaigazolást.", { n: NOT_SEEN_AFTER_DAYS });
  const on = cfg.enabled && !cfg.brake;
  const state = on
    ? T(lang, "Messenger-út: bekapcsolva, a fék nem lépett közbe. Korlátlan: ami jóvá van hagyva, kimegy (hétköznap 9–16).")
    : cfg.brake
      ? T(lang, "Messenger-út: a fék leállította ({why}) — minden MMS + SMS-ben megy, együtt.", { why: cfg.brake.reason })
      : T(lang, "Messenger-út: kikapcsolva — minden MMS + SMS-ben megy, együtt.");
  return (
    `${tabs}<p class="aq-intro">${esc(intro)}</p>` +
    `<div class="aq-state${on ? "" : " off"}"><span class="dot"></span><span>${esc(state)}</span><a href="/">${esc(T(lang, "Irányítópult"))}</a></div>`
  );
}

/** The 4-step channel ladder of the selected lead (ADR-0430 ①). */
function ladder(i: PendingApproval, lang: string): string {
  const c = i.channel;
  if (c.channel === "email") return `<div class="aq-ladder"><p><b>${esc(T(lang, "Így megy ki"))}:</b> ${esc(T(lang, "e-mailben (nincs magyar mobilszám)."))}</p></div>`;
  const how =
    c.channel === "viber"
      ? T(lang, "Viberen megy: a terv képe + a szöveg a linkkel, egy üzenetben. SMS nem megy.")
      : c.channel === "whatsapp"
        ? T(lang, "WhatsAppon megy: a terv képe + a szöveg a linkkel, egy üzenetben. SMS nem megy.")
        : c.channel === "mms"
          ? T(lang, "MMS + SMS megy, együtt: előbb MMS-ben a terv képe, utána az SMS a linkkel.")
          : T(lang, "Még ellenőrizzük: a telefon üzenet nélkül megnézi, van-e Vibere vagy WhatsAppja.");
  const steps: readonly (readonly [number, string, string, string])[] = [
    [1, "sms", "1. Viber", T(lang, "≤ 30 napja aktív")],
    [2, "sms", "2. WhatsApp", T(lang, "ha van fiók")],
    [3, "sms", "3. Viber", T(lang, "régi aktivitással is")],
    [4, "photos", "4. MMS + SMS", T(lang, "együtt, tartalék")],
  ];
  const cells = steps
    .map(([n, icon, title, sub]) => `<div${c.step === n ? ' class="on"' : ""}><b>${ic(icon, 13)}${esc(title)}</b>${esc(c.step === n ? T(lang, "EZ MEGY") : sub)}</div>`)
    .join("");
  return (
    `<div class="aq-ladder"><p><b>${esc(T(lang, "Így megy ki"))}:</b> ${esc(how)}</p><div class="aq-steps">${cells}</div>` +
    `<small>${esc(c.reason)}. ${esc(T(lang, "Ha a fék leállítja vagy kikapcsolod a messenger-utat, MMS + SMS megy helyette, együtt. Kiküldéskor a telefon újra megnézi."))}</small></div>`
  );
}

/** `copyPanel`: the outreach text panel of the selected lead (approvalCopy.ts), above the site. */
/** The selected lead's contacts as badges carrying the data itself (owner 2026-11-08). */
function contactDataBadges(i: PendingApproval, lang: string): string {
  const b: string[] = [];
  if (i.email) b.push(`<span class="aq-pill aq-data">${ic("mail", 12)}${esc(i.email)}</span>`);
  if (i.phone) b.push(`<span class="aq-pill aq-data">${ic("contact", 12)}${esc(i.phone)}</span>`);
  const p = i.presence;
  if (i.mobile) {
    if (p?.viber === "yes") b.push(`<span class="aq-pill aq-data viber">${ic("sms", 12)}Viber${p.viberSeen ? ` · ${esc(p.viberSeen)}` : ""}</span>`);
    if (p?.whatsapp === "yes") b.push(`<span class="aq-pill aq-data whatsapp">${ic("sms", 12)}WhatsApp</span>`);
    if (!p || p.whatsapp === "unknown" || p.viber === "unknown") b.push(`<span class="aq-pill aq-data">${ic("clock", 12)}${esc(T(lang, "Ellenőrzés vár"))}</span>`);
    else if (p.viber !== "yes" && p.whatsapp !== "yes") b.push(`<span class="aq-pill aq-data">${ic("photos", 12)}${esc(T(lang, "MMS + SMS"))}</span>`);
  }
  return b.length ? `<div class="aq-badges aq-badges--data">${b.join("")}</div>` : "";
}

/** What the lead has, as badges (owner 2026-11-08: „badgeként látszódjon, mije van”). */
function contactBadges(i: PendingApproval, lang: string): string {
  const b: string[] = [];
  if (i.email) b.push(`<span class="aq-pill">${ic("mail", 11)}${esc(T(lang, "E-mail"))}</span>`);
  if (i.mobile) {
    const p = i.presence;
    if (p?.viber === "yes") b.push(`<span class="aq-pill viber">${ic("sms", 11)}Viber</span>`);
    if (p?.whatsapp === "yes") b.push(`<span class="aq-pill whatsapp">${ic("sms", 11)}WhatsApp</span>`);
    if (!p || p.whatsapp === "unknown" || p.viber === "unknown") b.push(`<span class="aq-pill">${ic("contact", 11)}${esc(T(lang, "Mobil"))}</span>`);
    else if (p.viber !== "yes" && p.whatsapp !== "yes") b.push(`<span class="aq-pill">${ic("photos", 11)}${esc(T(lang, "MMS + SMS"))}</span>`);
  }
  return b.length ? `<span class="aq-badges">${b.join("")}</span>` : "";
}

export function approvalPage(
  items: readonly PendingApproval[],
  selected: string | null,
  flash: string,
  copyPanel = "",
  ctx: { readonly cfg: MessengerConfig; readonly notSeen: number } = { cfg: { enabled: false, brake: null }, notSeen: 0 },
): string {
  const lang = consoleLang();
  const cur = selectedApproval(items, selected);
  const sub = (i: PendingApproval): string => {
    const site = i.qualification === "no_site" ? T(lang, "nincs honlap") : T(lang, "elavult honlap");
    return i.channel.channel === "viber" && i.channel.step === 1 ? `${i.city} · ${i.channel.reason.replace(/^.*utoljára aktív: /, T(lang, "aktív") + ": ")}` : `${i.city} · ${site}`;
  };
  const row = (i: PendingApproval): string =>
    `<a href="/jovahagyas?lead=${esc(i.leadId)}"${cur && i.leadId === cur.leadId ? ' class="on"' : ""} data-f data-grp="${groupOf(i)}" data-ch="${groupOf(i)}" data-site="${i.qualification === "no_site" ? "none" : "old"}" data-chk="${i.channel.channel === "check" ? "wait" : "done"}" data-alt="${i.altId ? "yes" : "no"}" data-s="${esc(`${i.name} ${i.city}`.toLowerCase())}"><b>${esc(i.name)}</b><small>${esc(sub(i))}</small>${contactBadges(i, lang)}</a>`;
  const groups = APPROVAL_GROUPS.map((g) => {
    const its = items.filter((i) => groupOf(i) === g);
    if (!its.length) return "";
    return `<div class="aq-grp" data-grp="${g}"><span>${chIcon(g)}${esc(groupTitle(g, lang))} · <span class="c">${its.length}</span></span><small>${esc(groupHint(g, lang))}</small></div>${its.map(row).join("")}`;
  }).join("");
  const filters =
    `<div class="aq-filt"><input type="search" placeholder="${esc(T(lang, "Keresés név vagy település szerint"))}" aria-label="${esc(T(lang, "Keresés név vagy település szerint"))}">` +
    `<h4>${esc(T(lang, "Csatorna"))}</h4>${chips("ch", APPROVAL_GROUPS.map((g) => [g, chipName(g, lang)] as const), lang)}` +
    `<h4>${esc(T(lang, "Honlap"))}</h4>${chips("site", [["none", T(lang, "Nincs honlap")], ["old", T(lang, "Elavult honlap")]], lang)}` +
    // Owner 2026-11-08: hide / show what the phone has not checked for Viber / WhatsApp yet,
    // and the leads whose send would stop now for want of a reviewed second plan.
    `<h4>${esc(T(lang, "Messenger-ellenőrzés"))}</h4>${chips("chk", [["done", T(lang, "Ellenőrizve")], ["wait", T(lang, "Ellenőrzésre vár")]], lang)}` +
    `<h4>${esc(T(lang, "Második terv"))}</h4>${chips("alt", [["yes", T(lang, "Van")], ["no", T(lang, "Nincs — most megállna")]], lang)}` +
    `<button type="button" class="aq-clear">${esc(T(lang, "Szűrők törlése"))}</button></div>`;
  const left =
    `<nav class="aq-list"><div class="aq-cnt">${esc(T(lang, "Jóváhagyásra vár"))}: ${items.length}</div>${items.length ? filters : ""}${groups}` +
    (items.length ? `<div class="aq-none" hidden>${esc(T(lang, "Nincs a szűrőnek megfelelő lead."))}</div>` : "") +
    `</nav>`;
  const top = pageTop("wait", items.length, ctx.notSeen, ctx.cfg, lang);
  const flashHtml = flash ? `<p class="aq-meta">${esc(flash)}</p>` : "";
  if (!cur) {
    return layout(
      T(lang, "Jóváhagyás"),
      `${CSS}<div class="aq-page">${top}${flashHtml}<div class="aq">${left}<div class="aq-main"><div class="aq-empty">${esc(T(lang, "Nincs jóváhagyásra váró megkeresés."))}</div></div></div></div>${SCRIPT}`,
      { active: "/jovahagyas" },
    );
  }
  const tabs =
    `<div class="aq-tabs"><button type="button" class="on" data-g="plan" data-id="${esc(cur.mainId)}">${esc(T(lang, "1. terv"))}</button>` +
    (cur.altId ? `<button type="button" data-g="plan" data-id="${esc(cur.altId)}">${esc(T(lang, "2. terv"))}</button>` : "") +
    `<span class="sep"></span><button type="button" class="on" data-g="w" data-w="1280">${esc(T(lang, "Asztali"))}</button>` +
    `<button type="button" data-g="w" data-w="390">${esc(T(lang, "Mobil"))}</button></div>`;
  const form = (approve: boolean) =>
    `<form method="post" action="/jovahagyas/${esc(cur.leadId)}"><input type="hidden" name="d" value="${approve ? "mehet" : "nem"}"><button class="aq-btn ${approve ? "aq-yes" : "aq-no"}">${esc(approve ? T(lang, "Mehet") : T(lang, "Nem mehet ki"))}</button></form>`;
  // Owner 2026-11-08: no recipient line, no reviewer note — the contacts as badges WITH the data,
  // so they can be checked at a glance (e.g. the e-mail badge reads info@szallas.hu).
  const head =
    `<div class="aq-head"><h2>${esc(cur.name)}${cur.city ? ` <span class="aq-city">· ${esc(cur.city)}</span>` : ""}` +
    // Owner 2026-11-08: one click to check the lead on the web — name + town + e-mail, in a new window.
    ` <a class="aq-search" href="https://www.google.com/search?q=${encodeURIComponent([cur.name, cur.city, cur.email].filter(Boolean).join(" "))}" target="_blank" rel="noopener">${ic("search", 13)}${esc(T(lang, "Keresés"))}</a>` +
    ` <small class="aq-sub"><a href="/lead/${esc(cur.leadId)}" target="_blank" rel="noopener">${esc(T(lang, "lead lapja"))}</a></small></h2>` +
    contactDataBadges(cur, lang) +
    ladder(cur, lang) +
    `<div class="aq-act">${form(true)}${form(false)}</div></div>`;
  const right =
    `<div class="aq-main">${head}${copyPanel}${tabs}<div class="aq-view"><iframe class="aq-frame" title="${esc(cur.name)}" data-main="${esc(cur.mainId)}" src="/mock/${esc(cur.mainId)}"></iframe></div></div>`;
  return layout(T(lang, "Jóváhagyás"), `${CSS}<div class="aq-page">${top}${flashHtml}<div class="aq">${left}${right}</div></div>${SCRIPT}${presencePoll(cur)}`, {
    active: "/jovahagyas",
  });
}

// ── 2. fül: „Messengeren nem nézte meg” ──

function daysAgo(d: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

function shortTime(d: Date): string {
  return new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Viber active in the last 7 days, from the last-seen line the watcher read ("Elérhető", "perce", "tegnap", "nov. 3." …). */
function viberActiveWeek(seen: string | null, now: Date): boolean {
  if (!seen) return false;
  const s = seen.toLowerCase();
  if (/elérhető|perce|órája|\bma\b|tegnap/.test(s)) return true;
  const MONTHS = ["jan", "febr", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];
  const m = new RegExp(`(${MONTHS.join("|")})[a-zá-ű]*\\.?\\s+(\\d{1,2})`).exec(s);
  if (!m) return false;
  const mon = MONTHS.indexOf(m[1]!);
  let d = new Date(Date.UTC(now.getUTCFullYear(), mon, Number(m[2])));
  if (d > now) d = new Date(Date.UTC(now.getUTCFullYear() - 1, mon, Number(m[2])));
  return now.getTime() - d.getTime() <= 7 * 86_400_000;
}

export function notSeenPage(
  items: readonly NotSeenItem[],
  selected: string | null,
  flash: string,
  ctx: { readonly cfg: MessengerConfig; readonly waiting: number },
  now: Date = new Date(),
): string {
  const lang = consoleLang();
  const cur = items.find((i) => i.outboxId === selected) ?? items[0] ?? null;
  const appName = (c: string) => (c === "viber" ? "Viber" : "WhatsApp");
  const stateOf = (i: NotSeenItem) => (i.deliveredAt || i.receipt === "delivered" ? "delivered" : "sent");
  const ageBucket = (i: NotSeenItem) => {
    const d = daysAgo(i.sentAt, now);
    return d >= 7 ? "7" : d >= 4 ? "4" : "3";
  };
  const row = (i: NotSeenItem): string => {
    const d = daysAgo(i.sentAt, now);
    const st = stateOf(i) === "delivered" ? T(lang, "kézbesítve") : T(lang, "csak elküldve");
    return (
      `<a href="/jovahagyas?tab=nemnezte&amp;id=${esc(i.outboxId)}"${cur && cur.outboxId === i.outboxId ? ' class="on"' : ""} data-f data-grp="all" data-ch="${i.channel}" data-st="${stateOf(i)}" data-act="${viberActiveWeek(i.peerSeenLast ?? i.peerSeenBefore, now) ? "week" : "older"}" data-age="${ageBucket(i)}" data-s="${esc(`${i.name} ${i.city}`.toLowerCase())}">` +
      `<span class="aq-row"><b>${esc(i.name)}</b><span class="aq-pill ${i.channel}">${ic("sms", 12)}${esc(appName(i.channel))}</span></span>` +
      `<small>${esc(i.city)} · ${esc(T(lang, "{n} napja", { n: d }))} · ${esc(st)}</small></a>`
    );
  };
  const filters = items.length
    ? `<div class="aq-filt">` +
      `<h4>${esc(T(lang, "Csatorna"))}</h4>${chips("ch", [["viber", "Viber"], ["whatsapp", "WhatsApp"]], lang)}` +
      `<h4>${esc(T(lang, "Állapot"))}</h4>${chips("st", [["delivered", T(lang, "Kézbesítve")], ["sent", T(lang, "Csak elküldve")]], lang)}` +
      `<h4>${esc(T(lang, "Viberen aktív"))}</h4>${chips("act", [["week", T(lang, "Az elmúlt 7 napban")], ["older", T(lang, "Régebben / nem látszik")]], lang)}` +
      `<h4>${esc(T(lang, "Mióta"))}</h4>${chips("age", [["3", T(lang, "3 napja")], ["4", T(lang, "4–6 napja")], ["7", T(lang, "7+ napja")]], lang)}` +
      `<button type="button" class="aq-clear">${esc(T(lang, "Szűrők törlése"))}</button></div>`
    : "";
  const left =
    `<nav class="aq-list"><div class="aq-cnt">${esc(T(lang, "{n}+ napja nem nézte meg", { n: NOT_SEEN_AFTER_DAYS }))}: ${items.length}</div>${filters}${items.map(row).join("")}` +
    (items.length ? `<div class="aq-none" hidden>${esc(T(lang, "Nincs a szűrőnek megfelelő lead."))}</div>` : "") +
    `</nav>`;
  const top = pageTop("notseen", ctx.waiting, items.length, ctx.cfg, lang);
  const flashHtml = flash ? `<p class="aq-meta">${esc(flash)}</p>` : "";
  if (!cur) {
    return layout(
      T(lang, "Jóváhagyás"),
      `${CSS}<div class="aq-page">${top}${flashHtml}<div class="aq">${left}<div class="aq-main"><div class="aq-empty">${esc(T(lang, "Nincs olyan messenger-megkeresés, amit 3 napja nem néztek meg."))}</div></div></div></div>${SCRIPT}`,
      { active: "/jovahagyas" },
    );
  }
  const app = appName(cur.channel);
  const d = daysAgo(cur.sentAt, now);
  const seen = cur.peerSeenLast ?? cur.peerSeenBefore;
  const tl =
    `<ul class="aq-tl">` +
    `<li><i></i><span>${esc(T(lang, "Elküldve ezen: {app} — {at}", { app, at: shortTime(cur.sentAt) }))}</span></li>` +
    (cur.deliveredAt || cur.receipt === "delivered"
      ? `<li><i></i><span>${esc(T(lang, "Kézbesítve"))}${cur.deliveredAt ? `: ${esc(shortTime(cur.deliveredAt))}` : ""}</span></li>`
      : `<li class="mut"><i></i><span>${esc(T(lang, "Kézbesítve: még nem látszik"))}</span></li>`) +
    `<li class="no"><i></i><span>${esc(T(lang, "Megnézte: nem — {n} napja", { n: d }))}</span></li>` +
    (cur.channel === "viber"
      ? `<li${seen ? "" : ' class="mut"'}><i></i><span>${esc(seen ? T(lang, "Viberen utoljára aktív: {seen}", { seen }) : T(lang, "Viberen az utolsó aktivitás nem látszik"))}</span></li>`
      : `<li class="mut"><i></i><span>${esc(T(lang, "WhatsAppon az utolsó aktivitás idegennek nem látszik; aki kikapcsolta az olvasási visszaigazolást, az is „nem nézte meg”-nek látszik."))}</span></li>`) +
    `</ul>`;
  const btn = (dv: "mms" | "nem", label: string, cls: string) =>
    `<form method="post" action="/jovahagyas/nemnezte/${esc(cur.outboxId)}"><input type="hidden" name="d" value="${dv}"><button class="aq-btn ${cls}">${esc(label)}</button></form>`;
  const detail =
    `<div class="aq-ns"><div><h2 class="aq-ns-h">${esc(cur.name)}</h2>` +
    `<div class="aq-meta">${esc(cur.city)} · ${esc(cur.phone)} · <a href="/lead/${esc(cur.leadId)}" target="_blank" rel="noopener">${esc(T(lang, "lead lapja"))}</a></div>` +
    tl +
    `<div class="aq-if"><b>${esc(T(lang, "Ha „Mehet”:"))}</b> ${esc(T(lang, "MMS + SMS megy ki, együtt (a mai pár): MMS-ben ugyanaz a kép, utána SMS ugyanazzal a linkkel. A messenger-üzenet marad, újat ott nem küldünk."))}</div>` +
    `<div class="aq-act">${btn("mms", T(lang, "Mehet MMS + SMS-ben is"), "aq-yes")}${btn("nem", T(lang, "Nem kell"), "aq-no")}</div></div>` +
    `<div class="aq-msg"><div><img src="/jovahagyas/mms-kep/${esc(cur.outboxId)}" alt="${esc(T(lang, "a kiküldött terv képe"))}">${esc(cur.text ?? "")}</div>` +
    `<small>${esc(app)} · ${esc(shortTime(cur.sentAt))}${cur.deliveredAt ? ` · ${esc(T(lang, "kézbesítve"))}` : ""}</small></div></div>`;
  return layout(
    T(lang, "Jóváhagyás"),
    `${CSS}<div class="aq-page">${top}${flashHtml}<div class="aq">${left}<div class="aq-main">${detail}</div></div></div>${SCRIPT}`,
    { active: "/jovahagyas" },
  );
}

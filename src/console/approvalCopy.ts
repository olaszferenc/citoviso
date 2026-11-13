// The approval page's TEXT panel (owner 2026-11-06): exactly what the first outreach of the
// selected lead would say — the letter (subject + body) and the companion SMS of the MMS+SMS
// pair — editable, saved per lead, used by the send.
//
// ⛔ Built from the SEND PATH, not a copy of it: the same recipient choice and the same tracked
// link the dispatch tick uses (dispatchRecipient / prepareDispatchProspect, autoDispatch.ts), the
// same draft (buildDraftForProspect → renderDraft / renderPairSmsDraft) and the same override
// (copyOverride.ts) sendOutreachMail and the pair apply. What this panel shows is what goes out.

import { db } from "../db/client.js";
import { buildDraftForProspect, PAIR_SMS_MAX_SEGMENTS, renderPairSmsDraft, type OutreachDraft, type SmsDraft } from "../outreach/draft.js";
import { dispatchRecipient, planHasRooms, prepareDispatchProspect } from "../outreach/autoDispatch.js";
import {
  EDITABLE_MAIL_PARTS,
  judgeCopyEdit,
  loadCopyOverride,
  storeCopyOverride,
  withMailOverride,
  withPairSmsOverride,
  type CopyBase,
  type CopyEditInput,
  type CopyOverride,
  type EditableMailPart,
} from "../outreach/copyOverride.js";
import { checkOutreachDraft, checkOutreachSms } from "../outreach/outreachCheck.js";
import { GSM7_BASIC, smsEncoding } from "../sms/encoding.js";
import { jsonForScript } from "../text/jsonForScript.js";
import { isHuMobileE164, normalizePhone } from "../text/phone.js";
import { renderMessengerCaption } from "../outreach/messengerCaption.js";
import { T } from "../i18n/mail.js";
import { esc } from "./views.js";
import { consoleLang } from "./i18nCtx.js";
import type { PendingApproval } from "./approvalQueue.js";

interface CopyContext {
  readonly prospectId: string;
  readonly base: CopyBase;
  readonly email: string | null;
  readonly phone: string | null;
  readonly override: CopyOverride | null;
  readonly notes: readonly string[];
  /** ADR-0430: the caption the image carries on Viber / WhatsApp (the machine text; the owner's SMS wins). */
  readonly caption: SmsDraft | null;
}

type Loaded = { ok: true; ctx: CopyContext } | { ok: false; note: string };

/** The tracked link and the machine text of the lead's first outreach, as the dispatch builds them. */
async function loadContext(item: PendingApproval): Promise<Loaded> {
  const lang = consoleLang();
  const notes: string[] = [];
  // The dispatch never makes a link for a plan without the rooms module (dispatchOne); neither does the preview.
  const art = await db.selectFrom("mock_artifact").select("path").where("id", "=", item.mainId).executeTakeFirst();
  if (!(await planHasRooms(art?.path))) {
    return { ok: false, note: T(lang, "a mockból hiányzik a szobamodul — szobamodul nélküli terv nem megy ki") };
  }
  const rcpt = await dispatchRecipient(item.leadId, item.mainId);
  if (rcpt.ambiguous) notes.push(T(lang, "A leadnek több e-mail-címe van, és egyik sincs kiválasztva — a kiküldés ezt a leadet megtartja, amíg a lead lapján nem választasz."));
  const prep = await prepareDispatchProspect(item.leadId, item.mainId, rcpt.contactEmail);
  if (!prep.ok && !prep.prospectId) return { ok: false, note: prep.note };
  if (!prep.ok) notes.push(`${T(lang, "A kiküldés most megállna")}: ${prep.note}`);
  const prospectId = prep.ok ? prep.prospectId : prep.prospectId!;
  const d = await buildDraftForProspect(prospectId);
  if (!d) return { ok: false, note: T(lang, "a piszkozat nem állítható elő") };
  const p = await db.selectFrom("prospect").select("contact_email").where("id", "=", prospectId).executeTakeFirst();
  const e164 = d.phone ? normalizePhone(d.phone) : null;
  const mobile = e164 && isHuMobileE164(e164) ? e164 : null;
  return {
    ok: true,
    ctx: {
      prospectId,
      base: { draft: d.draft, pairSms: mobile ? renderPairSmsDraft(d.input) : null, leadName: d.input.leadName, lang: d.lang, market: d.market },
      email: rcpt.ambiguous ? null : (p?.contact_email ?? null),
      phone: mobile,
      override: await loadCopyOverride(prospectId),
      notes,
      caption: mobile ? renderMessengerCaption(d.input) : null,
    },
  };
}

/** The save form's fields. */
export function copyEditFromForm(form: URLSearchParams): CopyEditInput {
  const parts: Partial<Record<EditableMailPart, string>> = {};
  for (const k of EDITABLE_MAIL_PARTS) parts[k] = form.get(k) ?? "";
  return { subject: form.get("subject") ?? "", parts, pairSms: form.get("sms") ?? "" };
}

/** Save (or with reset, clear) the owner's wording. Refusal reasons come back for the panel. */
export async function saveApprovalCopy(
  item: PendingApproval,
  input: CopyEditInput | null,
  by: string,
): Promise<{ ok: true; message: string } | { ok: false; reasons: string[] }> {
  if (!input) {
    await storeCopyOverride(item.leadId, item.mainId, null);
    return { ok: true, message: T(consoleLang(), "visszaállítva a gépi szövegre") };
  }
  const loaded = await loadContext(item);
  if (!loaded.ok) return { ok: false, reasons: [loaded.note] };
  const j = judgeCopyEdit(loaded.ctx.base, input, by);
  if (!j.ok) return j;
  const stored = await storeCopyOverride(item.leadId, item.mainId, j.override);
  const lang = consoleLang();
  if (!stored) return { ok: false, reasons: [T(lang, "Ez a lead már nem vár jóváhagyásra — a szöveg nem változott.")] };
  return {
    ok: true,
    message: j.override ? T(lang, "a szöveg mentve — a kiküldés ezt használja") : T(lang, "nincs eltérés a gépi szövegtől — a gépi szöveg megy"),
  };
}

function partLabel(lang: string, k: EditableMailPart): string {
  switch (k) {
    case "greet":
      return T(lang, "Megszólítás");
    case "hook":
      return T(lang, "Bevezető");
    case "p1":
      return T(lang, "Ajánlat");
    case "p2":
      return T(lang, "Kipróbálás");
    case "p3":
      return T(lang, "Ár");
    case "trial":
      return T(lang, "Ingyenes próba");
    default:
      return T(lang, "Zárás");
  }
}

/** The lines that stand fixed between and after the editable paragraphs (from the composed body). */
function fixedBlocks(draft: OutreachDraft): { afterP1: string; footer: string } {
  const body = draft.body;
  const linkAt = body.indexOf(draft.link);
  const p2At = body.indexOf(draft.parts.p2, linkAt);
  const afterP1 = linkAt >= 0 && p2At > linkAt ? body.slice(linkAt, p2At).trim() : draft.link;
  // The fixed footer starts after the LAST editable paragraph (p3 closes the offer since
  // 2026-11-13; before that p4 did).
  const p4At = body.lastIndexOf(draft.parts.p4);
  const p3At = body.lastIndexOf(draft.parts.p3);
  const end = Math.max(p4At >= 0 ? p4At + draft.parts.p4.length : -1, p3At >= 0 ? p3At + draft.parts.p3.length : -1);
  const footer = end >= 0 ? body.slice(end).trim() : "";
  return { afterP1, footer };
}

const CSS = `<style>
.aq-copy{background:var(--citui-white);border:1px solid var(--citui-line);border-radius:var(--citui-radius-sm);margin-bottom:10px}
.aq-copy>summary{cursor:pointer;padding:10px 14px;font-weight:700;font-size:.92rem}
.aq-copy>summary small{font-weight:400;color:var(--citui-muted);margin-left:6px}
.aq .aq-copy>form{padding:0 14px 14px;margin:0}
.aq-cols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:16px;align-items:start}
@container (max-width:760px){.aq-cols{grid-template-columns:1fr}}
.aq-copy-wrap{container-type:inline-size}
.aq-ch h3{font-size:.86rem;margin:4px 0 6px}
.aq-ch .aq-to{font-size:.8rem;color:var(--citui-muted);margin-bottom:8px;word-break:break-all}
.aq-f{display:block;margin:0 0 8px}
.aq-f span{display:block;font-size:.72rem;font-weight:600;color:var(--citui-muted);text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}
.aq-f input,.aq-f textarea{width:100%;box-sizing:border-box;font:inherit;font-size:.86rem;line-height:1.45;padding:6px 8px;border:1px solid var(--citui-line-strong);border-radius:var(--citui-radius-sm);background:var(--citui-field);color:var(--citui-ink);resize:vertical}
.aq-f textarea{min-height:3.2em}
.aq-fix{white-space:pre-wrap;word-break:break-word;font:inherit;font-size:.78rem;line-height:1.45;color:var(--citui-muted);background:var(--citui-surface-2);border:1px dashed var(--citui-line);border-radius:var(--citui-radius-sm);padding:6px 8px;margin:0 0 8px}
.aq-fix b{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.03em}
.aq-cnt-sms{font-size:.8rem;color:var(--citui-muted);margin:-4px 0 8px}
.aq-cnt-sms.bad{color:var(--citui-bad-ink);font-weight:600}
.aq-ed{display:inline-block;font-size:.72rem;font-weight:600;padding:1px 8px;border-radius:var(--citui-radius-pill);background:var(--citui-warn);color:var(--citui-warn-ink);margin-left:6px}
.aq-warn{font-size:.82rem;line-height:1.45;background:color-mix(in srgb,var(--citui-warn) 30%,var(--citui-white));border:1px solid var(--citui-warn);border-radius:var(--citui-radius-sm);padding:8px 10px;margin:0 0 10px}
.aq-err{font-size:.84rem;line-height:1.45;background:color-mix(in srgb,var(--citui-bad) 12%,var(--citui-white));border:1px solid var(--citui-bad);color:var(--citui-bad-ink);border-radius:var(--citui-radius-sm);padding:8px 10px;margin:0 0 10px}
.aq-err ul,.aq-warn ul{margin:4px 0 0;padding-left:18px}
.aq-save{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px}
.aq .aq-save button{font:inherit;font-size:.86rem;font-weight:600;border-radius:var(--citui-radius-sm);padding:7px 16px;cursor:pointer;border:1px solid var(--citui-line-strong);background:var(--citui-surface-2);color:var(--citui-ink)}
.aq .aq-save button.pri{background:var(--citui-ink);color:var(--citui-white);border-color:var(--citui-ink)}
.aq-save small{font-size:.76rem;color:var(--citui-muted)}
</style>`;

/** Live character / segment count of the SMS box — the rule of src/sms/encoding.ts, mirrored for typing only (the save re-measures). */
const SCRIPT = (gsm: string, max: number) => `<script>
(function(){
  var ta=document.querySelector('.aq-copy textarea[name="sms"]'); if(!ta) return;
  var out=document.querySelector('.aq-cnt-sms'), link=ta.getAttribute('data-link');
  var B=new Set(Array.from(${jsonForScript(gsm)}));
  var P={'\\u201e':'"','\\u201c':'"','\\u201d':'"','\\u00ab':'"','\\u00bb':'"','\\u2018':"'",'\\u2019':"'",'\\u201a':"'",'\\u2013':'-','\\u2014':'-','\\u2011':'-','\\u2026':'...','\\u00a0':' ','\\u2009':' ','\\u202f':' '};
  function fold(t){ return Array.from(t.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')).map(function(c){return P[c]||c;}).join('').split('').filter(function(c){return B.has(c);}).join('').replace(/ {2,}/g,' '); }
  function upd(){
    var t=fold(ta.value.replace(/\\r\\n?/g,'\\n').trim()), n=Array.from(t).length;
    var seg=n===0?0:(n<=160?1:Math.ceil(n/153));
    var miss=link && t.indexOf(link)<0;
    out.textContent=out.getAttribute('data-f').replace('{n}',n).replace('{s}',seg)+(miss?' · '+out.getAttribute('data-nolink'):'');
    out.classList.toggle('bad', seg>${max} || miss);
  }
  ta.addEventListener('input',upd); upd();
  var det=document.querySelector('details.aq-copy');
  try{ if(localStorage.getItem('aq-copy-closed')==='1') det.removeAttribute('open'); }catch(e){}
  det.addEventListener('toggle',function(){ try{ localStorage.setItem('aq-copy-closed', det.open?'0':'1'); }catch(e){} });
})();
</script>`;

/**
 * The panel's HTML for the selected lead. `posted` = a refused save: the owner's typed text
 * stays in the boxes, with the reasons above them.
 */
export async function approvalCopyPanel(
  item: PendingApproval,
  posted: { input: CopyEditInput; reasons: string[] } | null = null,
): Promise<string> {
  const lang = consoleLang();
  let loaded: Loaded;
  try {
    loaded = await loadContext(item);
  } catch (e) {
    loaded = { ok: false, note: (e as Error).message };
  }
  const summary = `<summary>${esc(T(lang, "A megkeresés szövege"))}`;
  if (!loaded.ok) {
    return `${CSS}<details class="aq-copy" open>${summary}</summary><form><div class="aq-err">${esc(T(lang, "A szöveg nem állítható elő"))}: ${esc(loaded.note)}</div></form></details>`;
  }
  const { ctx } = loaded;
  const o = ctx.override;
  const mail = withMailOverride(ctx.base.draft, o, ctx.base.lang);
  const sms: SmsDraft | null = ctx.base.pairSms ? withPairSmsOverride(ctx.base.pairSms, o) : null;
  const val = (k: EditableMailPart): string => (posted ? (posted.input.parts[k] ?? "") : (mail.parts[k] ?? ""));

  const notes = [...ctx.notes];
  if (ctx.email) {
    const c = checkOutreachDraft(mail, ctx.base.leadName, ctx.base.lang, ctx.base.market);
    if (c.verdict === "FLAG") notes.push(`${T(lang, "Levél — a jogszerűségi kapu megállítaná")}: ${c.reasons.join(" · ")}`);
  }
  if (sms) {
    const c = checkOutreachSms(sms, ctx.base.leadName, ctx.base.lang, ctx.base.market);
    if (c.verdict === "FLAG") notes.push(`${T(lang, "SMS — a jogszerűségi kapu megállítaná")}: ${c.reasons.join(" · ")}`);
  }

  const fixed = fixedBlocks(mail);
  const field = (k: EditableMailPart): string =>
    `<label class="aq-f"><span>${esc(partLabel(lang, k))}</span><textarea name="${k}" rows="${k === "greet" ? 1 : 3}">${esc(val(k))}</textarea></label>`;
  const mailCol = ctx.email
    ? `<div class="aq-ch"><h3>${esc(T(lang, "E-mail"))}</h3><div class="aq-to">${esc(T(lang, "Címzett"))}: ${esc(ctx.email)} · <a href="/prospect/${esc(ctx.prospectId)}/email-preview" target="_blank" rel="noopener">${esc(T(lang, "a levél, ahogy megérkezik"))}</a></div>` +
      `<label class="aq-f"><span>${esc(T(lang, "Tárgy"))}</span><input name="subject" value="${esc(posted ? posted.input.subject : mail.subject)}"></label>` +
      field("greet") +
      field("hook") +
      field("p1") +
      `<div class="aq-fix"><b>${esc(T(lang, "Nem szerkeszthető"))}</b>${esc(fixed.afterP1)}</div>` +
      field("p2") +
      (mail.parts.trial ? field("trial") : "") +
      field("p4") +
      field("p3") +
      `<div class="aq-fix"><b>${esc(T(lang, "Nem szerkeszthető — aláírás, leiratkozás, jogi tájékoztató"))}</b>${esc(fixed.footer)}</div></div>`
    : `<div class="aq-ch"><h3>${esc(T(lang, "E-mail"))}</h3><div class="aq-to">${esc(T(lang, "Nincs e-mail-cím — levél nem megy ki."))}</div></div>`;

  const smsText = posted ? posted.input.pairSms : (sms?.text ?? "");
  const enc = smsEncoding(sms?.text ?? "");
  // ADR-0430: on Viber / WhatsApp the image carries the caption, in ONE message (no SMS). The SMS box
  // below stays: it is what goes out if the send falls back to the MMS + SMS pair.
  const ch = item.channel.channel;
  const app = ch === "viber" ? "Viber" : ch === "whatsapp" ? "WhatsApp" : null;
  const caption = ctx.caption ? withPairSmsOverride(ctx.caption, o) : null;
  const msgCol =
    app && caption
      ? `<div class="aq-ch"><h3>${esc(T(lang, "{app} — ami kimegy", { app }))}</h3><div class="aq-to">${esc(T(lang, "Címzett"))}: ${esc(ctx.phone ?? "")} · ${esc(T(lang, "a kép alatt ez a szöveg, egy üzenetben; SMS nem megy"))}</div>` +
        `<label class="aq-f"><span>${esc(T(lang, "{app}-üzenet szövege (a kép alatt)", { app }))}</span><textarea rows="4" readonly>${esc(caption.text)}</textarea></label>` +
        `<div class="aq-fix">${esc(o?.pairSms ? T(lang, "A saját SMS-szöveged megy ide is.") : T(lang, "Ékezetesen megy, rövidítés nélkül. Ha átírod a lenti SMS-t, a te szöveged megy ide is."))}</div></div>`
      : "";
  const smsCol = sms
    ? `${msgCol}<div class="aq-ch"><h3>${esc(app ? T(lang, "Ha MMS + SMS-re esik vissza") : T(lang, "MMS + SMS"))}</h3><div class="aq-to">${esc(T(lang, "Címzett"))}: ${esc(ctx.phone ?? "")} · ${esc(T(lang, "előbb MMS-ben a terv képe, utána ez az SMS"))}</div>` +
      `<label class="aq-f"><span>${esc(T(lang, "SMS szövege"))}</span><textarea name="sms" rows="6" data-link="${esc(sms.link)}">${esc(smsText)}</textarea></label>` +
      `<div class="aq-cnt-sms" data-f="${esc(T(lang, "{n} karakter · {s} szelet (legfeljebb {max})", { max: PAIR_SMS_MAX_SEGMENTS }))}" data-nolink="${esc(T(lang, "a mock linkje hiányzik!"))}">${esc(T(lang, "{n} karakter · {s} szelet (legfeljebb {max})", { n: enc.length, s: enc.segments, max: PAIR_SMS_MAX_SEGMENTS }))}</div>` +
      `<div class="aq-fix">${esc(T(lang, "Ékezetek nélkül megy ki (GSM-7), mint a gépi szöveg. A linket betűre hagyd benne: ez viszi a leiratkozást és a tájékoztatót."))}</div></div>`
    : `<div class="aq-ch"><h3>${esc(T(lang, "MMS + SMS"))}</h3><div class="aq-to">${esc(T(lang, "Nincs magyar mobilszám — SMS nem megy ki."))}</div></div>`;

  const edited = o ? `<span class="aq-ed">${esc(T(lang, "saját szöveg"))}${o.by ? ` · ${esc(o.by)}` : ""}</span>` : "";
  const err = posted?.reasons.length
    ? `<div class="aq-err">${esc(T(lang, "Nem mentettem"))}:<ul>${posted.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`
    : "";
  const warn = notes.length ? `<div class="aq-warn"><ul>${notes.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>` : "";
  const buttons =
    `<div class="aq-save"><button class="pri" name="a" value="save">${esc(T(lang, "Mentés"))}</button>` +
    (o ? `<button name="a" value="reset">${esc(T(lang, "Vissza a gépi szövegre"))}</button>` : "") +
    `<small>${esc(T(lang, "Üresen hagyott mező = a gépi szöveg megy."))}</small></div>`;
  return (
    `${CSS}<div class="aq-copy-wrap"><details class="aq-copy">${summary}${edited}<small>${esc(mail.subject)}</small></summary>` +
    `<form method="post" action="/jovahagyas/${esc(item.leadId)}/szoveg">${err}${warn}<div class="aq-cols">${mailCol}<div>${smsCol}</div></div>${buttons}</form></details></div>` +
    SCRIPT(GSM7_BASIC, PAIR_SMS_MAX_SEGMENTS)
  );
}

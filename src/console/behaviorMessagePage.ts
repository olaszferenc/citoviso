// CRM → Viselkedés-üzenetek (ADR-0439) — the console view of the behaviour message (variant A).
// Frozen plan: assets/design-refs/console/viselkedes-uzenet/ (the „Konzol-nézet” tab). Top to bottom:
// the master switch → KPIs (sent, came back / asked / started / unsubscribed within 24 h) → filter
// chips → one row per message (tap: the text that went out) → the per-trigger summary → the leads
// a stop rule held back since the switch. Links, forms and <details> only — works without JS.
//
// The measure is NOT the payment (too rare to judge a message by): it is what the lead did within
// 24 hours after the message — came back to the plan, used the question panel (kerdes-inditas
// 'ask_q'), started the trial, or unsubscribed.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { T } from "../i18n/mail.js";
import { APP_TZ, partsIn } from "../text/zoneTime.js";
import { consoleLang } from "./i18nCtx.js";
import { esc, helpLink, layout } from "./views.js";
import {
  BEHAVIOR_EXCLUSION_LABEL,
  getBehaviorSettings,
  listBehaviorCandidates,
  type BehaviorCandidate,
  type BehaviorSettings,
} from "../outreach/behaviorMessage.js";
import type { BehaviorTrigger } from "../outreach/behaviorMessageCopy.js";

export const BEHAVIOR_FILTERS = ["all", "return", "price", "start", "stopped"] as const;
export type BehaviorFilter = (typeof BEHAVIOR_FILTERS)[number];

export function isBehaviorFilter(v: unknown): v is BehaviorFilter {
  return typeof v === "string" && (BEHAVIOR_FILTERS as readonly string[]).includes(v);
}

export interface BehaviorRow {
  readonly leadId: string;
  readonly name: string;
  readonly trigger: BehaviorTrigger;
  readonly triggerAt: Date;
  readonly channel: "email" | "sms";
  readonly sentAt: Date;
  readonly body: string | null;
  readonly came: boolean;
  readonly asked: boolean;
  readonly started: boolean;
  readonly unsub: boolean;
}

export interface BehaviorPageData {
  readonly settings: BehaviorSettings;
  readonly filter: BehaviorFilter;
  readonly rows: readonly BehaviorRow[];
  /** Leads with a step since the switch that a stop rule held back (not the ones already messaged). */
  readonly stopped: readonly BehaviorCandidate[];
  /** Leads with a step whose message is not out yet (still reading, or outside the window). */
  readonly waiting: readonly BehaviorCandidate[];
  readonly flash: string | null;
}

export async function getBehaviorPage(filter: BehaviorFilter, flash: string | null, now = new Date()): Promise<BehaviorPageData> {
  const settings = await getBehaviorSettings();
  const sent = await db
    .selectFrom("behavior_message")
    .innerJoin("lead", "lead.id", "behavior_message.lead_id")
    .select([
      "behavior_message.lead_id as leadId",
      "lead.name as name",
      "behavior_message.trigger as trigger",
      "behavior_message.trigger_at as triggerAt",
      "behavior_message.channel as channel",
      "behavior_message.sent_at as sentAt",
      "behavior_message.body as body",
    ])
    .where("behavior_message.status", "=", "sent")
    .orderBy("behavior_message.sent_at", "desc")
    .limit(500)
    .execute();
  const ids = sent.map((r) => r.leadId);
  // What the lead did within 24 h after the message — one query per signal, over the lead's links.
  const within = async (q: ReturnType<typeof sql<{ lead_id: string }>>): Promise<Set<string>> =>
    new Set((await q.execute(db)).rows.map((r) => r.lead_id));
  const came = ids.length
    ? await within(sql<{ lead_id: string }>`
        select distinct b.lead_id from behavior_message b
          join prospect p on p.lead_id = b.lead_id
          join mock_view v on v.prospect_id = p.id
         where b.status = 'sent' and coalesce(v.device, '') <> 'bot'
           and v.started_at > b.sent_at and v.started_at <= b.sent_at + interval '24 hours'`)
    : new Set<string>();
  const asked = ids.length
    ? await within(sql<{ lead_id: string }>`
        select distinct b.lead_id from behavior_message b
          join prospect p on p.lead_id = b.lead_id
          join mock_view v on v.prospect_id = p.id
          join mock_event e on e.mock_view_id = v.id
         where b.status = 'sent' and e.type = 'ask_q'
           and e.occurred_at > b.sent_at and e.occurred_at <= b.sent_at + interval '24 hours'`)
    : new Set<string>();
  const started = ids.length
    ? await within(sql<{ lead_id: string }>`
        select distinct b.lead_id from behavior_message b
          join free_trial f on f.lead_id = b.lead_id
         where b.status = 'sent' and f.created_at > b.sent_at and f.created_at <= b.sent_at + interval '24 hours'`)
    : new Set<string>();
  const unsub = ids.length
    ? await within(sql<{ lead_id: string }>`
        select distinct b.lead_id from behavior_message b
          join prospect p on p.lead_id = b.lead_id
         where b.status = 'sent' and p.unsubscribed_at > b.sent_at and p.unsubscribed_at <= b.sent_at + interval '24 hours'`)
    : new Set<string>();
  const rows: BehaviorRow[] = sent.map((r) => ({
    leadId: r.leadId,
    name: r.name,
    trigger: r.trigger,
    triggerAt: new Date(r.triggerAt as unknown as string),
    channel: r.channel,
    sentAt: new Date(r.sentAt as unknown as string),
    body: r.body,
    came: came.has(r.leadId),
    asked: asked.has(r.leadId),
    started: started.has(r.leadId),
    unsub: unsub.has(r.leadId),
  }));
  const cands = settings.since ? await listBehaviorCandidates({ now }) : [];
  const stopped = cands.filter((c) => c.trigger && c.excluded && c.excluded !== "already" && c.excluded !== "stuck");
  const waiting = cands.filter((c) => c.trigger && !c.excluded);
  return { settings, filter, rows, stopped, waiting, flash };
}

function fmtAt(d: Date | null): string {
  if (!d) return "–";
  const p = partsIn(d, APP_TZ);
  return `${p.month}. ${p.day}. ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

const TRIGGER_LABEL = (lang: string): Record<BehaviorTrigger, string> => ({
  return: T(lang, "Visszajött"),
  price: T(lang, "Árnézés"),
  start: T(lang, "Próba-gomb"),
});
const MESSAGE_LABEL = (lang: string): Record<BehaviorTrigger, string> => ({
  return: T(lang, "Kérdése van? (#kerdes)"),
  price: T(lang, "Ár és mi van benne (#ar)"),
  start: T(lang, "Egy kattintással indul (#inditas)"),
});
const FILTER_LABEL = (lang: string): Record<BehaviorFilter, string> => ({
  all: T(lang, "Mind"),
  return: T(lang, "Visszajött"),
  price: T(lang, "Árnézés"),
  start: T(lang, "Próba-gomb"),
  stopped: T(lang, "Leállítva"),
});

function outcome(r: BehaviorRow, lang: string): string {
  const bits = [
    r.started ? T(lang, "indított") : "",
    r.asked ? T(lang, "kérdezett") : "",
    r.came ? T(lang, "visszajött") : "",
    r.unsub ? T(lang, "leiratkozott") : "",
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "–";
}

export function behaviorMessagePage(d: BehaviorPageData): string {
  const lang = consoleLang();
  const s = d.settings;
  const sw =
    `<div class="panel"><h2>${esc(T(lang, "Főkapcsoló"))} <span class="rp-q">— ${esc(
      s.enabled
        ? T(lang, "BE, {at} óta ({by}). Csak az azóta történt lépésekre megy üzenet.", { at: fmtAt(s.since), by: s.by ?? "–" })
        : T(lang, "KI — a futás semmit nem küld. Bekapcsoláskor csak az onnantól történő lépések számítanak, visszamenőleges kör nincs."),
    )}</span></h2>` +
    `<form method="post" action="/viselkedes-uzenetek/kapcsolo"><input type="hidden" name="on" value="${s.enabled ? "0" : "1"}">` +
    `<button class="citui-btn ${s.enabled ? "citui-btn--ghost" : "citui-btn--primary"}" type="submit">${esc(s.enabled ? T(lang, "Kikapcsolás") : T(lang, "Bekapcsolás"))}</button></form>` +
    `<p class="rp-note">${esc(T(lang, "Leadenként egyetlen üzenet, örökre: a 2. látogatás, az árnézés vagy az el nem küldött próba-gomb után, az utolsó aktivitás után kb. 20–30 perccel, hétköznap 8–20 óra között. Mobilra ment a hideg üzenet → SMS (ékezet nélkül); ha a hideg levél ment ki → e-mail a helyi segítő nevében."))}</p>` +
    `<p class="rp-note">${esc(T(lang, "Nem kap üzenetet: aki leiratkozott, „ne keressük” jelű, válaszolt bármelyik üzenetünkre (ugyanazzal a számmal / címmel más leadje sem), próbázik, rendelt, vagy akinek a címe / száma egy másik leadnél már kapott."))}</p>` +
    (d.flash ? `<p class="rp-pill rp-pill--xs">${esc(d.flash)}</p>` : "") +
    `</div>`;

  const rows = d.rows;
  const n = rows.length;
  const kbox = (t: string, v: string, sub: string): string =>
    `<div class="con-kbox"><div class="con-kbox__t">${esc(t)}</div><div class="con-kbox__r"><span class="con-kbox__v">${esc(v)}</span></div><div class="con-kbox__s">${esc(sub)}</div></div>`;
  const kpis =
    `<div class="con-kstrip rp-kstrip rp-kstrip--5">` +
    kbox(T(lang, "Kiment"), String(n), T(lang, "{w} vár (még olvas / ablakon kívül)", { w: d.waiting.length })) +
    kbox(T(lang, "Visszajött"), String(rows.filter((r) => r.came).length), T(lang, "24 órán belül")) +
    kbox(T(lang, "Kérdezett"), String(rows.filter((r) => r.asked).length), T(lang, "a „Kérdése van?” résznél, 24 órán belül")) +
    kbox(T(lang, "Indított"), String(rows.filter((r) => r.started).length), T(lang, "próbát, 24 órán belül")) +
    kbox(T(lang, "Leiratkozott"), String(rows.filter((r) => r.unsub).length), T(lang, "24 órán belül")) +
    `</div>`;

  const chips =
    `<div class="rp-filt"><div class="rp-chips" role="group" aria-label="${esc(T(lang, "Kiváltó"))}">` +
    BEHAVIOR_FILTERS.map((f) => `<a href="/viselkedes-uzenetek${f === "all" ? "" : `?f=${f}`}"${f === d.filter ? ' class="on"' : ""}>${esc(FILTER_LABEL(lang)[f])}</a>`).join("") +
    `</div></div>`;

  let list: string;
  if (d.filter === "stopped") {
    list = d.stopped.length
      ? `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Lead"))}</th><th>${esc(T(lang, "Kiváltó"))}</th><th>${esc(T(lang, "Mikor"))}</th><th>${esc(T(lang, "Miért nem ment"))}</th></tr></thead><tbody>` +
        d.stopped
          .map(
            (c) =>
              `<tr><td><a href="/lead/${esc(c.leadId)}">${esc(c.leadName)}</a></td><td>${esc(TRIGGER_LABEL(lang)[c.trigger!])}</td><td>${esc(fmtAt(c.triggerAt))}</td><td>${esc(BEHAVIOR_EXCLUSION_LABEL[c.excluded!])}</td></tr>`,
          )
          .join("") +
        `</tbody></table></div>`
      : `<p class="rp-q">${esc(T(lang, "A bekapcsolás óta egy leállító szabály sem tartott vissza üzenetet."))}</p>`;
  } else {
    const shown = d.filter === "all" ? rows : rows.filter((r) => r.trigger === d.filter);
    list = shown.length
      ? shown
          .map(
            (r) =>
              `<details class="rp-tr"><summary><b>${esc(r.name)}</b>` +
              `<span>${esc(TRIGGER_LABEL(lang)[r.trigger])} → ${esc(MESSAGE_LABEL(lang)[r.trigger])} · ${esc(r.channel === "sms" ? "SMS" : T(lang, "e-mail"))} · ${esc(fmtAt(r.sentAt))}</span>` +
              `<span class="rp-q">${esc(T(lang, "24 órán belül: {o}", { o: outcome(r, lang) }))}</span></summary>` +
              `<p class="rp-note">${esc(T(lang, "A lépés ideje: {t}", { t: fmtAt(r.triggerAt) }))} · <a href="/lead/${esc(r.leadId)}">${esc(T(lang, "A lead lapja"))}</a></p>` +
              (r.body ? `<pre class="rp-note" style="white-space:pre-wrap">${esc(r.body)}</pre>` : "") +
              `</details>`,
          )
          .join("")
      : `<p class="rp-q">${esc(T(lang, "Még nem ment ki viselkedés-üzenet."))}</p>`;
  }

  const agg = (["return", "price", "start"] as const)
    .map((t) => {
      const g = rows.filter((r) => r.trigger === t);
      return `<tr><td>${esc(TRIGGER_LABEL(lang)[t])}</td><td class="num">${g.length}</td><td class="num">${g.filter((r) => r.came).length}</td><td class="num">${g.filter((r) => r.asked).length}</td><td class="num">${g.filter((r) => r.started).length}</td><td class="num">${g.filter((r) => r.unsub).length}</td></tr>`;
    })
    .join("");
  const summary =
    `<div class="tblwrap"><table class="rp-tbl"><thead><tr><th>${esc(T(lang, "Kiváltó"))}</th><th class="num">${esc(T(lang, "Kiment"))}</th><th class="num">${esc(T(lang, "Visszajött"))}</th><th class="num">${esc(T(lang, "Kérdezett"))}</th><th class="num">${esc(T(lang, "Indított"))}</th><th class="num">${esc(T(lang, "Leiratk."))}</th></tr></thead><tbody>${agg}</tbody></table></div>`;

  const body =
    sw +
    kpis +
    `<div class="panel"><h2>${esc(T(lang, "Ki mit kapott"))} <span class="rp-q">— ${esc(T(lang, "koppints egy sorra: a kiment szöveg"))}</span></h2>${chips}<div class="rp-trs">${list}</div></div>` +
    `<div class="panel"><h2>${esc(T(lang, "Kiváltónként"))} <span class="rp-q">— ${esc(T(lang, "mi lett belőle 24 órán belül"))}</span></h2>${summary}</div>`;
  return layout(
    T(lang, "Viselkedés-üzenetek"),
    `<div class="con-ph"><h1>${esc(T(lang, "Viselkedés-üzenetek"))} ${helpLink("console.behavior_message")}</h1></div>${body}`,
    { active: "/viselkedes-uzenetek" },
  );
}

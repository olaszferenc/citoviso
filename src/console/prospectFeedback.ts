// The SPOKEN exit reason — one-tap micro-survey (ADR-0322 ④/B, riport README 19).
//
// Three places ask the same question, one endpoint stores it:
//   (a) the mock page, after the escalation offer is dismissed (cit-configurator.js, JSON)
//   (b) the unsubscribe page, AFTER the confirmation (plain <form>, works without JS)
//   (c) the reminder mail's "why" link → a confirmation page; the POST decides (ADR-0291:
//       a mail scanner's GET answers nothing).
//   (d) ADR-0348: the retroactive trial letter's three one-tap answers → the same page in its
//       campaign form (`?forras=proba&ok=<reason>`): the tapped answer arrives PRE-SELECTED,
//       all five stay on offer, and only the POST stores it (source 'trial_mail').
//
// ⛔ What this is NOT: tracking. It is an answer the person chose to give. It carries no
// name and no contact field — only the prospect it belongs to (the token), the view it
// came from (when there is one), which of the three places asked, the reason and an
// optional short text for "Más…".

import { sql } from "kysely";
import { db } from "../db/client.js";
import { T } from "../i18n/mail.js";
import { loadPack } from "../i18n/packs.js";
import { isTrialMailReason } from "../email/trialCampaignEmail.js";

export const FEEDBACK_SOURCES = ["escalation_dismiss", "unsubscribe", "reminder_link", "trial_mail"] as const;
export const FEEDBACK_REASONS = ["expensive", "not_now", "distrust", "have_site", "other"] as const;
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

/** Max stored free-text length (the DB CHECK says the same). */
export const FEEDBACK_TEXT_MAX = 300;

export function isFeedbackSource(v: unknown): v is FeedbackSource {
  return typeof v === "string" && (FEEDBACK_SOURCES as readonly string[]).includes(v);
}
export function isFeedbackReason(v: unknown): v is FeedbackReason {
  return typeof v === "string" && (FEEDBACK_REASONS as readonly string[]).includes(v);
}

/**
 * Normalise the free text: only with reason 'other'; control characters and angle
 * brackets out, whitespace collapsed, ≤300 chars. Stored as PLAIN text — every reader
 * escapes on output (escaping here as well would show "&amp;" on the report page).
 */
export function cleanFeedbackText(reason: FeedbackReason, raw: unknown): string | null {
  if (reason !== "other" || typeof raw !== "string") return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FEEDBACK_TEXT_MAX)
    .trim();
  return s || null;
}

export type FeedbackOutcome = "created" | "updated" | "bad_view";

/**
 * Store one answer. ONE ROW PER KEY, THE LATEST ANSWER WINS (ADR-0350, IT A-07): the key
 * is prospect + source + view (without a view — unsubscribe page, reminder link, trial
 * letter — prospect + source). A repeat overwrites the reason and text; a double tap
 * writes the same answer again. The key is unique in the DATABASE (0102), so parallel
 * POSTs cannot leave two rows behind.
 *
 * ⛔ It used to be "the first answer wins, the rest are `duplicate`": a changed answer
 * was dropped silently while the page thanked the person for it.
 */
export async function recordProspectFeedback(input: {
  readonly prospectId: string;
  readonly source: FeedbackSource;
  readonly reason: FeedbackReason;
  readonly text: string | null;
  readonly viewId: string | null;
}): Promise<FeedbackOutcome> {
  if (input.viewId) {
    // The view must belong to the token's prospect — no cross-prospect writes.
    const v = await db
      .selectFrom("mock_view")
      .select("id")
      .where("id", "=", input.viewId)
      .where("prospect_id", "=", input.prospectId)
      .executeTakeFirst();
    if (!v) return "bad_view";
  }
  const row = await db
    .insertInto("prospect_feedback")
    .values({
      prospect_id: input.prospectId,
      mock_view_id: input.viewId,
      source: input.source,
      reason: input.reason,
      text: input.text,
    })
    .onConflict((oc) =>
      oc.constraint("prospect_feedback_one_answer").doUpdateSet({
        reason: input.reason,
        text: input.text,
        updated_at: sql`now()`,
      }),
    )
    .returning(sql<boolean>`xmax = 0`.as("inserted"))
    .executeTakeFirstOrThrow();
  return row.inserted ? "created" : "updated";
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Load the lead-language pack (a no-op for Hungarian) before rendering with T(). */
export async function feedbackLang(lang: string | null): Promise<string> {
  const l = lang || "hu";
  try {
    await loadPack(l);
  } catch {
    /* a missing pack falls back to the Hungarian source, never to an error page */
  }
  return l;
}

/**
 * The five options, in the approved order (riport README 19).
 *
 * Elek2 Ú4: on the trial letter's answer page the "distrust" option wears the LETTER's
 * wording ("Nem értem, vagy nem bízom benne") — the person tapped that button a moment
 * ago, and the pre-selected answer must read as the one they chose. The other pages keep
 * the riport contract's wording.
 */
function optionLabels(lang: string, source: FeedbackSource): readonly [FeedbackReason, string][] {
  return [
    ["expensive", T(lang, "Drágának találom")],
    ["not_now", T(lang, "Most nem időszerű")],
    [
      "distrust",
      source === "trial_mail"
        ? T(lang, "Nem értem, vagy nem bízom benne")
        : T(lang, "Nem bízom benne, vagy nem értem"),
    ],
    ["have_site", T(lang, "Van már honlapom, nem kell")],
    ["other", T(lang, "Más…")],
  ];
}

/**
 * Stylesheet for the server-rendered form. The console layout loads citui.css, so every
 * colour is a --citui-* token. The "Más…" text field and the disabled look of
 * "Elküldöm" are CSS (:has), the "no option, no send" rule is the radios' `required` —
 * the form needs no JavaScript at all.
 */
const FORM_CSS =
  `<style>` +
  // display:block — the console sheet sets forms inline, which broke the frame into
  // fragments (seen on the screenshot). Inside a .panel the panel IS the frame.
  `.cit-fb{display:block;border:1px solid var(--citui-line);border-radius:14px;padding:14px 16px;background:var(--citui-surface);max-width:420px;margin:18px auto 0;text-align:left}` +
  `.panel .cit-fb{border:0;background:none;padding:0}` +
  `.cit-fb p.cit-fb-q{margin:0 0 10px;font-size:13.5px;font-weight:600;color:var(--citui-ink)}` +
  `.cit-fb fieldset{border:0;margin:0;padding:0;display:grid;gap:6px}` +
  `.cit-fb legend{padding:0}` +
  `.cit-fb label.cit-fb-opt{position:relative;display:flex;align-items:center;border:1px solid var(--citui-line-strong);background:var(--citui-panel);border-radius:var(--citui-radius-pill);min-height:44px;padding:0 14px;font:500 13px var(--citui-font-text);color:var(--citui-ink);cursor:pointer}` +
  `.cit-fb label.cit-fb-opt input{position:absolute;opacity:0;width:1px;height:1px}` +
  `.cit-fb label.cit-fb-opt:has(input:focus-visible){outline:2px solid var(--citui-cyan-500);outline-offset:2px}` +
  `.cit-fb label.cit-fb-opt:has(input:checked){background:var(--citui-navy-900);color:var(--citui-ink-inverse);border-color:var(--citui-navy-900)}` +
  `.cit-fb textarea{display:none;width:100%;box-sizing:border-box;min-height:56px;border:1px solid var(--citui-line);border-radius:10px;padding:8px 10px;font:13px var(--citui-font-text);margin-top:6px}` +
  `.cit-fb:has(input[value="other"]:checked) textarea{display:block}` +
  `.cit-fb .cit-fb-foot{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}` +
  `.cit-fb .cit-fb-foot button{min-height:44px}` +
  `form.cit-fb button.cit-fb-skip{appearance:none;border:0;background:transparent;background-image:none;box-shadow:none;padding:0 12px;font:500 13px var(--citui-font-text);color:var(--citui-muted);cursor:pointer}` +
  `.cit-fb:not(:has(input[name="reason"]:checked)) .cit-fb-send{opacity:.5}` +
  `.cit-fb-done{max-width:420px;margin:18px auto 0;font-size:13px;font-weight:600;color:var(--citui-ok-ink)}` +
  `</style>`;

/**
 * The question line. ⚖️ An opted-out person is NOT promised a better offer (jog-őr FLAG
 * 2026-10-04: "segít jobbat kínálnunk" right under "Nem keressük többé" suggests a future
 * approach) — on the unsubscribe page the same question is asked neutrally and says that
 * answering does not bring us back.
 */
function questionText(source: FeedbackSource, lang: string): string {
  return source === "unsubscribe"
    ? T(lang, "Ha megírja, mi tartotta vissza, abból tanulunk. Nem kötelező, és ettől sem keressük újra.")
    : T(lang, "Mi tartotta vissza? Egy koppintás, segít jobbat kínálnunk.");
}

/**
 * The survey as a plain POST form (unsubscribe page, reminder-link page). "Elküldöm"
 * submits the chosen reason; "Inkább nem" submits `skip` and stores nothing.
 */
export function feedbackFormHtml(
  token: string,
  source: FeedbackSource,
  lang: string,
  /** ADR-0348: the answer tapped in the trial letter — shown CHECKED, never stored by the GET. */
  preselect: FeedbackReason | null = null,
): string {
  const action = `/p/${encodeURIComponent(token)}/feedback`;
  const opts = optionLabels(lang, source)
    .map(
      ([v, label], i) =>
        `<label class="cit-fb-opt"><input type="radio" name="reason" value="${v}"${i === 0 ? " required" : ""}${v === preselect ? " checked" : ""}>${esc(label)}</label>`,
    )
    .join("");
  // The trial page asks the question in its heading (approved mock) — the legend then names
  // the group for a screen reader only, instead of printing the question twice.
  const legend =
    source === "trial_mail"
      ? `<legend style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${esc(T(lang, "Mi tartja vissza?"))}</legend>`
      : `<legend><p class="cit-fb-q">${esc(questionText(source, lang))}</p></legend>`;
  return (
    FORM_CSS +
    `<form class="cit-fb" data-cit-feedback="${source}" method="post" action="${action}">` +
    `<input type="hidden" name="source" value="${source}">` +
    `<fieldset>${legend}` +
    opts +
    `</fieldset>` +
    `<textarea name="text" maxlength="${FEEDBACK_TEXT_MAX}" placeholder="${esc(T(lang, "Írja le röviden (nem kötelező)"))}" aria-label="${esc(T(lang, "Más…"))}"></textarea>` +
    `<div class="cit-fb-foot">` +
    `<button type="submit" class="citui-btn citui-btn--primary cit-fb-send">${esc(T(lang, "Elküldöm"))}</button>` +
    `<button type="submit" class="cit-fb-skip ghost" name="skip" value="1" formnovalidate>${esc(T(lang, "Inkább nem"))}</button>` +
    `</div></form>`
  );
}

/**
 * The answer page after the form's POST (thanks, or the skip acknowledgement).
 *
 * Elek2 #18: it used to be one sentence and nothing else — a dead end for someone who came
 * from the plan's letter. From the reminder link and the trial letter it now leads back to
 * the plan (/p/<token>, the „14 nap ingyen” pill is one tap away there). ⚖️ NOT from the
 * unsubscribe page: an opted-out person is not pulled back (§C.1, the jog-őr FLAG of
 * 2026-10-04 on the same page).
 */
export function feedbackDoneHtml(
  lang: string,
  skipped: boolean,
  ctx: { readonly token: string; readonly source: FeedbackSource | null } | null = null,
): string {
  const msg = skipped
    ? T(lang, "Rendben, nem kérdezzük többet.")
    : T(lang, "Köszönjük — a válasz csak ehhez a megkereséshez kapcsolódik, nevet nem kérünk.");
  const back =
    ctx && (ctx.source === "trial_mail" || ctx.source === "reminder_link")
      ? `<p style="margin:14px 0 0"><a class="citui-btn citui-btn--primary" data-cit-fb-back href="/p/${encodeURIComponent(ctx.token)}">${esc(T(lang, "Vissza a honlap-tervhez"))}</a></p>`
      : "";
  return (
    FORM_CSS +
    `<div class="panel" data-cit-feedback-done style="max-width:480px;margin:48px auto;text-align:center">` +
    `<p class="cit-fb-done">${esc(msg)}</p>${back}</div>`
  );
}

/**
 * GET /p/:token/why — the reminder mail's link. It SHOWS the question and records
 * nothing (ADR-0291): the answer is the POST.
 */
export function feedbackWhyPageBody(token: string, lang: string): string {
  return (
    `<div class="panel" data-cit-feedback-why style="max-width:480px;margin:48px auto;text-align:center">` +
    `<h2>${esc(T(lang, "Nem aktuális?"))}</h2>` +
    `<p class="mut">${esc(T(lang, "Ha elárulja, miért, legközelebb jobbat kínálunk. A válasz nem kötelező, és nem iratkoztatja le."))}</p>` +
    feedbackFormHtml(token, "reminder_link", lang) +
    // ⚖️ §C.1: the way out stays one tap away on every page the outreach leads to (jog-őr
    // FLAG 2026-10-04) — someone who clicked this line meaning "stop" must find it here.
    `<p class="mut small" style="margin:16px 0 0">${esc(T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, itt leiratkozhat:"))} ` +
    `<a href="/p/${encodeURIComponent(token)}/unsubscribe" style="display:inline-block;padding:6px 4px">${esc(T(lang, "Leiratkozom"))}</a></p>` +
    `</div>`
  );
}

/**
 * The `ok=` value of a trial-letter link, if it may pre-select an answer: only the three the
 * letter offers (TRIAL_MAIL_REASONS). Anything else — a typo, a hand-made URL — selects nothing.
 */
export function trialWhyPreselect(raw: string | null): FeedbackReason | null {
  return isTrialMailReason(raw) ? raw : null;
}

/**
 * GET /p/:token/why?forras=proba&ok=<reason> — the retroactive trial letter's answer page
 * (approved mock, ADR-0348). Like the reminder page it SHOWS and records nothing (ADR-0291):
 * the tapped answer is pre-selected, all five are offered, the POST stores it as 'trial_mail'.
 * The unsubscribe stays one tap away (§C.1) — and the page says the answer is not one.
 */
export function feedbackTrialWhyPageBody(token: string, lang: string, preselect: FeedbackReason | null): string {
  return (
    `<div class="panel" data-cit-feedback-why="trial_mail" style="max-width:480px;margin:48px auto;text-align:center">` +
    `<h2>${esc(T(lang, "Mi tartja vissza?"))}</h2>` +
    `<p class="mut">${esc(T(lang, "A válasz nem kötelező, és nem iratkoztatja le. Egyetlen kérdés, nevet nem kérünk."))}</p>` +
    feedbackFormHtml(token, "trial_mail", lang, preselect) +
    `<p class="mut small" style="margin:16px 0 0">${esc(T(lang, "Ha nem szeretne több megkeresést kapni tőlünk, itt leiratkozhat:"))} ` +
    `<a href="/p/${encodeURIComponent(token)}/unsubscribe" style="display:inline-block;padding:6px 4px">${esc(T(lang, "Leiratkozom"))}</a></p>` +
    `</div>`
  );
}

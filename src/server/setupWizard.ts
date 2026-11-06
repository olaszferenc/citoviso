// ADR-0429 — the setup walk's state machine (server-rendered forms, no client state).
// Approved plan: assets/design-refs/tenant-admin/modul-statusz/ (README = what binds).
//
// GET  /admin/beallitas[?t=<topic>&s=<step>]  → the wizard (full screen)
// POST /admin/beallitas  act = next | back | skip | later | hide | unhide | returned
//
// The STATUS always comes from the real data (src/tenant/moduleSetup.ts); site_setup_progress
// only remembers where the owner is in the questions, the answers not stored elsewhere, and
// what was skipped/hidden. Every answer is written through the existing write functions
// (src/server/setupSteps.ts), so the module screens and this walk can never disagree.

import { db } from "../db/client.js";
import { T } from "../i18n/mail.js";
import { formatNumber } from "../text/money.js";
import {
  bookableOf,
  guestSentence,
  holds,
  isOpenState,
  isSettledState,
  lettingMode,
  loadSetupCtx,
  roomsOf,
  topicPassed,
  topicViews,
  SETUP_TOPICS,
  type SetupCtx,
  type TopicView,
} from "../tenant/moduleSetup.js";
import { getTenantModules } from "../tenant/modules.js";
import { unitPriceStatus } from "../tenant/prices.js";
import { exportLinksHtml, STEP_SETS, type SetupStep, type StepEnv } from "./setupSteps.js";
import {
  cartHandoffPage,
  previewHtml,
  type PreviewData,
  type WalkItem,
  type WizardStepView,
} from "./setupWizardViews.js";

export interface WalkSession {
  readonly tenantId: string;
  readonly tenantUserId: string;
}

// ── progress ────────────────────────────────────────────────────────────────────────
interface ProgressPatch {
  step?: number;
  draft?: Record<string, unknown>;
  skipped?: boolean;
  hidden?: boolean;
  completed?: boolean;
}
export async function setProgress(siteId: string, item: string, patch: ProgressPatch): Promise<void> {
  const now = new Date();
  const cur = await db
    .selectFrom("site_setup_progress")
    .select(["draft"])
    .where("site_id", "=", siteId)
    .where("item", "=", item)
    .executeTakeFirst();
  const draft = patch.draft ? { ...((cur?.draft ?? {}) as Record<string, unknown>), ...patch.draft } : undefined;
  const set = {
    ...(patch.step !== undefined ? { step: patch.step } : {}),
    ...(draft ? { draft: JSON.stringify(draft) } : {}),
    ...(patch.skipped !== undefined ? { skipped_at: patch.skipped ? now : null } : {}),
    ...(patch.hidden !== undefined ? { hidden_at: patch.hidden ? now : null } : {}),
    ...(patch.completed !== undefined ? { completed_at: patch.completed ? now : null } : {}),
  };
  await db
    .insertInto("site_setup_progress")
    .values({ site_id: siteId, item, ...set })
    .onConflict((oc) => oc.columns(["site_id", "item"]).doUpdateSet({ ...set, updated_at: now }))
    .execute();
}

// ── the walk ────────────────────────────────────────────────────────────────────────
const inWalk = (v: TopicView): boolean => v.topic.setup.kind === "steps" || v.topic.setup.returns;

function pageHref(v: TopicView): string {
  return v.topic.setup.kind === "page" ? v.topic.setup.href : `/admin/beallitas?t=${encodeURIComponent(v.topic.id)}`;
}

export function walkItems(ctx: SetupCtx, lang: string): WalkItem[] {
  return topicViews(ctx, lang)
    .filter(inWalk)
    .map((v) => ({
      id: v.topic.id,
      title: v.topic.title(lang),
      icon: v.topic.icon,
      group: v.topic.group,
      st: v.status.st,
      line: v.status.line,
      lock: v.lock,
      passed: topicPassed(ctx, v),
      skipped: !!ctx.progress.get(v.topic.id)?.skipped,
      href: pageHref(v),
      steps: v.topic.setup.kind === "steps",
    }));
}

/** The topic the walk is on: the requested one (if reachable), else the first open, unskipped one. */
export function currentTopic(items: readonly WalkItem[], requested: string | null): string | null {
  const req = requested ? items.find((x) => x.id === requested) : undefined;
  if (req) return req.lock ? (req.lock.first && items.some((x) => x.id === req.lock!.first) ? req.lock.first : null) : req.id;
  return (
    items.find((x) => !x.passed && !x.lock && !x.skipped)?.id ??
    items.find((x) => !x.passed && !x.lock && x.st !== "opt")?.id ??
    null
  );
}

function envOf(ctx: SetupCtx, lang: string, s: WalkSession, siteId: string, topic: string): StepEnv {
  return { ctx, lang, draft: ctx.progress.get(topic)?.draft ?? {}, tenantId: s.tenantId, siteId, actor: s.tenantUserId };
}
function stepsOf(env: StepEnv, topic: string): SetupStep[] {
  return STEP_SETS[topic]?.(env) ?? [];
}

function prevTopic(items: readonly WalkItem[], id: string): WalkItem | null {
  for (let i = items.findIndex((x) => x.id === id) - 1; i >= 0; i--) if (!items[i]!.lock) return items[i]!;
  return null;
}

// ── preview ─────────────────────────────────────────────────────────────────────────
export function previewOf(ctx: SetupCtx, lang: string, siteName: string, host: string): string {
  const mode = lettingMode(ctx);
  const views = topicViews(ctx, lang);
  const st = (id: string): TopicView | undefined => views.find((v) => v.topic.id === id);
  const pricing = holds(ctx, "pricing");
  const p: PreviewData = {
    siteName,
    host,
    lettingKnown: mode !== null,
    roomsHidden: roomsOf(ctx).length > 0 && !holds(ctx, "rooms"),
    units: bookableOf(ctx).map((u) => {
      const ps = unitPriceStatus([...(ctx.unitPrices.get(u.id) ?? [])], u, ctx.today);
      const base = (ctx.unitPrices.get(u.id) ?? []).find((x) => x.isBase && !x.validFrom && !x.validTo);
      return {
        name: u.name,
        cap: u.capacity,
        price: !pricing ? null : ps === "on_request" ? T(lang, "árajánlat") : base ? T(lang, "{p} Ft / éj", { p: formatNumber(base.amount, lang) }) : ps === "none" ? T(lang, "nincs ár") : T(lang, "időszakos ár"),
        priceMissing: pricing && ps === "none",
      };
    }),
    withHouse: mode === "rooms",
    askCap: holds(ctx, "rooms") || holds(ctx, "booking"),
    hours: holds(ctx, "hours") ? (st("hours") && isSettledState(st("hours")!.status.st) ? st("hours")!.status.line : T(lang, "Érkezés / távozás: —")) : null,
    hoursMissing: holds(ctx, "hours") && !!st("hours") && isOpenState(st("hours")!.status.st),
    calendarLine: holds(ctx, "booking") && st("calendar") ? st("calendar")!.status.line : null,
    cta: !holds(ctx, "booking")
      ? T(lang, "Időpontot kérek")
      : st("pricing") && st("pricing")!.status.st === "done"
        ? T(lang, "Foglalási kérés elküldése")
        : T(lang, "Árajánlatot kérek"),
  };
  return previewHtml(p, lang);
}

// ── one step on screen ──────────────────────────────────────────────────────────────
async function stepView(
  ctx: SetupCtx,
  lang: string,
  s: WalkSession,
  siteId: string,
  items: readonly WalkItem[],
  topicId: string,
  wanted: number | null,
  siteUrl: string | null,
): Promise<WizardStepView | null> {
  const topic = SETUP_TOPICS.find((t) => t.id === topicId);
  const item = items.find((x) => x.id === topicId);
  if (!topic || !item) return null;
  const prev = prevTopic(items, topicId);
  if (topic.setup.kind === "page") {
    return {
      topicId, topicTitle: item.title, index: 0, count: 1, question: item.title, lead: item.line, fieldsHtml: "", kb: topic.kb, st: item.st,
      backLabel: prev ? T(lang, "Vissza: {t}", { t: prev.title }) : null,
      pageHref: `${topic.setup.href}&vissza=varazslo&vt=${encodeURIComponent(topicId)}`,
      pageLabel: topic.setup.label(lang), last: true, upload: false,
    };
  }
  const env = envOf(ctx, lang, s, siteId, topicId);
  const steps = stepsOf(env, topicId);
  if (!steps.length) return null;
  // A finished topic re-opens at its first question (with the saved values); an unfinished one where it was left.
  const saved = item.passed ? 0 : (ctx.progress.get(topicId)?.step ?? 0);
  const i = Math.max(0, Math.min(steps.length - 1, wanted ?? saved));
  const step = steps[i]!;
  let fieldsHtml = step.render(env);
  if (topicId === "calendar" && step.key === "export") {
    const portals = Array.isArray(env.draft.portals) ? (env.draft.portals as string[]) : [];
    fieldsHtml = await exportLinksHtml(ctx, lang, portals, siteUrl);
  }
  return {
    topicId, topicTitle: item.title, index: i, count: steps.length, question: step.question, lead: step.lead, fieldsHtml, kb: topic.kb, st: item.st,
    backLabel: i > 0 ? T(lang, "Vissza") : prev ? T(lang, "Vissza: {t}", { t: prev.title }) : null,
    pageHref: null, pageLabel: null, last: i === steps.length - 1, upload: step.writes === "/admin/photos",
  };
}

export interface WalkScreen {
  readonly items: WalkItem[];
  readonly step: WizardStepView | null;
  readonly preview: string;
  readonly guestLine: string;
  readonly ctx: SetupCtx;
}
export async function walkScreen(o: {
  readonly session: WalkSession;
  readonly siteId: string;
  readonly lang: string;
  readonly requested: string | null;
  readonly stepIndex: number | null;
  readonly siteName: string;
  readonly host: string;
  readonly siteUrl: string | null;
}): Promise<WalkScreen> {
  const ctx = await loadSetupCtx(o.session.tenantId, o.siteId);
  const items = walkItems(ctx, o.lang);
  const cur = currentTopic(items, o.requested);
  const step = cur ? await stepView(ctx, o.lang, o.session, o.siteId, items, cur, cur === o.requested ? o.stepIndex : null, o.siteUrl) : null;
  return { items, step, preview: previewOf(ctx, o.lang, o.siteName, o.host), guestLine: guestSentence(ctx, o.lang), ctx };
}

/** The step a module page embeds for its topic (or null = nothing to embed). */
export async function moduleTopicStep(o: {
  readonly session: WalkSession;
  readonly siteId: string;
  readonly lang: string;
  readonly moduleId: string;
  readonly stepIndex: number | null;
  readonly siteUrl: string | null;
}): Promise<{ item: WalkItem; step: WizardStepView | null; hidden: boolean } | null> {
  const ctx = await loadSetupCtx(o.session.tenantId, o.siteId);
  const items = walkItems(ctx, o.lang).filter((x) => x.steps);
  const own = items.filter((x) => SETUP_TOPICS.find((t) => t.id === x.id)!.modules[0] === o.moduleId);
  const item = own.find((x) => !x.passed && !x.lock) ?? own[0];
  if (!item) return null;
  const p = ctx.progress.get(item.id);
  const inProgress = !!p && p.step > 0 && !p.completed;
  const show = (!item.passed || inProgress) && !item.lock;
  const step = await stepView(ctx, o.lang, o.session, o.siteId, items, item.id, o.stepIndex, o.siteUrl);
  return { item, step: show ? step : null, hidden: !!p?.hidden && !inProgress ? true : !show };
}

// ── POST ────────────────────────────────────────────────────────────────────────────
export interface WalkPostResult {
  /** Where to go next (302). */
  readonly redirect?: string;
  /** A page to answer with instead (the cart hand-off). */
  readonly html?: string;
  /** The guest page changed — re-render the snapshot before redirecting. */
  readonly rerender: boolean;
}

function walkUrl(topic: string | null, step: number | null, extra = ""): string {
  const q = [topic ? `t=${encodeURIComponent(topic)}` : "", step !== null ? `s=${step}` : "", extra].filter(Boolean).join("&");
  return `/admin/beallitas${q ? `?${q}` : ""}`;
}
function moduleUrl(m: string, topic: string, step: number | null, extra = ""): string {
  return `/admin?tab=modulok&m=${encodeURIComponent(m)}&st=${encodeURIComponent(topic)}${step !== null ? `&ss=${step}` : ""}${extra ? `&${extra}` : ""}`;
}

export async function walkPost(o: {
  readonly session: WalkSession;
  readonly siteId: string;
  readonly lang: string;
  readonly form: URLSearchParams;
}): Promise<WalkPostResult> {
  const { session, siteId, lang, form } = o;
  const act = form.get("act") ?? "next";
  const topic = form.get("t") ?? "";
  const from = form.get("from"); // a module page's own panel
  const stepIdx = Number(form.get("s") ?? "0") || 0;
  const back = (t: string | null, s: number | null, extra = ""): string => (from && t ? moduleUrl(from, t, s, extra) : walkUrl(t, s, extra));

  if (act === "later") {
    await setProgress(siteId, "_welcome", { completed: true });
    return { redirect: "/admin", rerender: false };
  }
  const ctx = await loadSetupCtx(session.tenantId, siteId);
  const items = walkItems(ctx, lang);
  const item = items.find((x) => x.id === topic);
  if (!item) return { redirect: walkUrl(null, null), rerender: false };

  if (act === "hide" || act === "unhide") {
    await setProgress(siteId, topic, { hidden: act === "hide", ...(act === "unhide" && item.passed ? { step: 0, completed: false } : {}) });
    return { redirect: back(topic, null), rerender: false };
  }
  if (act === "skip") {
    await setProgress(siteId, topic, { skipped: true, step: 0 });
    const waiting = items.filter((x) => SETUP_TOPICS.find((t) => t.id === x.id)!.requires.some((r) => r.topic === topic)).map((x) => x.title);
    const msg = item.st === "opt" ? T(lang, "Kihagyva (nem kötelező): {t}", { t: item.title }) : T(lang, "A végére tettük: {t}", { t: item.title }) + (waiting.length ? " — " + T(lang, "erre vár: {w}", { w: waiting.join(", ") }) : "");
    return { redirect: walkUrl(null, null, `ok=${encodeURIComponent(msg)}`), rerender: false };
  }
  if (act === "returned") {
    // Back from a page the walk opened: the topic moves out of the way (its status still comes from the data).
    await setProgress(siteId, topic, { skipped: !isSettledState(item.st), completed: true, step: 0 });
    return { redirect: walkUrl(null, null), rerender: false };
  }

  const env = envOf(ctx, lang, session, siteId, topic);
  const steps = stepsOf(env, topic);
  const cur = steps[Math.max(0, Math.min(steps.length - 1, stepIdx))];

  if (act === "back") {
    if (stepIdx > 0) {
      await setProgress(siteId, topic, { step: stepIdx - 1 });
      return { redirect: back(topic, stepIdx - 1), rerender: false };
    }
    const prev = prevTopic(items, topic);
    if (!prev || from) return { redirect: back(topic, 0), rerender: false };
    const pSteps = prev.steps ? stepsOf(envOf(ctx, lang, session, siteId, prev.id), prev.id) : [];
    const last = Math.max(0, pSteps.length - 1);
    await setProgress(siteId, prev.id, { step: last });
    return { redirect: walkUrl(prev.id, last), rerender: false };
  }

  // act === "next"
  if (item.lock) return { redirect: back(item.lock.first ?? null, null), rerender: false };
  if (!item.steps) {
    await setProgress(siteId, topic, { skipped: !isSettledState(item.st), completed: true, step: 0 });
    return { redirect: walkUrl(null, null), rerender: false };
  }
  if (!cur) return { redirect: back(null, null), rerender: false };
  const res = await cur.save(env, form);
  if (res.draft) await setProgress(siteId, topic, { draft: res.draft });
  if (res.error) {
    await setProgress(siteId, topic, { step: stepIdx });
    return { redirect: back(topic, stepIdx, `e=${encodeURIComponent(res.error)}`), rerender: false };
  }
  if (res.cart?.length) {
    await setProgress(siteId, "_welcome", { draft: { cart: { t: topic, s: stepIdx, modules: res.cart } } });
    await setProgress(siteId, topic, { step: stepIdx });
    const mv = await getTenantModules(session.tenantId);
    const keep = mv.modules.filter((m) => m.active && !m.cancelAtPeriodEnd && !m.spine && !m.supersededBy).map((m) => m.id);
    const add = res.cart.filter((id) => !keep.includes(id)).map((id) => {
      const m = mv.modules.find((x) => x.id === id);
      return { id, name: m ? T(lang, m.label) : id, price: m ? T(lang, "{p} Ft/hó", { p: formatNumber(m.priceMonthly, lang) }) : "" };
    });
    return { html: cartHandoffPage({ lang, keep, add }), rerender: false };
  }
  // Re-read: the answer may have changed what comes next (a letting switch adds or removes steps).
  const ctx2 = await loadSetupCtx(session.tenantId, siteId);
  const steps2 = stepsOf(envOf(ctx2, lang, session, siteId, topic), topic);
  const at = steps2.findIndex((x) => x.key === cur.key);
  const nextIdx = (at < 0 ? stepIdx : at) + 1;
  if (!res.finish && nextIdx < steps2.length) {
    await setProgress(siteId, topic, { step: nextIdx, skipped: false });
    return { redirect: back(topic, nextIdx), rerender: true };
  }
  await setProgress(siteId, topic, { step: 0, completed: true, skipped: false, hidden: !!from });
  const done = T(lang, "Mentve: {t}.", { t: item.title });
  if (from) return { redirect: moduleUrl(from, topic, null, `swok=${encodeURIComponent(done)}`), rerender: true };
  return { redirect: walkUrl(null, null, `ok=${encodeURIComponent(done)}`), rerender: true };
}

/** After a purchase started from the walk: once the modules are held, continue at the same step. */
export async function cartReturnUrl(tenantId: string, siteId: string): Promise<string | null> {
  const row = await db
    .selectFrom("site_setup_progress")
    .select(["draft"])
    .where("site_id", "=", siteId)
    .where("item", "=", "_welcome")
    .executeTakeFirst();
  const cart = (row?.draft as { cart?: { t: string; s: number; modules: string[] } } | undefined)?.cart;
  if (!cart?.modules?.length) return null;
  const mv = await getTenantModules(tenantId);
  if (!cart.modules.every((id) => mv.modules.some((m) => m.id === id && m.active))) return null;
  await setProgress(siteId, "_welcome", { draft: { cart: null } });
  return walkUrl(cart.t, cart.s, "ok=paid");
}

/** Should the first login open the walk? (not seen yet, and something is left). */
export async function walkWanted(tenantId: string, siteId: string, lang: string): Promise<boolean> {
  const ctx = await loadSetupCtx(tenantId, siteId);
  if (ctx.progress.get("_welcome")?.completed) return false;
  return walkItems(ctx, lang).some((x) => !x.passed && !x.lock);
}

export async function markWalkSeen(siteId: string): Promise<void> {
  await setProgress(siteId, "_welcome", { completed: true });
}

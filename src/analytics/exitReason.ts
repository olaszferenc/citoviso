// Exit-reason inference — ONE label per non-buying mock visit, from the signals the
// visitor left on the page (scroll, dwell, panel, checkout step, errors). This is the
// "inferred" layer of ADR „Riport-modul" ④: the rules and their thresholds live HERE
// and nowhere else, so the report, the lead page and the calibration table can never
// disagree about why someone left. The "stated" layer (the micro survey) is stored in
// prospect_feedback and is compared against this, never merged into it.
//
// Confidence: "sure" = tied to a concrete event (an invalid billing form, a dismissed
// escalation offer, a redirect to the gateway); "medium" = inferred from timing only
// (the price panel opened and the visitor left within PRICE_SHOCK_SECONDS).
//
// Self-test: npx tsx scripts/exit-reason-check.mts — fixed visit fixtures → expected
// label, so a threshold tweak cannot silently relabel the pilot.

export type ExitReason =
  | "no_hook" // left within seconds, barely scrolled
  | "browsed" // read the page, touched nothing that sells
  | "played" // toggled modules / presets but never opened the price panel
  | "price_shock" // opened the price panel and left right after
  | "billing_friction" // reached the billing step and stalled / got a validation error
  | "domain_gate" // bounced off the domain gate / own-domain check
  | "module_dependency" // hit a module dependency it did not resolve
  | "payment_stall" // submitted the order or was sent to the gateway, never paid
  | "escalation_dismissed" // dismissed the escalation offer
  | "technical"; // order send failed / client error

export type Confidence = "sure" | "medium";

export interface ExitVerdict {
  readonly reason: ExitReason;
  readonly confidence: Confidence;
}

/** The ten labels in display order (the report lists them in this order). */
export const EXIT_REASONS: readonly ExitReason[] = [
  "no_hook",
  "browsed",
  "played",
  "price_shock",
  "billing_friction",
  "domain_gate",
  "module_dependency",
  "payment_stall",
  "escalation_dismissed",
  "technical",
];

/** The stated reasons of the micro survey (prospect_feedback.reason). */
export type StatedReason = "expensive" | "not_now" | "distrust" | "have_site" | "other";
export const STATED_REASONS: readonly StatedReason[] = ["expensive", "not_now", "distrust", "have_site", "other"];

/**
 * Which stated reason an inferred label "predicts" — the calibration table marks the
 * cell green when the visitor said this. A mapping, not a merge: the report shows the
 * two layers side by side (README ⑮⑯).
 */
export const EXPECTED_STATED: Readonly<Record<ExitReason, StatedReason>> = {
  no_hook: "not_now",
  browsed: "not_now",
  played: "distrust",
  price_shock: "expensive",
  billing_friction: "other",
  domain_gate: "have_site",
  module_dependency: "other",
  payment_stall: "distrust",
  escalation_dismissed: "expensive",
  technical: "other",
};

/** Thresholds — the only numbers the rules use (README ⑮: "egy helyen élnek"). */
export const THRESHOLDS = {
  /** Left within this many seconds after opening the price panel → price shock. */
  PRICE_SHOCK_SECONDS: 20,
  /** Below this dwell AND scroll → the page never hooked them. */
  NO_HOOK_SECONDS: 10,
  NO_HOOK_SCROLL_PCT: 25,
} as const;

/** What one visit left behind — built from mock_event rows by `signalsFromEvents`. */
export interface VisitSignals {
  /** Longest dwell reported (seconds; dwell / dwell_end). */
  readonly dwellSeconds: number;
  /** Deepest scroll milestone (%). */
  readonly maxScroll: number;
  /** module_add / module_remove / preset_select happened. */
  readonly moduleTouched: boolean;
  /** Seconds after the open when the price panel first opened; null = never. */
  readonly panelOpenAtSeconds: number | null;
  /** Seconds after the open when the visit ended (dwell_end), null = unknown. */
  readonly exitAtSeconds: number | null;
  readonly checkoutStep: boolean;
  readonly billingStepOpen: boolean;
  readonly billingInvalid: boolean;
  readonly domainGateDismiss: boolean;
  readonly ownDomainCheck: boolean;
  readonly moduleDependencyUnmet: boolean;
  readonly orderSubmitted: boolean;
  readonly checkoutRedirect: boolean;
  readonly escalationDismiss: boolean;
  readonly orderSendFailed: boolean;
  readonly clientError: boolean;
  /** The visit (or a later one) ended in a paid payment → no exit reason. */
  readonly paid: boolean;
}

export interface RawEvent {
  readonly type: string;
  readonly payload: unknown;
  readonly occurredAt: string | Date;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const secondsBetween = (a: string | Date, b: string | Date): number =>
  Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 1000);

/** Fold the events of ONE mock_view into signals. `paid` is the caller's knowledge. */
export function signalsFromEvents(events: readonly RawEvent[], paid = false): VisitSignals {
  const sorted = [...events].sort((x, y) => new Date(x.occurredAt).getTime() - new Date(y.occurredAt).getTime());
  const openAt = sorted.find((e) => e.type === "open")?.occurredAt ?? sorted[0]?.occurredAt ?? null;
  let dwellSeconds = 0;
  let maxScroll = 0;
  let exitAtSeconds: number | null = null;
  let panelOpenAtSeconds: number | null = null;
  const has = new Set<string>();
  for (const e of sorted) {
    const pl = (e.payload ?? {}) as Record<string, unknown>;
    has.add(e.type);
    if (e.type === "scroll") maxScroll = Math.max(maxScroll, num(pl.pct));
    if (e.type === "dwell" || e.type === "dwell_end") dwellSeconds = Math.max(dwellSeconds, num(pl.seconds));
    if (e.type === "dwell_end") exitAtSeconds = Math.max(num(pl.seconds), openAt ? secondsBetween(openAt, e.occurredAt) : 0);
    if (e.type === "panel_open" && panelOpenAtSeconds === null)
      panelOpenAtSeconds = openAt ? secondsBetween(openAt, e.occurredAt) : 0;
  }
  // No dwell_end (tab killed, beacon lost): the last event's time is the best exit estimate.
  if (exitAtSeconds === null && openAt && sorted.length > 1)
    exitAtSeconds = Math.max(dwellSeconds, secondsBetween(openAt, sorted[sorted.length - 1]!.occurredAt));
  return {
    dwellSeconds,
    maxScroll,
    moduleTouched: has.has("module_add") || has.has("module_remove") || has.has("preset_select"),
    panelOpenAtSeconds,
    exitAtSeconds,
    checkoutStep: has.has("checkout_step"),
    billingStepOpen: has.has("billing_step_open"),
    billingInvalid: has.has("billing_invalid"),
    domainGateDismiss: has.has("domain_gate_dismiss"),
    ownDomainCheck: has.has("own_domain_check"),
    moduleDependencyUnmet: has.has("module_dependency_unmet"),
    orderSubmitted: has.has("order_intent_submitted"),
    checkoutRedirect: has.has("checkout_redirect"),
    escalationDismiss: has.has("escalation_dismiss"),
    orderSendFailed: has.has("order_send_failed"),
    clientError: has.has("client_error"),
    paid,
  };
}

/**
 * The verdict for one visit. Rules fire in order — the first match wins — from the
 * most concrete evidence (an error, a gateway redirect) down to the timing-only
 * inferences. A paid visit has no exit reason (null).
 */
export function inferExitReason(s: VisitSignals): ExitVerdict | null {
  if (s.paid) return null;
  if (s.orderSendFailed || s.clientError) return { reason: "technical", confidence: "sure" };
  if (s.checkoutRedirect || s.orderSubmitted) return { reason: "payment_stall", confidence: "sure" };
  if (s.billingInvalid || s.billingStepOpen) return { reason: "billing_friction", confidence: "sure" };
  if (s.moduleDependencyUnmet) return { reason: "module_dependency", confidence: "sure" };
  if (s.domainGateDismiss || s.ownDomainCheck) return { reason: "domain_gate", confidence: "sure" };
  if (s.escalationDismiss) return { reason: "escalation_dismissed", confidence: "sure" };
  if (s.panelOpenAtSeconds !== null && !s.checkoutStep) {
    const stayedAfterPanel = s.exitAtSeconds === null ? null : s.exitAtSeconds - s.panelOpenAtSeconds;
    if (stayedAfterPanel !== null && stayedAfterPanel <= THRESHOLDS.PRICE_SHOCK_SECONDS)
      return { reason: "price_shock", confidence: "medium" };
  }
  if (s.moduleTouched && s.panelOpenAtSeconds === null) return { reason: "played", confidence: "medium" };
  if (s.dwellSeconds < THRESHOLDS.NO_HOOK_SECONDS && s.maxScroll <= THRESHOLDS.NO_HOOK_SCROLL_PCT)
    return { reason: "no_hook", confidence: "sure" };
  return { reason: "browsed", confidence: "medium" };
}

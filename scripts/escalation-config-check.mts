// ADR-0285 — the escalation offer's threshold and percent are OPERATOR-SET on /pricing
// (app_setting 'escalation_offer'; frozen plan: assets/design-refs/console/escalation-offer-admin/).
//
// What this proves — each leg is a way the setting could silently stop meaning anything:
//   ① the CONFIGURED threshold gates the minting (2 → the 2nd view mints, the 1st does not),
//      and the CONFIGURED percent lands in offer.percent (40, not the 50 default);
//   ② switched off → no offer, even far past the threshold;
//   ③ the validity rule: 2–10 opening, (outreach+1)–90 percent, 24–168 h validity, follow-up
//      ≥ 1 h and below the validity, 5–50 % intro, integers only; both cross rules mark both fields;
//   ④ the /pricing POST parse: no section → null (an old tab resets nothing), switched off →
//      the STORED numbers survive, "40%" / " 4 " normalise, "2,5" is refused;
//   ⑤ the page renders the section with the stored values and the live-offer data;
//   ⑥ ADR-0286: the configured VALIDITY lands in offer.expires_at, the configured FOLLOW-UP
//      delay decides which offers are due, a stored row missing the new keys stays valid
//      (defaults fill in), a row failing the rule is not trusted;
//   ⑦ ADR-0286 „a levél %-a köt”: after the intro percent is changed, a lead whose letter
//      already went out — opened or not — gets the percent the letter quoted; a legacy send
//      (no stamped row) gets the constant it quoted; a new send quotes and stamps the new value;
//   ⑧ every send path that stamps prospect.sent_at also stamps the intro offer (structural);
//   ⑨ ADR-XXXX the HOURLY follow-up: nothing outside 8–20 Budapest (summer AND winter time, the
//      live VPS runs in UTC); ONE mail per offer even when two runs overlap (atomic claim);
//      an expired offer is never claimed; a failed send releases the claim.
//
// Reverting ensureEscalationOffer to the ESCALATION_VISIT_THRESHOLD / ESCALATION_OFFER_PERCENT
// constants turns ① red (measured when this guard was written: 3 failures).
//
// The dev DB is SHARED by parallel worktrees: the config is set with the PROCESS-LOCAL override,
// never by writing the app_setting row; the only rows written are this run's own prospects
// (their offer/mock_view rows cascade) and they are deleted in `finally`.
//
// Run: npx tsx scripts/escalation-config-check.mts

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db/client.js";
import {
  ESCALATION_CONFIG_DEFAULT,
  ESCALATION_PERCENT_MAX,
  OUTREACH_OFFER_PERCENT,
  bestActiveOfferForProspect,
  ensureEscalationOffer,
  escalationConfigErrors,
  escalationFollowupsDue,
  escalationFromForm,
  outreachPercentForProspect,
  overrideEscalationConfigInProcess,
  parseEscalationSetting,
  type EscalationConfig,
} from "../src/payment/offers.js";
import { markProspectSent } from "../src/console/data.js";
import { claimFollowup, releaseFollowup } from "../src/payment/offers.js";
import { followupWindowBlocks, sendEscalationFollowups } from "../src/outreach/escalationFollowup.js";
import type { EmailMessage, EmailSender } from "../src/email/sender.js";
import { renderDraft } from "../src/outreach/draft.js";
import { loadPricing, pricingRegions, pricingSnapshot } from "../src/pricing.js";
import { pricingPage } from "../src/console/views.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const made: string[] = [];

const cfg = (o: Partial<EscalationConfig>): EscalationConfig => ({ ...ESCALATION_CONFIG_DEFAULT, ...o });

async function touchedProspect(tag: string, sent = true): Promise<string> {
  // gate-subject-allow: a lead-id csak a saját (bélyegzett tokenű, a végén törölt) prospect FK-horgonya, a lead tartalmát a mérés nem olvassa
  const lead = await db.selectFrom("lead").select("id").limit(1).executeTakeFirstOrThrow();
  const p = await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: `esc-config-check-${tag}-${process.pid}`, sent_at: sent ? new Date() : null } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  made.push(p.id);
  return p.id;
}

async function view(prospectId: string): Promise<void> {
  await db.insertInto("mock_view").values({ prospect_id: prospectId }).execute();
}

try {
  // ① configured threshold + percent reach the minted row.
  overrideEscalationConfigInProcess(cfg({ threshold: 2, percent: 40, offerHours: 30 }));
  const a = await touchedProspect("on");
  await view(a);
  check("① 1. megnyitás (küszöb 2) → nincs ajánlat", await ensureEscalationOffer(a), null);
  await view(a);
  const minted = await ensureEscalationOffer(a);
  check("① 2. megnyitás (küszöb 2) → ajánlat születik", minted?.kind ?? null, "escalation");
  check("① a mintázott offer.percent a KONFIGURÁLT 40", minted?.percent ?? null, 40);
  const note = await db.selectFrom("offer").select("note").where("prospect_id", "=", a).where("kind", "=", "escalation").executeTakeFirst();
  check("① a note a konfigurált küszöböt nevezi meg", /#2 /.test(note?.note ?? ""), true);
  const leftH = minted?.expiresAt ? (minted.expiresAt.getTime() - Date.now()) / 3_600_000 : -1;
  check("⑥ a lejárat a KONFIGURÁLT 30 óra (nem a 72-es alapérték)", leftH > 29.9 && leftH <= 30, true);

  // ② switched off → nothing, however many views.
  overrideEscalationConfigInProcess(cfg({ enabled: false, threshold: 2, percent: 40 }));
  const b = await touchedProspect("off");
  for (let i = 0; i < 4; i++) await view(b);
  check("② kikapcsolva → 4 megnyitás után sincs ajánlat", await ensureEscalationOffer(b), null);
  overrideEscalationConfigInProcess(null);

  // ③ the validity rule.
  const errs = (threshold: number, percent: number, more: Partial<EscalationConfig> = {}) =>
    escalationConfigErrors(cfg({ threshold, percent, ...more }));
  check("③ 3 / 50 / 72 h / 24 h / 25% (az alapérték) érvényes", errs(3, 50), []);
  check("③ 2 / 26 (alsó határok) érvényes", errs(2, OUTREACH_OFFER_PERCENT + 1), []);
  check("③ 10 / 90 (felső határok) érvényes", errs(10, 90), []);
  check("③ küszöb 1 → hiba", errs(1, 50), ["threshold"]);
  check("③ küszöb 11 → hiba", errs(11, 50), ["threshold"]);
  check("③ küszöb 2.5 → hiba", errs(2.5, 50), ["threshold"]);
  check(`③ ${OUTREACH_OFFER_PERCENT}% (= bemutatkozó) → mindkét mező hibás`, errs(3, OUTREACH_OFFER_PERCENT), ["percent", "outreachPercent"]);
  check("③ 91% → hiba", errs(3, 91), ["percent"]);
  check("③ NaN mindkettő → két hiba", errs(Number.NaN, Number.NaN), ["threshold", "percent"]);
  check("③ a felső %-határ 90", ESCALATION_PERCENT_MAX, 90);
  check("③ érvényesség 24 / 168 (határok) érvényes", [errs(3, 50, { offerHours: 24, followupHours: 1 }), errs(3, 50, { offerHours: 168 })], [[], []]);
  check("③ érvényesség 23 → hiba", errs(3, 50, { offerHours: 23, followupHours: 1 }), ["offerHours"]);
  check("③ érvényesség 169 → hiba", errs(3, 50, { offerHours: 169 }), ["offerHours"]);
  check("③ emlékeztető 0 → hiba", errs(3, 50, { followupHours: 0 }), ["followupHours"]);
  check("③ emlékeztető = érvényesség → MINDKÉT mező hibás", errs(3, 50, { offerHours: 48, followupHours: 48 }), ["offerHours", "followupHours"]);
  check("③ emlékeztető 47 < 48 érvényes", errs(3, 50, { offerHours: 48, followupHours: 47 }), []);
  check("③ bemutatkozó 5 / 50 (határok) érvényes", [errs(3, 50, { outreachPercent: 5 }), errs(3, 51, { outreachPercent: 50 })], [[], []]);
  check("③ bemutatkozó 4 → hiba", errs(3, 50, { outreachPercent: 4 }), ["outreachPercent"]);
  check("③ bemutatkozó 51 → hiba (a kereszt-szabály nem fut hibás mezőre)", errs(3, 90, { outreachPercent: 51 }), ["outreachPercent"]);
  check("③ eszkalációs 30 ≤ bemutatkozó 30 → mindkettő", errs(3, 30, { outreachPercent: 30 }), ["percent", "outreachPercent"]);
  check("③ a kereszt-szabály KIKAPCSOLVA is él", escalationConfigErrors(cfg({ enabled: false, percent: 30, outreachPercent: 40 })), ["percent", "outreachPercent"]);

  // ⑥ the stored row → config.
  check("⑥ régi (ADR-0285-ös) sor: hiányzó kulcs → alapérték", parseEscalationSetting('{"enabled":true,"threshold":4,"percent":45}'),
    cfg({ threshold: 4, percent: 45 }));
  check("⑥ teljes sor", parseEscalationSetting('{"enabled":false,"threshold":4,"percent":45,"offerHours":96,"followupHours":30,"outreachPercent":20}'),
    { enabled: false, threshold: 4, percent: 45, offerHours: 96, followupHours: 30, outreachPercent: 20 });
  check("⑥ sérült JSON → null (alapérték jön)", parseEscalationSetting("{nem json"), null);
  check("⑥ mező-közi szabályt sértő sor → null", parseEscalationSetting('{"offerHours":48,"followupHours":48}'), null);
  check("⑥ tartományon kívüli új kulcs → null", parseEscalationSetting('{"outreachPercent":60}'), null);
  check("⑥ null JSON → null", parseEscalationSetting("null"), null);

  // ④ the POST parse.
  const f = (o: Record<string, string>) => ({ get: (k: string) => (k in o ? o[k]! : null) });
  const stored = cfg({ threshold: 4, percent: 45, offerHours: 96, followupHours: 30, outreachPercent: 20 });
  check("④ szekció nélküli űrlap → null (nem nulláz)", escalationFromForm(f({ base_monthly: "3900" }), stored), null);
  check(
    "④ kikapcsolva (tiltott mezők nem jönnek) → a TÁROLT számok maradnak, a bemutatkozó a beküldött",
    escalationFromForm(f({ esc_present: "1", out_percent: "15" }), stored),
    { ...stored, enabled: false, outreachPercent: 15 },
  );
  check(
    "④ „ 4 ”, „40%”, „ 48 ”, „12”, „10 %” normalizálódik",
    escalationFromForm(f({ esc_present: "1", esc_on: "on", esc_threshold: " 4 ", esc_percent: "40%", esc_hours: " 48 ", esc_followup: "12", out_percent: "10 %" }), stored),
    { enabled: true, threshold: 4, percent: 40, offerHours: 48, followupHours: 12, outreachPercent: 10 },
  );
  const frac = escalationFromForm(f({ esc_present: "1", esc_on: "on", esc_threshold: "2,5", esc_percent: "abc" }), stored);
  check("④ „2,5” és „abc” → a validátor elutasítja", frac && escalationConfigErrors(frac), ["threshold", "percent"]);

  // ⑤ the page renders the stored values.
  await loadPricing(true);
  const html = pricingPage(pricingSnapshot("hu"), pricingRegions(), null, new Set(), new Map(), {
    cfg: cfg({ threshold: 7, percent: 35, offerHours: 60, followupHours: 12, outreachPercent: 15 }),
    live: { count: 2, percents: [50] },
  });
  check("⑤ a szekció megjelenik", html.includes('id="pr-esc"'), true);
  check("⑤ a küszöb-mező a tárolt 7-et mutatja", /id="esc_n" name="esc_threshold" inputmode="numeric" value="7"/.test(html), true);
  check("⑤ a %-mező a tárolt 35-öt mutatja", /id="esc_p" name="esc_percent" inputmode="numeric" value="35"/.test(html), true);
  check("⑤ az érvényesség-mező a tárolt 60-at mutatja", /id="esc_h" name="esc_hours" inputmode="numeric" value="60"/.test(html), true);
  check("⑤ az emlékeztető-mező a tárolt 12-t mutatja", /id="esc_f" name="esc_followup" inputmode="numeric" value="12"/.test(html), true);
  check("⑤ a bemutatkozó-mező a tárolt 15-öt mutatja", /id="out_p" name="out_percent" inputmode="numeric" value="15"/.test(html), true);
  check("⑤ az esc_present jelölő ott van (különben a POST nem menti)", html.includes('name="esc_present" value="1"'), true);
  check("⑤ az élő ajánlatok száma az adatban", html.includes('"live":{"count":2,"pcts":"−50%"}'), true);
  const off = pricingPage(pricingSnapshot("hu"), pricingRegions(), null, new Set(), new Map(), {
    cfg: { ...ESCALATION_CONFIG_DEFAULT, enabled: false },
    live: { count: 0, percents: [] },
  });
  check("⑤ kikapcsolt állapot: a kapcsoló üres, a mezők tiltva", /id="esc_on" name="esc_on">/.test(off) && /value="3" disabled/.test(off), true);
  check("⑤ kikapcsolva a bemutatkozó-mező NEM tiltott (a POST-nak hoznia kell)", /id="out_p" name="out_percent" inputmode="numeric" value="25">/.test(off), true);

  // ⑥ the configured follow-up delay decides which offers are due (read at every tick).
  const fu = await touchedProspect("followup");
  await db.insertInto("offer").values({
    kind: "escalation", prospect_id: fu, percent: 50, scope: "initial",
    expires_at: new Date(Date.now() + 20 * 3_600_000),
    created_at: new Date(Date.now() - 5 * 3_600_000),
    note: "escalation-config-check",
  } as never).execute();
  const dueFor = async (followupHours: number) => {
    overrideEscalationConfigInProcess(cfg({ followupHours }));
    return (await escalationFollowupsDue()).some((d) => d.prospectId === fu);
  };
  check("⑥ 5 órás ajánlat, emlékeztető 4 óra → esedékes", await dueFor(4), true);
  check("⑥ 5 órás ajánlat, emlékeztető 6 óra → még nem", await dueFor(6), false);

  // ⑦ the letter's percent binds (owner ruling, ADR-0286).
  // 30, not the 25 constant: a send that stamped nothing would fall back to the legacy 25,
  // and an equal number would let a missing stamp pass.
  overrideEscalationConfigInProcess(cfg({ outreachPercent: 30 }));
  const mailed = await touchedProspect("mailed", false);
  check("⑦ első levél: a draft a beállított 30%-ot idézi", await outreachPercentForProspect(mailed), 30);
  await markProspectSent(mailed, "email");
  overrideEscalationConfigInProcess(cfg({ outreachPercent: 20 }));
  check("⑦ a %-állítás (30 → 20) után a MÉG MEG NEM NYITOTT levél leadje a levélben ígért 30%-ot kapja",
    (await bestActiveOfferForProspect(mailed))?.percent ?? null, 30);
  check("⑦ ugyanennek a leadnek egy újabb levél is a 30%-ot idézi", await outreachPercentForProspect(mailed), 30);
  const legacy = await touchedProspect("legacy");
  check("⑦ régi (bélyeg nélküli) kiküldés → a levélben ígért konstans, nem a mostani 20",
    (await bestActiveOfferForProspect(legacy))?.percent ?? null, OUTREACH_OFFER_PERCENT);
  const fresh = await touchedProspect("fresh", false);
  check("⑦ új lead a %-állítás után: a draft az új 20%-ot idézi", await outreachPercentForProspect(fresh), 20);
  await markProspectSent(fresh, "sms");
  check("⑦ és az új 20% pecsételődik", (await bestActiveOfferForProspect(fresh))?.percent ?? null, 20);
  const body = renderDraft({ leadName: "Próba Vendégház", region: "Balaton", qualification: null, segment: null, rating: null, token: "x", lang: "hu", offerPercent: 20 }).body;
  check("⑦ a levél szövege a draft %-át idézi", /20% kedvezmény/.test(body) && !/25% kedvezmény/.test(body), true);

  // ⑧ STRUCTURE: every send path that stamps the prospect's first-touch sent_at must also
  // stamp the intro offer — a new channel that forgot it would silently fall back to the
  // legacy constant. (The e-mail/SMS/pair paths need a live transport, so ⑦ drives only
  // markProspectSent; this leg keeps the other three honest.)
  const stampers: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (f.endsWith(".ts") && /\.set\(\{\s*sent_at:\s*now\b/.test(readFileSync(f, "utf8"))) stampers.push(f);
    }
  };
  walk("src");
  check("⑧ a sent_at-ot pecsételő küldési utak megvannak (≥ 4)", stampers.length >= 4, true);
  check("⑧ mindegyik a bemutatkozó %-ot is rögzíti (stampOutreachOffer)",
    stampers.filter((f) => !readFileSync(f, "utf8").includes("stampOutreachOffer(")), []);

  // ⑨ the hourly follow-up.
  overrideEscalationConfigInProcess(cfg({ followupHours: 24, offerHours: 72 }));
  const at = (iso: string) => followupWindowBlocks(new Date(iso)) === null;
  check("⑨ ablak nyári időben: 07:59 zárva · 08:00 nyitva · 19:59 nyitva · 20:00 zárva",
    [at("2026-07-01T07:59:00+02:00"), at("2026-07-01T08:00:00+02:00"), at("2026-07-01T19:59:00+02:00"), at("2026-07-01T20:00:00+02:00")],
    [false, true, true, false]);
  check("⑨ ablak téli időben (UTC-s gépen is Budapest szerint): 07:30 zárva · 08:00 nyitva · 20:00 zárva",
    [at("2026-12-01T07:30:00+01:00"), at("2026-12-01T08:00:00+01:00"), at("2026-12-01T20:00:00+01:00")],
    [false, true, false]);

  // A prospect the real draft path can build (lead → scrape_run → scraper_definition).
  const joinLead = await db
    .selectFrom("lead")
    .innerJoin("scrape_run", "scrape_run.id", "lead.scrape_run_id")
    .innerJoin("scraper_definition", "scraper_definition.id", "scrape_run.scraper_definition_id")
    .select("lead.id")
    .where("scraper_definition.country", "=", "HU")
    .limit(1)
    .executeTakeFirstOrThrow();
  const fp = await db
    .insertInto("prospect")
    .values({
      lead_id: joinLead.id,
      token: `esc-config-check-fu2-${process.pid}`,
      sent_at: new Date(),
      contact_email: `esc-config-check-${process.pid}@example.invalid`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  made.push(fp.id);
  const inWindow = new Date("2026-10-01T10:00:00+02:00");
  const hoursBefore = (h: number) => new Date(inWindow.getTime() - h * 3_600_000);
  const fo = await db.insertInto("offer").values({
    kind: "escalation", prospect_id: fp.id, percent: 50, scope: "initial",
    expires_at: new Date(inWindow.getTime() + 40 * 3_600_000),
    created_at: hoursBefore(30),
    note: "escalation-config-check",
  } as never).returning("id").executeTakeFirstOrThrow();
  const mine = new Set([fp.id]);
  const sent: EmailMessage[] = [];
  const fake: EmailSender = { send: async (m: EmailMessage) => { sent.push(m); return { id: "fake", provider: "mock" } as never; } } as EmailSender;
  const stamp = async () => (await db.selectFrom("offer").select("followup_sent_at").where("id", "=", fo.id).executeTakeFirstOrThrow()).followup_sent_at;

  const night = await sendEscalationFollowups(new Date("2026-10-01T03:00:00+02:00"), { sender: fake, onlyProspects: mine });
  check("⑨ éjjel (03:00 Budapest): semmi nem megy ki, a futás halasztást jelez", [sent.length, !!night.deferred, await stamp()], [0, true, null]);

  const [r1, r2] = await Promise.all([
    sendEscalationFollowups(inWindow, { sender: fake, onlyProspects: mine }),
    sendEscalationFollowups(inWindow, { sender: fake, onlyProspects: mine }),
  ]);
  const ours = sent.filter((m) => JSON.stringify(m).includes(`esc-config-check-${process.pid}@`));
  check(`⑨ két EGYSZERRE induló futás → pontosan 1 levél erre az ajánlatra (futások: ${JSON.stringify([r1, r2])})`, ours.length, 1);
  await sendEscalationFollowups(new Date(inWindow.getTime() + 3_600_000), { sender: fake, onlyProspects: mine });
  check("⑨ a következő órás futás sem küldi újra", sent.filter((m) => JSON.stringify(m).includes(`esc-config-check-${process.pid}@`)).length, 1);
  check("⑨ a foglalás bélyege az ajánlaton", (await stamp()) !== null, true);

  // claim / release on a bare offer.
  const cp = await touchedProspect("claim");
  const mk = async (expiresInH: number) => (await db.insertInto("offer").values({
    kind: "escalation", prospect_id: cp, percent: 50, scope: "initial",
    expires_at: new Date(Date.now() + expiresInH * 3_600_000), note: "escalation-config-check",
  } as never).returning("id").executeTakeFirstOrThrow()).id;
  const live = await mk(10);
  const t0 = new Date();
  check("⑨ foglalás: először igen, másodszor nem", [await claimFollowup(live, t0), await claimFollowup(live, t0)], [true, false]);
  await releaseFollowup(live, t0);
  check("⑨ elbukott küldés után a feloldás újra foglalhatóvá teszi", await claimFollowup(live, new Date()), true);
  await db.deleteFrom("offer").where("id", "=", live).execute();
  const expired = await mk(-1);
  check("⑨ lejárt ajánlat SOHA nem foglalható", await claimFollowup(expired, new Date()), false);
} finally {
  overrideEscalationConfigInProcess(null);
  if (made.length) await db.deleteFrom("prospect").where("id", "in", made).execute();
  await db.destroy();
}

if (failures > 0) {
  console.error(`\n✗ ESCALATION-CONFIG-CHECK: ${failures} bukott ellenőrzés`);
  process.exit(1);
}
console.log("\n✅ ESCALATION-CONFIG-CHECK: minden ellenőrzés zöld (a teszt-sorok törölve, az app_setting sort nem írta)");

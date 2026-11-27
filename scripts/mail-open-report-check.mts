// mail-open-report-check — the letter open (email_open, ADR-0462) in the Riport → Tölcsér (brief
// levelnyitas-riport-20261127). The owner asked: „a levél betöltésekor a kép letöltésével mérjük,
// hogy megnyitják-e az emailt. Erre nem látok reportot.” The data was there (prod 11-27: Gmail
// 124 sent → 66 opened the letter → 20 clicked), the report read none of it.
//
//   ① pure fold: mail_open_rate = person opens (kind='open', own=false) / MEASURED letters; Apple
//      prefetch and bot fetches are counted apart and never as an open; a letter sent before the
//      measurement started, an SMS-only send, a follow-up round are not in the denominator;
//      „kattintott / megnyitotta a levelet” = mock opened ∧ letter opened, a clicker whose letter
//      open was not seen (image blocked) is counted apart; the Gmail / other split
//   ② the page: the „Megnyitotta-e a levelet?” card stands BEFORE „Megfogja-e a levél?”, carries the
//      split, the informational fetches and the since/undercount warning; the mock-open card carries
//      the click ratio; the breakdown table has the „Levelet megnyitotta” column and the mailbox dim
//      an 'open' within 60 s of the send (the Gmail scanner; rows written before the 11-23 writer
//      fix) counts as a bot, never as an open
//   ③ DB leg (shared dev DB, own stamped rows, deleted in `finally`): loadProspectFacts + foldReport
//      give the SAME numbers as the plain SQL of the brief over the same prospects
//
//   npx tsx scripts/mail-open-report-check.mts              → the rules
//   npx tsx scripts/mail-open-report-check.mts --self-test  → a sabotaged fold MUST fail
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { DEFAULT_TARGETS, foldReport, loadProspectFacts, mailDomainOf, type ProspectFacts, type Visit } from "../src/console/reportData.js";
import { reportFunnelPage } from "../src/console/reportViews.js";

const SELF_TEST = process.argv.includes("--self-test");
const D = (iso: string): Date => new Date(iso);
const NOW = D("2026-11-27T15:00:00Z");

type Fold = typeof foldReport;

function visit(id: string, at: Date): Visit {
  return { id, startedAt: at, device: "mobile", dwellSeconds: 30, maxScroll: 40, moduleTouched: false, presetChanges: 0, moduleChanges: 0, panelOpened: false, lastSection: 1, events: [], openSource: "email", openSourceSure: true };
}
function fact(id: string, o: { domain?: "gmail" | "other" | null; tracked?: boolean; mailOpen?: boolean; mock?: boolean; prefetch?: boolean; bot?: boolean; seg?: string }): ProspectFacts {
  const sentAt = D("2026-11-24T09:00:00Z");
  const visits = o.mock ? [visit(`v-${id}`, D("2026-11-24T12:00:00Z"))] : [];
  return {
    id, leadId: `l-${id}`, leadName: `Teszt ${id}`, segment: o.seg ?? "nincs_honlap", channel: o.domain ? "email" : "sms", style: "coastal-fresh", template: "parallax",
    sentAt, sentHour: 10, visits, openedAt: visits[0]?.startedAt ?? null, deepAt: null, trialedAt: null,
    orderedAt: null, touches: {}, paidAt: null, unsubscribedAt: null, escalationShown: false, escalationCta: false, escalationDismiss: false,
    device: visits[0]?.device ?? "unknown", exitReason: null, exitConfidence: null, stated: null, replied: false,
    mailDomain: o.domain ?? null, mailTracked: o.tracked ?? !!o.domain, mailOpenedAt: o.mailOpen ? D("2026-11-24T10:00:00Z") : null,
    mailPrefetch: !!o.prefetch, mailBot: !!o.bot,
  };
}

function pure(fold: Fold): string[] {
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string): void => {
    if (!cond) failures.push(msg);
  };
  const facts = [
    fact("g1", { domain: "gmail", mailOpen: true, mock: true }),
    fact("g2", { domain: "gmail", mailOpen: true }),
    fact("g3", { domain: "gmail", mailOpen: true, seg: "elavult" }),
    fact("g4", { domain: "gmail", bot: true }),
    fact("o1", { domain: "other", prefetch: true }),
    fact("o2", { domain: "other", mailOpen: true, mock: true, prefetch: true }),
    fact("o3", { domain: "other", mock: true }),
    fact("o4", { domain: "other", seg: "elavult" }),
    // not measured: sent before the measurement started, and an SMS-only send
    fact("e0", { domain: "gmail", tracked: false, mock: true }),
    fact("s1", { domain: null, mock: true }),
  ];
  const d = fold(facts, DEFAULT_TARGETS, [], 0, "mailbox", NOW);
  const c = d.counts;
  // ①
  ok(c.sent === 10, `① all 10 sends are in the funnel (got ${c.sent})`);
  ok(c.mailSent === 8, `① 8 measured letters (not e0, not s1) — got ${c.mailSent}`);
  ok(c.mailOpened === 4, `① 4 person opens (g1 g2 g3 o2; bot/prefetch are no open) — got ${c.mailOpened}`);
  ok(c.mailClicked === 2, `① 2 clicked after opening the letter (g1 o2) — got ${c.mailClicked}`);
  ok(c.mailClickedUnseen === 1, `① 1 clicker without a seen letter open (o3) — got ${c.mailClickedUnseen}`);
  ok(c.mailPrefetch === 2 && c.mailBot === 1, `① Apple prefetch 2, bot 1 — got ${c.mailPrefetch}/${c.mailBot}`);
  const h = d.hypotheses.find((x) => x.key === "mail_open_rate");
  ok(!!h && h.num === 4 && h.den === 8 && h.value === 50, `① mail_open_rate 4/8 = 50% (got ${h?.num}/${h?.den} = ${h?.value})`);
  ok(d.hypotheses[0]?.key === "mail_open_rate" && d.hypotheses[1]?.key === "open_rate", "① the letter-open card comes right before the mock-open card");
  const g = d.mailByDomain.gmail;
  const o = d.mailByDomain.other;
  ok(g.mailSent === 4 && g.mailOpened === 3 && g.mailClicked === 1, `① Gmail 4 → 3 → 1 (got ${g.mailSent} → ${g.mailOpened} → ${g.mailClicked})`);
  ok(o.mailSent === 4 && o.mailOpened === 1 && o.mailClicked === 1, `① other 4 → 1 → 1 (got ${o.mailSent} → ${o.mailOpened} → ${o.mailClicked})`);
  const dimKeys = d.dims.map((r) => r.key).sort().join(",");
  ok(dimKeys === "gmail,none,other", `① the mailbox dim: gmail / other / none (got ${dimKeys})`);
  const seg = fold(facts, DEFAULT_TARGETS, [], 0, "segment", NOW).dims.find((r) => r.key === "elavult");
  ok(!!seg && seg.counts.mailSent === 2 && seg.counts.mailOpened === 1, "① the segment breakdown carries the letter open (elavult: 1 / 2)");
  ok(d.mailSince === "2026-11-24", `① the measurement's first day (got ${d.mailSince})`);
  ok(mailDomainOf("Valaki@GMAIL.com") === "gmail" && mailDomainOf("x@googlemail.com") === "gmail" && mailDomainOf("x@freemail.hu") === "other" && mailDomainOf(null) === null && mailDomainOf("nincs") === null, "① mailDomainOf");
  const none = fold([fact("s1", { domain: null, mock: true })], DEFAULT_TARGETS, [], 0, "segment", NOW);
  ok(none.hypotheses[0]!.verdict === "none" && none.counts.mailSent === 0, "① nothing measured → „nincs adat”, never 0%");

  // ②
  const page = reportFunnelPage(d, "2026-11-27");
  const iMail = page.indexOf('data-hyp="mail_open_rate"');
  const iOpen = page.indexOf('data-hyp="open_rate"');
  ok(iMail > 0 && iOpen > iMail, "② „Megnyitotta-e a levelet?” stands before „Megfogja-e a levél?”");
  const mailCard = page.slice(iMail, iOpen);
  ok(mailCard.includes("Megnyitotta-e a levelet?") && mailCard.includes("levél-megnyitás / kiküldött levél"), "② the card's question and measure");
  ok(mailCard.includes("Gmail 75% (3/4)") && mailCard.includes("egyéb 25% (1/4)"), "② the Gmail / other split on the card");
  ok(mailCard.includes("Apple-előtöltés 2") && mailCard.includes("robot 1"), "② the informational fetches on the card");
  ok(/11\. 24\. óta mérjük; képblokkoló levelezőnél alulszámol/.test(mailCard), "② the since / undercount warning");
  const openCard = page.slice(iOpen, page.indexOf('data-hyp="return_rate"'));
  ok(openCard.includes("kattintott / megnyitotta a levelet: 50,0% (2/4)") && openCard.includes("+1 kattintó levél-megnyitás nélkül"), "② the click ratio on the mock-open card");
  ok(page.includes(">Levelet megnyitotta<") && page.includes("Címzett postafiókja") && page.includes(">Gmail<") && page.includes("Egyéb levelező"), "② the breakdown column and the mailbox dim");
  const re = fold(facts.map((p) => ({ ...p, mailTracked: false, mailOpenedAt: null })), DEFAULT_TARGETS, [], 0, "segment", NOW);
  ok(!reportFunnelPage(re, "2026-11-27").includes("kattintott / megnyitotta"), "② no measured letter → no click ratio line");
  return failures;
}

// ── ③ the DB leg ─────────────────────────────────────────────────────────────────
async function dbLeg(): Promise<string[]> {
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string): void => {
    if (!cond) failures.push(msg);
  };
  const stamp = Date.now().toString(36);
  const leads: string[] = [];
  const ids: string[] = [];
  let defId: string | null = null;
  let runId: string | null = null;
  // Recent sends, so the shared DB's measurement start (the first measured send) is not moved
  // when it already has older measured letters.
  const base = Date.now() - 6 * 3_600_000;
  const at = (min: number): Date => new Date(base + min * 60_000);
  try {
    const def = await db
      .insertInto("scraper_definition")
      .values({ label: `_mailopencheck_${stamp}`, country: "HU", region: "_test", industry: "accommodation", sources: JSON.stringify(["osm"]) })
      .returning("id")
      .executeTakeFirstOrThrow();
    defId = def.id;
    runId = (await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow()).id;
    const mk = async (tag: string, o: { email: string | null; sentMin: number; fetches?: { kind: "open" | "proxy_prefetch" | "bot"; own?: boolean; afterSec?: number }[]; view?: boolean }): Promise<void> => {
      const lead = await db.insertInto("lead").values({ scrape_run_id: runId!, name: `_mailopencheck_${stamp} ${tag}`, raw: JSON.stringify({}), preview_label: `moc-${stamp}-${tag}` }).returning("id").executeTakeFirstOrThrow();
      leads.push(lead.id);
      const sentAt = at(o.sentMin);
      const p = await db
        .insertInto("prospect")
        .values({
          lead_id: lead.id,
          token: `moc${stamp}${tag}xxxxxxxxxxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, ""),
          status: "sent",
          contact_email: o.email,
          sent_at: sentAt,
          email_sent_at: o.email ? sentAt : null,
          sms_sent_at: o.email ? null : sentAt,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      ids.push(p.id);
      for (const f of o.fetches ?? [])
        await db
          .insertInto("email_open")
          .values({ prospect_id: p.id, kind: f.kind, client: f.kind === "open" ? "gmail_proxy" : f.kind === "bot" ? "bot" : "apple_proxy", own: f.own ?? false, at: f.afterSec !== undefined ? new Date(sentAt.getTime() + f.afterSec * 1000) : at(o.sentMin + 30) })
          .execute();
      if (o.view) await db.insertInto("mock_view").values({ prospect_id: p.id, started_at: at(o.sentMin + 40), device: "mobile", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" }).execute();
    };
    await mk("g1", { email: `moc-${stamp}-g1@gmail.com`, sentMin: 0, fetches: [{ kind: "open" }, { kind: "open" }], view: true });
    await mk("g2", { email: `moc-${stamp}-g2@gmail.com`, sentMin: 5, fetches: [{ kind: "open" }] });
    await mk("g3", { email: `moc-${stamp}-g3@gmail.com`, sentMin: 10, fetches: [{ kind: "bot" }, { kind: "open", own: true }] });
    // An 'open' 5 s after the send = the Gmail scanner, written before the 2026-11-23 writer fix.
    await mk("g4", { email: `moc-${stamp}-g4@googlemail.com`, sentMin: 15, fetches: [{ kind: "open", afterSec: 5 }] });
    await mk("o1", { email: `moc-${stamp}-o1@example.invalid`, sentMin: 20, fetches: [{ kind: "proxy_prefetch" }] });
    await mk("o2", { email: `moc-${stamp}-o2@example.invalid`, sentMin: 25, fetches: [{ kind: "open" }], view: true });
    await mk("o3", { email: `moc-${stamp}-o3@example.invalid`, sentMin: 30, view: true });
    await mk("s1", { email: null, sentMin: 35, view: true });

    // The brief's SQL over the same prospects: measured = e-mail sent at/after the first send that
    // ever produced an email_open row; opened = a person fetch ≥ 60 s after the send; clicked =
    // opened ∧ a mock view.
    const want = await sql<{ dom: string; sent: number; opened: number; clicked: number; prefetch: number; bot: number }>`
      with since as (
        select min(p.email_sent_at) s from prospect p where exists (select 1 from email_open e where e.prospect_id = p.id)
      ), x as (
        select case when lower(split_part(p.contact_email, '@', 2)) in ('gmail.com', 'googlemail.com') then 'gmail' else 'other' end dom,
          exists (select 1 from email_open e where e.prospect_id = p.id and e.kind = 'open' and not e.own and e.at - p.email_sent_at >= interval '60 seconds') opened,
          exists (select 1 from mock_view v where v.prospect_id = p.id) clicked,
          exists (select 1 from email_open e where e.prospect_id = p.id and e.kind = 'proxy_prefetch' and not e.own) prefetch,
          exists (select 1 from email_open e where e.prospect_id = p.id and not e.own and (e.kind = 'bot' or (e.kind = 'open' and e.at - p.email_sent_at < interval '60 seconds'))) bot
        from prospect p, since
        where p.id in (${sql.join(ids)}) and p.contact_email is not null and p.email_sent_at >= since.s
      )
      select dom, count(*)::int sent, count(*) filter (where opened)::int opened, count(*) filter (where opened and clicked)::int clicked,
        count(*) filter (where prefetch)::int prefetch, count(*) filter (where bot)::int bot
      from x group by dom`.execute(db);
    const sqlBy = new Map(want.rows.map((r) => [r.dom, r]));
    const mine = (await loadProspectFacts("first")).filter((p) => ids.includes(p.id));
    ok(mine.length === ids.length, `③ every fixture prospect is loaded (${mine.length}/${ids.length})`);
    const d = foldReport(mine, DEFAULT_TARGETS, [], 0, "mailbox", new Date());
    for (const dom of ["gmail", "other"] as const) {
      const s = sqlBy.get(dom);
      const f = d.mailByDomain[dom];
      ok(!!s && s.sent === f.mailSent && s.opened === f.mailOpened && s.clicked === f.mailClicked && s.prefetch === f.mailPrefetch && s.bot === f.mailBot,
        `③ ${dom}: SQL ${s?.sent}/${s?.opened}/${s?.clicked}/${s?.prefetch}/${s?.bot} = fold ${f.mailSent}/${f.mailOpened}/${f.mailClicked}/${f.mailPrefetch}/${f.mailBot}`);
    }
    ok(d.mailByDomain.gmail.mailSent === 4 && d.mailByDomain.gmail.mailOpened === 2, "③ Gmail: 4 measured, 2 opened (g3's own open and g4's 5-second open do not count)");
    ok(d.mailByDomain.gmail.mailBot === 2, "③ Gmail bots: g3's bot row and g4's scanner 'open'");
    ok(d.counts.mailClickedUnseen === 1 && d.counts.mailSent === 7, "③ o3 clicked unseen; the SMS send is not a letter");
  } finally {
    for (const l of leads) {
      // email_open and mock_view go with the prospect (ON DELETE CASCADE).
      await db.deleteFrom("prospect").where("lead_id", "=", l).execute();
      await db.deleteFrom("lead").where("id", "=", l).execute();
    }
    if (runId) await db.deleteFrom("scrape_run").where("id", "=", runId).execute();
    if (defId) await db.deleteFrom("scraper_definition").where("id", "=", defId).execute();
  }
  return failures;
}

if (SELF_TEST) {
  // A fold that counts Apple's prefetch as an open must go red.
  const broken: Fold = (everyone, ...rest) => foldReport(everyone.map((p) => ({ ...p, mailOpenedAt: p.mailOpenedAt ?? (p.mailPrefetch || p.mailBot ? p.sentAt : null) })), ...rest);
  const f = pure(broken);
  await db.destroy();
  if (!f.length) {
    console.error("✗ self-test: a fold counting prefetch/bot as opens went GREEN — the check is blind");
    process.exit(1);
  }
  console.log(`✓ self-test: the sabotaged fold is caught (${f.length} rule(s) red)`);
  process.exit(0);
}

const failures = pure(foldReport);
try {
  failures.push(...(await dbLeg()));
} finally {
  await db.destroy();
}
if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  process.exit(1);
}
console.log("✓ mail-open-report-check: letter open in the funnel report — fold, page and SQL agree");

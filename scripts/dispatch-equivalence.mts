// „Országok / Árazás” 4. fázis (0155) — the EQUIVALENCE check before the cutover: the new per-country
// dispatch rules decide exactly what the old hard-coded rules and the repo-less auto-approve.mts decided.
// READ-ONLY (no approval, no send, no write). Run on the box whose data is meant — on prod after the
// deploy (migration applied, the tick's autoApprove still OFF), before the Debian cron line goes off.
// Any difference = red (exit 1), the cutover does not happen.
//
//   ① approval: the old script's pick (its code, verbatim below, over the checked-ids FILE) vs the new
//      autoApprove.decideOne (every rule on — the backfill; over lead.contact_checked_at), lead by lead.
//      The mode ('auto'/'owner') is not part of it: it decides WHETHER to approve, not WHAT.
//   ② window: the old formula (Mon–Fri, not a row holiday, the row's hours ∩ 8–17) vs outreachWindowOpenIn,
//      every country, every 15 minutes of the next 14 days.
//   ③ daily cap: the old (HU = outreach_auto.dailyCap, else .countryCaps, else daily_quota) vs dailyCapFor.
//   ④ photo gate: the queued + approval-waiting rows the old SQL (5 photos, app_setting switch) lets through
//      vs the new SQL (the country row), row by row.
//   ⑤ site order: the old fixed ranks vs the country rows' dispatch_sites, on the queued rows.
//
//   npx tsx scripts/dispatch-equivalence.mts [--checked=/opt/citoviso/checked-ids.txt]
import { existsSync, readFileSync } from "node:fs";
import { sql } from "kysely";

const checkedFile = process.argv.find((a) => a.startsWith("--checked="))?.split("=")[1] ?? "/opt/citoviso/checked-ids.txt";
const { db } = await import("../src/db/client.js");
const { allCountriesSync } = await import("../src/country.js");
const { listPendingApprovals } = await import("../src/console/approvalQueue.js");
const { approvalFacts, decideOne } = await import("../src/outreach/autoApprove.js");
const { outreachWindowOpenIn, dailyCapFor } = await import("../src/outreach/countryOutreach.js");
const { isHolidayDay } = await import("../src/crm/countryClock.js");
const { isoDayIn, minutesIn } = await import("../src/text/zoneTime.js");
const { DISPATCH_PHOTOS_OK_SQL, LEAD_OWN_PHOTOS_SQL } = await import("../src/outreach/mockPhotoGate.js");
const { DISPATCH_PRIORITY, DISPATCH_SITE_OK, DISPATCH_HOME_COUNTRY } = await import("../src/outreach/autoDispatch.js");
const { getSetting } = await import("../src/console/appSettings.js");
const { TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION } = await import("../src/media/townPick.js");

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

try {
  // ── ① approval ──────────────────────────────────────────────────────────────────────────────
  console.log("① jóváhagyás: régi auto-approve.mts ↔ új autoApprove (lead szerint)");
  const all = await listPendingApprovals();
  const fileChecked = existsSync(checkedFile) ? new Set(readFileSync(checkedFile, "utf8").split("\n").filter(Boolean)) : null;
  // ---- the old script's decision, verbatim (/opt/citoviso/auto-approve.mts.disabled-20261126) ----
  const ids = [...new Set(all.flatMap((i) => [i.mainId, i.altId].filter(Boolean) as string[]))];
  const ph = new Map<string, number>();
  const town = new Set<string>();
  if (ids.length) {
    for (const r of await db.selectFrom("mock_artifact").select(["id", "inputs"]).where("id", "in", ids).execute()) {
      ph.set(r.id, Number((r.inputs as { photos?: unknown } | null)?.photos ?? 0));
      if (JSON.stringify(r.inputs ?? {}).includes("townPhoto")) town.add(r.id);
    }
  }
  type I = (typeof all)[number];
  const checked = fileChecked ?? new Set<string>();
  const own = (i: I) => (ph.get(i.mainId) ?? 0) > 0 && !!i.altId && (ph.get(i.altId) ?? 0) > 0;
  const okPic = (id: string) => (ph.get(id) ?? 0) > 0 || town.has(id);
  const townOk = (i: I) => okPic(i.mainId) && (i.altId ? okPic(i.altId) : town.has(i.mainId));
  const held = (i: I) => "held" in i.channel && (i.channel as { held?: boolean }).held === true;
  const uncheckedEmail = (i: I) => i.channel.channel === "check" && !!i.email;
  const emailLead = (i: I) => !!i.email && (own(i) || townOk(i));
  const oldPick = all.filter((i) => {
    if (emailLead(i)) return true;
    if (held(i) && !uncheckedEmail(i)) return false;
    const ch = i.channel.channel;
    if (uncheckedEmail(i)) return own(i) || townOk(i);
    if (!own(i)) {
      if (!townOk(i)) return false;
      if (ch === "viber" || ch === "whatsapp") return true;
      return ch === "email" && checked.has(i.leadId);
    }
    if (ch === "viber" || ch === "whatsapp") return true;
    if (ch === "mms") return !!i.email || checked.has(i.leadId);
    if (ch === "email") return checked.has(i.leadId);
    return false;
  });
  // ---- the new one (every rule on = the backfill) ----
  const facts = await approvalFacts(all);
  const ALL_ON = { twoMocks: true, townNoMms: true, emailOnly: true, uncheckedEmail: true, noMailNoSend: true };
  const newPick = all.map((i) => decideOne(i, facts, ALL_ON)).filter((p) => p !== null);
  const oldIds = new Set(oldPick.map((i) => i.leadId));
  const newIds = new Set(newPick.map((p) => p!.item.leadId));
  const onlyOld = [...oldIds].filter((x) => !newIds.has(x));
  const onlyNew = [...newIds].filter((x) => !oldIds.has(x));
  console.log(`    várakozó: ${all.length} · régi pick: ${oldIds.size} · új pick: ${newIds.size}${fileChecked ? ` · checked-fájl: ${fileChecked.size} sor` : " · NINCS checked-fájl (a régi oldal üres halmazzal számol)"}`);
  if (fileChecked) {
    const dbOnly = [...facts.checked].filter((x) => !fileChecked.has(x));
    const fileOnly = all.map((i) => i.leadId).filter((x) => fileChecked.has(x) && !facts.checked.has(x));
    check("a várakozók „ellenőrizve” jele a DB-ben = a fájlban", dbOnly.length === 0 && fileOnly.length === 0, `csak DB: ${dbOnly.length} · csak fájl: ${fileOnly.length} (előbb: contact-checked-import.mts --go)`);
  }
  check("régi pick = új pick (lead szerint)", onlyOld.length === 0 && onlyNew.length === 0, `csak régi: ${onlyOld.join(",") || "—"} · csak új: ${onlyNew.join(",") || "—"}`);

  // ①b every input combination (independent of today's queue — the queue may be empty or its mock files
  //    absent on a copy): channel × held × e-mail × checked × the two mocks' own photos / town photo × second plan.
  {
    const chans = ["viber", "whatsapp", "mms", "email", "check"] as const;
    let n = 0;
    let bad = 0;
    let firstBad = "";
    for (const ch of chans) for (const h of [false, true]) for (const em of [false, true]) for (const ck of [false, true])
      for (const mp of [0, 3]) for (const mt of [false, true]) for (const alt of [false, true]) for (const ap of [0, 3]) for (const at of [false, true]) {
        if (!alt && (ap || at)) continue;
        n++;
        const item = { leadId: "L", mainId: "M", altId: alt ? "A" : null, email: em ? "x@y.z" : "", channel: { channel: ch, ...(h ? { held: true } : {}) } } as unknown as I;
        const mocks = new Map([["M", { photos: mp, town: mt }], ...(alt ? [["A", { photos: ap, town: at }] as const] : [])]);
        const ckSet = new Set(ck ? ["L"] : []);
        // old, verbatim over these facts
        const ph2 = (id: string) => mocks.get(id)?.photos ?? 0;
        const town2 = (id: string) => mocks.get(id)?.town ?? false;
        const own2 = ph2("M") > 0 && alt && ph2("A") > 0;
        const okPic2 = (id: string) => ph2(id) > 0 || town2(id);
        const townOk2 = okPic2("M") && (alt ? okPic2("A") : town2("M"));
        const unchecked2 = ch === "check" && em;
        const emailLead2 = em && (own2 || townOk2);
        let old: boolean;
        if (emailLead2) old = true;
        else if (h && !unchecked2) old = false;
        else if (unchecked2) old = own2 || townOk2;
        else if (!own2) old = !townOk2 ? false : ch === "viber" || ch === "whatsapp" ? true : ch === "email" && ckSet.has("L");
        else if (ch === "viber" || ch === "whatsapp") old = true;
        else if (ch === "mms") old = em || ckSet.has("L");
        else if (ch === "email") old = ckSet.has("L");
        else old = false;
        const neu = decideOne(item, { mocks, checked: ckSet }, ALL_ON) !== null;
        if (old !== neu) {
          bad++;
          firstBad ||= JSON.stringify({ ch, h, em, ck, mp, mt, alt, ap, at, old, neu });
        }
      }
    check(`minden bemenet-kombináción azonos (${n} eset)`, bad === 0, bad ? `${bad} eltérés, első: ${firstBad}` : "");
  }

  // ── ② window ───────────────────────────────────────────────────────────────────────────────
  console.log("② küldési ablak: régi (H–P, sor ∩ 8–17) ↔ új (az ország sora), 14 nap × 15 perc");
  const t0 = Date.now() - (Date.now() % (15 * 60_000));
  for (const cfg of allCountriesSync()) {
    let diff = 0;
    let first = "";
    for (let k = 0; k < 14 * 96; k++) {
      const d = new Date(t0 + k * 15 * 60_000);
      const day = isoDayIn(d, cfg.timeZone);
      const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
      const from = Math.max(8, cfg.sendWindowFrom);
      const to = Math.min(17, cfg.sendWindowTo);
      const m = minutesIn(d, cfg.timeZone);
      const old = wd !== 0 && wd !== 6 && !isHolidayDay(day, cfg.publicHolidays) && from < to && m >= from * 60 && m < to * 60;
      if (old !== outreachWindowOpenIn(d, cfg)) {
        diff++;
        first ||= `${d.toISOString()} régi=${old}`;
      }
    }
    check(`${cfg.iso2}: az ablak-döntés azonos`, diff === 0, diff ? `${diff} eltérés, első: ${first}` : "");
  }

  // ── ③ daily cap ────────────────────────────────────────────────────────────────────────────
  console.log("③ napi keret: régi (outreach_auto) ↔ új (a sor)");
  const auto = JSON.parse((await getSetting("outreach_auto")) ?? "{}") as { dailyCap?: number; countryCaps?: Record<string, number> };
  for (const cfg of allCountriesSync()) {
    const old =
      cfg.iso2 === DISPATCH_HOME_COUNTRY
        ? Number.isInteger(auto.dailyCap) ? auto.dailyCap! : 40
        : typeof auto.countryCaps?.[cfg.iso2] === "number" ? auto.countryCaps[cfg.iso2]! : cfg.dailyQuota;
    const now = dailyCapFor(cfg, DISPATCH_HOME_COUNTRY);
    check(`${cfg.iso2}: napi keret azonos`, old === now, `régi ${old} · új ${now}`);
  }

  // ── ④ photo gate ───────────────────────────────────────────────────────────────────────────
  console.log("④ fotó-kapu: régi SQL (5 kép, globális kapcsoló) ↔ új SQL (az ország sora), soronként");
  const OLD_GATE = sql<boolean>`(case when ${LEAD_OWN_PHOTOS_SQL} >= 5 then (
      jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' and jsonb_array_length(a.inputs->'siteData'->'photos') >= 5
      and a.inputs->'siteData'->'townPhoto' is null)
    else (exists (select 1 from app_setting s where s.key = 'town_photo_dispatch' and s.value = 'on')
      and (case when jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' then jsonb_array_length(a.inputs->'siteData'->'photos') else 0 end) < 5
      and ((a.inputs->'siteData'->'townPhoto'->'pick'->>'version' = ${String(TOWN_PICK_VERSION)}
            and a.inputs->'siteData'->'townPhoto'->'pick'->>'threshold' = ${TOWN_PICK_THRESHOLD})
        or (a.inputs->'siteData'->'townPhoto' is null
            and jsonb_typeof(a.inputs->'siteData'->'photos') = 'array' and jsonb_array_length(a.inputs->'siteData'->'photos') >= 1
            and a.inputs->'siteData'->'townGallery'->0->'pick'->>'version' = ${String(TOWN_PICK_VERSION)}
            and a.inputs->'siteData'->'townGallery'->0->'pick'->>'threshold' = ${TOWN_PICK_THRESHOLD}))) end)`;
  const g = await sql<{ id: string; old: boolean; neu: boolean }>`
    select d.id, ${OLD_GATE} as old, ${DISPATCH_PHOTOS_OK_SQL} as neu
      from outreach_dispatch d join lead l on l.id = d.lead_id join mock_artifact a on a.id = d.artifact_id
     where d.status in ('queued', 'held')`.execute(db);
  const gd = g.rows.filter((r) => Boolean(r.old) !== Boolean(r.neu));
  check(`a fotó-kapu ítélete azonos (${g.rows.length} sor, ebből átengedve ${g.rows.filter((r) => r.neu).length})`, gd.length === 0, gd.slice(0, 5).map((r) => r.id).join(","));

  // ── ⑤ site order ───────────────────────────────────────────────────────────────────────────
  console.log("⑤ honlap szerinti sorrend: régi fix rang ↔ az ország sora");
  const OLD_RANK = sql<number>`(select (case
      when l.qualification = 'no_site' or l.raw->>'websiteStatus' in ('none', 'portal_only') then 0
      when l.qualification = 'outdated' then 1 when l.qualification = 'modern' then 2 else 3 end) * 2 + (case
      when btrim(coalesce(l.raw->>'email', '')) <> '' then 0
      when jsonb_typeof(l.raw->'otherEmails') = 'array' and exists (select 1 from jsonb_array_elements_text(l.raw->'otherEmails') e where btrim(e) <> '') then 0
      else 1 end) from lead l where l.id = outreach_dispatch.lead_id)`;
  const o = await db
    .selectFrom("outreach_dispatch")
    .select(["id", OLD_RANK.as("old"), DISPATCH_PRIORITY.as("neu"), DISPATCH_SITE_OK.as("ok")])
    .where("status", "=", "queued")
    .execute();
  const od = o.filter((r) => Number(r.old) !== Number(r.neu) || !r.ok);
  check(`a sorrend-kulcs azonos és minden kör kiküldhető (${o.length} várakozó sor)`, od.length === 0, od.slice(0, 5).map((r) => `${r.id}: ${r.old}→${r.neu}${r.ok ? "" : " (kizárva)"}`).join(", "));
} finally {
  await db.destroy();
}
console.log(fails ? `\n⛔ dispatch-equivalence: ${fails} eltérés — az átállás NEM mehet` : "\n✅ dispatch-equivalence: a régi és az új döntés azonos — az átállás mehet");
process.exit(fails ? 1 : 0);

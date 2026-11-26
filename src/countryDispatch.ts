// „Országok / Árazás” 4. fázis (0155; terv assets/design-refs/console/orszagok-arazas/ ⑪): the country's
// DISPATCH RULES as the „Kiküldés” tab edits them — the form → a draft, its validation, the count of the
// leads that qualify under it („holnaptól ennyi lead felel meg”), and the write. One truth: the count uses
// the same SQL pieces the dispatcher's claim uses (mockPhotoGate, the site class), parametrised by the draft.
import { sql } from "kysely";
import {
  countryConfig,
  DISPATCH_RULE_KEYS,
  DISPATCH_SITES,
  refreshCountries,
  type CountryConfig,
  type CountryDispatch,
  type DispatchSite,
} from "./country.js";
import { COUNTRY_CHANNELS } from "./countryRules.js";
import { db } from "./db/client.js";
import { LEAD_COUNTRY_SQL } from "./db/leadCountrySql.js";
import { T } from "./i18n/mail.js";
import { LEAD_OWN_PHOTOS_SQL } from "./outreach/mockPhotoGate.js";

/** What the tab edits: the dispatch rules plus the three existing row columns it owns (quota, window). */
export interface DispatchDraft extends CountryDispatch {
  readonly dailyQuota: number;
  readonly sendWindowFrom: number;
  readonly sendWindowTo: number;
}

export type DispatchErrors = Partial<Record<"minOwnPhotos" | "sites" | "channels" | "dailyQuota" | "window" | "weekdays" | "nonOpener" | "rules", string>>;

export function draftOfConfig(c: CountryConfig): DispatchDraft {
  return { ...c.dispatch, dailyQuota: c.dailyQuota, sendWindowFrom: c.sendWindowFrom, sendWindowTo: c.sendWindowTo };
}

const int = (v: string | null, def: number): number => (v !== null && /^-?\d+$/.test(v.trim()) ? Number(v.trim()) : v === null ? def : NaN);

/** The tab's form → a draft (unknown values stay visible as NaN / filtered, the validation names them). */
export function draftFromDispatchForm(form: URLSearchParams, base: DispatchDraft): DispatchDraft {
  const sites = form.getAll("sites").filter((s): s is DispatchSite => (DISPATCH_SITES as readonly string[]).includes(s));
  const channels = form.getAll("channels").filter((c) => (COUNTRY_CHANNELS as readonly string[]).includes(c));
  const weekdays = form.getAll("weekdays").reduce((m, v) => (/^(1|2|4|8|16|32|64)$/.test(v) ? m | Number(v) : m), 0);
  const rule = (k: string): boolean => form.get(`rule_${k}`) === "1";
  return {
    minOwnPhotos: int(form.get("minOwnPhotos"), base.minOwnPhotos),
    photoMode: form.get("photoMode") === "own_town" ? "own_town" : "own",
    stockOk: form.get("stockOk") === "1",
    sites,
    channels,
    approval: form.get("approval") === "auto" ? "auto" : "owner",
    rules: Object.fromEntries(DISPATCH_RULE_KEYS.map((k) => [k, rule(k)])) as CountryDispatch["rules"],
    weekdays,
    skipHolidays: form.get("skipHolidays") === "1",
    nonOpener: {
      on: form.get("nonOpenerOn") === "1",
      days: int(form.get("nonOpenerDays"), base.nonOpener.days),
      count: 1,
      dailyCap: int(form.get("nonOpenerCap"), base.nonOpener.dailyCap),
    },
    escalationFollowup: form.get("escalationFollowup") === "1",
    dailyQuota: int(form.get("dailyQuota"), base.dailyQuota),
    sendWindowFrom: int(form.get("windowFrom"), base.sendWindowFrom),
    sendWindowTo: int(form.get("windowTo"), base.sendWindowTo),
  };
}

/** field → console-language error; {} = it may be saved. */
export function validateDispatch(d: DispatchDraft, cfg: CountryConfig, lang = "hu"): DispatchErrors {
  const e: DispatchErrors = {};
  if (!Number.isInteger(d.minOwnPhotos) || d.minOwnPhotos < 1 || d.minOwnPhotos > 20) e.minOwnPhotos = T(lang, "1 és 20 közötti egész szám.");
  if (!d.sites.length) e.sites = T(lang, "Legalább egy kör kell — különben semmi nem megy ki.");
  if (!d.channels.length) e.channels = T(lang, "Legalább egy csatorna kell.");
  else if (d.channels.some((c) => !cfg.outreachChannels.includes(c))) e.channels = T(lang, "Csak az országban élő csatorna kapcsolható be (az ország adatai között).");
  else if (!d.channels.includes("email")) e.channels = T(lang, "Az e-mail nem kapcsolható ki: a kiküldő ma csak e-mailt küld (tulaj 2026-11-20).");
  if (!Number.isInteger(d.dailyQuota) || d.dailyQuota < 0 || d.dailyQuota > 5000) e.dailyQuota = T(lang, "0 és 5000 közötti egész szám.");
  if (
    !Number.isInteger(d.sendWindowFrom) || !Number.isInteger(d.sendWindowTo) ||
    d.sendWindowFrom < 0 || d.sendWindowTo > 24 || d.sendWindowFrom >= d.sendWindowTo
  ) e.window = T(lang, "Órák 0–24 között, a kezdés korábbi a zárásnál.");
  if (!d.weekdays) e.weekdays = T(lang, "Legalább egy nap kell.");
  if (!Number.isInteger(d.nonOpener.days) || d.nonOpener.days < 1 || d.nonOpener.days > 90) e.nonOpener = T(lang, "A késleltetés 1 és 90 nap között.");
  else if (!Number.isInteger(d.nonOpener.dailyCap) || d.nonOpener.dailyCap < 0 || d.nonOpener.dailyCap > 5000) e.nonOpener = T(lang, "A napi keret 0 és 5000 között.");
  if (!d.rules.noMailNoSend) e.rules = T(lang, "Az „e-mail cím nélkül nem küldünk” szabály nem kapcsolható ki: a kiküldőben nincs mobil-ág (tulaj 2026-11-20).");
  return e;
}

/** The leads of the country that qualify under `d` NOW (not yet contacted, not blocked, with an e-mail). */
export interface DispatchCount {
  readonly own: number;
  readonly town: number;
  readonly total: number;
}

/**
 * The count the tab shows („holnaptól ennyi lead felel meg”) — the claim's own pieces: own photos
 * (mockPhotoGate.LEAD_OWN_PHOTOS_SQL) against the draft's minimum, the <N branch only in own_town mode,
 * the site class among the draft's classes, an e-mail address (no e-mail = no send, 11-20). The mock,
 * render and quality gates filter on top (the tab says so).
 */
export async function countEligible(iso: string, d: Pick<DispatchDraft, "minOwnPhotos" | "photoMode" | "sites">): Promise<DispatchCount> {
  const sites = d.sites.length ? d.sites : ["__none__"];
  const r = await sql<{ own: string; few: string }>`
    select count(*) filter (where ${LEAD_OWN_PHOTOS_SQL} >= ${d.minOwnPhotos}) as own,
           count(*) filter (where ${LEAD_OWN_PHOTOS_SQL} < ${d.minOwnPhotos}) as few
      from lead l
     where ${LEAD_COUNTRY_SQL} = ${iso}
       and l.contact_block_at is null
       and l.lifecycle_status not in ('disqualified','terminated')
       and (btrim(coalesce(l.raw->>'email','')) <> ''
            or (jsonb_typeof(l.raw->'otherEmails') = 'array'
                and exists (select 1 from jsonb_array_elements_text(l.raw->'otherEmails') e where btrim(e) <> '')))
       and (case
             when l.qualification = 'no_site' or l.raw->>'websiteStatus' in ('none', 'portal_only') then 'no_site'
             when l.qualification = 'outdated' then 'outdated'
             when l.qualification = 'modern' then 'modern'
             else 'unclassified' end) in (${sql.join(sites.map((s) => sql`${s}`))})
       and not exists (select 1 from prospect p where p.lead_id = l.id
             and (p.email_sent_at is not null or p.sms_sent_at is not null or p.mms_sent_at is not null))`.execute(db);
  const own = Number(r.rows[0]?.own ?? 0);
  const town = d.photoMode === "own_town" ? Number(r.rows[0]?.few ?? 0) : 0;
  return { own, town, total: own + town };
}

/** The changes of a draft against the stored row, as operator-language lines „Most → Új”. */
export function dispatchChanges(a: DispatchDraft, b: DispatchDraft, lang = "hu"): { label: string; from: string; to: string }[] {
  const onOff = (v: boolean): string => (v ? T(lang, "be") : T(lang, "ki"));
  const days = (m: number): string =>
    [T(lang, "H"), T(lang, "K"), T(lang, "Sze"), T(lang, "Cs"), T(lang, "P"), T(lang, "Szo"), T(lang, "V")].filter((_, i) => m & (1 << i)).join(" ") || "—";
  const rows: [string, string, string][] = [
    [T(lang, "Minimum saját kép"), String(a.minOwnPhotos), String(b.minOwnPhotos)],
    [T(lang, "Milyen lead mehet"), a.photoMode === "own" ? T(lang, "csak saját képes") : T(lang, "saját + településképes"), b.photoMode === "own" ? T(lang, "csak saját képes") : T(lang, "saját + településképes")],
    [T(lang, "MINTA-kép galéria-/szobahelyen"), onOff(a.stockOk), onOff(b.stockOk)],
    [T(lang, "Honlap szerinti kör"), a.sites.join(" → ") || "—", b.sites.join(" → ") || "—"],
    [T(lang, "Csatornák"), a.channels.join(" → ") || "—", b.channels.join(" → ") || "—"],
    [T(lang, "Napi keret"), String(a.dailyQuota), String(b.dailyQuota)],
    [T(lang, "Jóváhagyás"), a.approval === "auto" ? T(lang, "Automata") : T(lang, "Tulaj-jóváhagyás"), b.approval === "auto" ? T(lang, "Automata") : T(lang, "Tulaj-jóváhagyás")],
    ...DISPATCH_RULE_KEYS.map((k): [string, string, string] => [`${T(lang, "Feltétel")}: ${k}`, onOff(a.rules[k]), onOff(b.rules[k])]),
    [T(lang, "Napok"), days(a.weekdays), days(b.weekdays)],
    [T(lang, "Órák"), `${a.sendWindowFrom}–${a.sendWindowTo}`, `${b.sendWindowFrom}–${b.sendWindowTo}`],
    [T(lang, "Ünnepnapon szünet"), onOff(a.skipHolidays), onOff(b.skipHolidays)],
    [T(lang, "Nem-nyitó levél"), onOff(a.nonOpener.on), onOff(b.nonOpener.on)],
    [T(lang, "Nem-nyitó késleltetés (nap)"), String(a.nonOpener.days), String(b.nonOpener.days)],
    [T(lang, "Nem-nyitó napi keret"), String(a.nonOpener.dailyCap), String(b.nonOpener.dailyCap)],
    [T(lang, "Eszkalációs levél"), onOff(a.escalationFollowup), onOff(b.escalationFollowup)],
  ];
  return rows.filter(([, x, y]) => x !== y).map(([label, from, to]) => ({ label, from, to }));
}

/** Write the draft to the row (validated by the caller) and refresh the snapshot. */
export async function saveDispatch(iso: string, d: DispatchDraft): Promise<void> {
  await db
    .updateTable("country")
    .set({
      dispatch_min_own_photos: d.minOwnPhotos,
      dispatch_photo_mode: d.photoMode,
      dispatch_stock_ok: d.stockOk,
      dispatch_sites: JSON.stringify(d.sites) as never,
      dispatch_channels: JSON.stringify(d.channels) as never,
      dispatch_approval: d.approval,
      dispatch_rules: JSON.stringify(d.rules) as never,
      send_weekdays: d.weekdays,
      skip_holidays: d.skipHolidays,
      nonopener_on: d.nonOpener.on,
      nonopener_days: d.nonOpener.days,
      nonopener_daily_cap: d.nonOpener.dailyCap,
      escalation_followup: d.escalationFollowup,
      daily_quota: d.dailyQuota,
      send_window_from: d.sendWindowFrom,
      send_window_to: d.sendWindowTo,
      updated_at: new Date(),
    })
    .where("iso2", "=", iso)
    .execute();
  await refreshCountries();
}

/** The stored row's draft (null = no row). */
export async function storedDispatch(iso: string): Promise<{ cfg: CountryConfig; draft: DispatchDraft } | null> {
  const cfg = await countryConfig(iso);
  return cfg ? { cfg, draft: draftOfConfig(cfg) } : null;
}

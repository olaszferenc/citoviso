import { deaccent, searchPlace, tokens } from "./enrichPresence.js";
import { webSearch, webSearchAvailable } from "./sources/webSearch.js";
import type { QualifiedLead, Region } from "./types.js";

// Web-search enrichment (catch-all): for no-site leads still missing an email,
// search "name + region + kapcsolat" on the open web and pull contact out of the
// result titles/snippets. Cheap first pass (no page fetch); fetching result pages
// is a later refinement. Only the email-poorest segment is targeted → few queries.
const CONCURRENCY = 3;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE =
  /(?:\+36|0036|06)[\s/().-]*\d{1,2}[\s/().-]*\d{3}[\s/().-]*\d{3,4}/;

// Snippet fishing grabs the FIRST email in the result text — which on a portal
// listing is often the town's tourist office, not the business (the Brave trial
// assigned badacsonytomaj@tourinform.hu to two leads; the Keszthely dry-run
// fished a Sentry ingest hash, a media company's sales address, a portal's own
// address and a university address). Cold-mailing any of these is spam to the
// wrong door, so they are never a contact.
const NON_BUSINESS_EMAIL_RE =
  /tourinform|turisztikaikozpont|onkormanyzat|@.*\.gov\b|sentry|no-?reply|newsletter|webmaster|postmaster|zimmerinfo|centralmediacsoport|@uni-|\.edu\b/i;

/** Machine-generated local parts (long hex hashes) are never a person. */
const HASH_LOCAL_RE = /^[0-9a-f]{16,}@/i;

// TEMPLATE placeholders left in a site's boilerplate — an unfinished page or a
// theme demo. The 2026-08-20 dry-run fished your@domain.com, info@domainem.hu
// ("domain-em" = "my domain") and az@gmail.com ("az" = a two-letter filler).
// Mailing these is either a bounce or a stranger.
const PLACEHOLDER_EMAIL_RE =
  /@(domain|domainem|example|sajatdomain|yourdomain|valami)\.|^(your|youremail|email|sajat|nev|az|xy)@/i;

/** Is this address plausibly the business's own contact? (Reused by reenrich.) */
export function isBusinessEmail(email: string): boolean {
  return (
    !NON_BUSINESS_EMAIL_RE.test(email) &&
    !HASH_LOCAL_RE.test(email) &&
    !PLACEHOLDER_EMAIL_RE.test(email)
  );
}

function firstBusinessEmail(text: string): string | undefined {
  for (const m of text.match(EMAIL_RE) ?? []) {
    if (isBusinessEmail(m)) return m.toLowerCase();
  }
  return undefined;
}

// Freemail providers carry no brand signal — a guesthouse run by one person
// legitimately uses gmail, so these pass on the operator's judgement.
const FREEMAIL =
  /@(gmail|googlemail|freemail|citromail|indamail|vipmail|hotmail|outlook|yahoo|t-online|invitel|upcmail)\./i;

/**
 * CORROBORATION (§F, the tourinform lesson generalized): a snippet-fished
 * address is only a contact if it is tied to THIS business. A branded domain
 * must share a name token with the lead (or with its own site) — otherwise it
 * belongs to whoever else the search results mentioned: an architect's office,
 * a booking agency, a school-trip portal. Freemail has no domain signal, so it
 * passes; the curator sees it either way.
 */
export function isCorroboratedEmail(
  email: string,
  lead: Pick<QualifiedLead, "name" | "website">,
): boolean {
  if (FREEMAIL.test(email)) return true;
  const domain = deaccent(email.split("@")[1]?.toLowerCase() ?? "");
  const nameTokens = tokens(lead.name).filter((t) => t.length >= 4);
  const siteHost = lead.website ? deaccent(lead.website.toLowerCase()) : "";
  const domainCore = domain.split(".")[0] ?? "";
  const matchesName = nameTokens.some((t) => domainCore.includes(t));
  const matchesSite = Boolean(domainCore) && siteHost.includes(domainCore);
  return matchesName || matchesSite;
}

function corroboratedEmail(
  email: string | undefined,
  lead: QualifiedLead,
): string | undefined {
  if (!email) return undefined;
  return isCorroboratedEmail(email, lead) ? email : undefined;
}

/**
 * Strip zero-width/invisible characters a snippet can carry (a BOM inside a
 * phone number would break tel: links and dialing).
 */
function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  let cleaned = phone.replace(/[​-‍﻿]/g, "").trim();
  // Snippets truncate mid-number, leaving an unbalanced bracket: "0036)85-…",
  // "+36) 30 985…", "06 87) 464 313". Drop brackets that have no partner —
  // a stray ")" breaks tel: links.
  const opens = (cleaned.match(/\(/g) ?? []).length;
  const closes = (cleaned.match(/\)/g) ?? []).length;
  if (opens !== closes) cleaned = cleaned.replace(/[()]/g, "");
  return cleaned.replace(/\s{2,}/g, " ").trim() || undefined;
}

export async function enrichWebSearch(
  leads: QualifiedLead[],
  apiKey: string,
  cseId: string,
  region: Region,
): Promise<QualifiedLead[]> {
  // Any configured backend will do (Brave primary, CSE legacy) — the old
  // CSE-credential guard silently skipped contact search on Brave-only configs.
  if (!webSearchAvailable()) return leads;

  // A stored address that is NOT tied to this business must not block the
  // search — that is how "Ferenc Ház" kept info@keszthelyinfo.hu (a portal's
  // own address, inherited from an earlier scrape) while the correct
  // ferenchaz.szentbekkalla@gmail.com sat in the very search results we never
  // ran. Having a wrong contact is worse than having none: it silently ends
  // the hunt AND aims the cold email at a stranger.
  const targets = leads.filter(
    (l) =>
      (!l.email || !isCorroboratedEmail(l.email, l)) &&
      (l.websiteStatus === "none" || l.websiteStatus === "portal_only"),
  );
  const found = new Map<QualifiedLead, { email?: string; phone?: string }>();

  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++];
      try {
        // Same geo rule as the site search: the lead's own town, not the region
        // label. "Tekergő keszthely és környéke kapcsolat" describes no business.
        const results = await webSearch(
          `${lead.name} ${searchPlace(lead, region)} kapcsolat`,
          apiKey,
          cseId,
          5,
        );
        const text = results.map((r) => `${r.title} ${r.snippet}`).join(" ");
        const email = corroboratedEmail(firstBusinessEmail(text), lead);
        const phone = lead.phone ? undefined : normalizePhone(text.match(PHONE_RE)?.[0]);
        if (email || phone) found.set(lead, { email, phone });
      } catch {
        // search/network failure — skip this lead
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () =>
      worker(),
    ),
  );

  // SHARED-CONTACT GUARD: one phone number belongs to one business. When the
  // same number is fished for several leads it is an intermediary's — a tourist
  // office, a booking agency, a village hall (the 2026-08-20 run gave
  // +36 87 531 013, the Badacsonytomaj tourinform, to two guesthouses). We
  // cannot tell WHICH lead it might legitimately belong to, so none of them
  // gets it. Same for a shared email that slipped past corroboration.
  const phoneCount = new Map<string, number>();
  const emailCount = new Map<string, number>();
  for (const f of found.values()) {
    if (f.phone) phoneCount.set(f.phone, (phoneCount.get(f.phone) ?? 0) + 1);
    if (f.email) emailCount.set(f.email, (emailCount.get(f.email) ?? 0) + 1);
  }
  for (const [lead, f] of found) {
    const sharedPhone = f.phone && (phoneCount.get(f.phone) ?? 0) > 1;
    const sharedEmail = f.email && (emailCount.get(f.email) ?? 0) > 1;
    if (sharedPhone || sharedEmail) {
      found.set(lead, {
        email: sharedEmail ? undefined : f.email,
        phone: sharedPhone ? undefined : f.phone,
      });
    }
  }

  return leads.map((l) => {
    const f = found.get(l);
    if (!f) return l;
    // A corroborated find BEATS an uncorroborated stored address (the portal's
    // own contact). Anything corroborated already stored is left alone.
    const storedIsWeak = Boolean(l.email) && !isCorroboratedEmail(l.email!, l);
    const email = storedIsWeak ? (f.email ?? l.email) : (l.email ?? f.email);
    return { ...l, email, phone: l.phone ?? f.phone };
  });
}

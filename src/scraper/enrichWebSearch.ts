import {
  deaccent,
  fetchHtml,
  geoTerms,
  searchPlace,
  tokens,
  verify,
} from "./enrichPresence.js";
import { classifyWebsite } from "./qualify.js";
import { webSearch, webSearchAvailable } from "./sources/webSearch.js";
import type { PortalListing, QualifiedLead, Region } from "./types.js";

// Web-search enrichment (catch-all): find contact details for leads whose own
// site we could not confirm.
//
// TWO PASSES, cheap first (2026-08-20, owner test "Ferenc Ház"):
//   1. SNIPPET — free, but a search snippet is ~160 chars of marketing text and
//      usually has no address in it at all.
//   2. PAGE READ — fetch the top results and read the contact block out of the
//      HTML. This is what a human (or an LLM handed the page) does, and it is
//      why manual lookup beat this pipeline: kali.hu/szallas/ferenc carries the
//      owner's name, two phone numbers and the e-mail, none of it in the snippet.
//
// A PORTAL LISTING IS A LEGITIMATE CONTACT SOURCE. It is not an own website
// (that judgement stays in enrichSiteSearch/classifyWebsite), but the business
// itself put its details there, so for contact purposes we read it gladly.
// The page must still be ABOUT this lead — same brand+locality verify() as the
// site search — or we would harvest the neighbouring listing's phone number.
const CONCURRENCY = 3;
/** Pages fetched per lead when snippets yield nothing usable. */
const MAX_PAGES_PER_LEAD = 3;
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

/** Trade words that identify nothing on their own — a portal's own landing page
 *  ("Szállás Keszthelyen") must not count as an entry about this lead. */
const GENERIC_NAME_TOKEN = new Set([
  "szallas", "szallashely", "apartman", "apartmanok", "kemping", "camping",
  "udulo", "vendeghaz", "vendeghazak", "panzio", "hotel", "haz", "villa",
  "tabor", "hely", "etterem", "vendeglo", "szoba", "szobak", "motel",
]);

/**
 * Is this URL a listing ABOUT the business rather than the business's own site?
 * Social profiles count: the owner controls the page but not the platform, and
 * "you are only on Facebook" is precisely our sales case. The lead's own site
 * is excluded — it is shown separately and is not a footprint elsewhere.
 */
function isListingHost(url: string, ownWebsite?: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  if (ownWebsite) {
    try {
      if (new URL(ownWebsite).hostname.toLowerCase().replace(/^www\./, "") === host) {
        return false;
      }
    } catch {
      /* stored site is not a URL — treat the hit as a listing */
    }
  }
  // Maps/search infrastructure is not a "presence" the owner could claim.
  if (/(^|\.)(google|waze|bing|yandex)\./.test(host)) return false;
  return classifyWebsite(url) !== "has_own" || /facebook|instagram/.test(host);
}

/**
 * Pull contact details out of a fetched page. `mailto:`/`tel:` links come
 * first: an explicit contact link is the owner's own declaration, while prose
 * may quote somebody else's address. Tags are stripped before the text scan so
 * markup cannot glue two numbers together.
 */
function extractContacts(html: string): { emails: string[]; phones: string[] } {
  const emails: string[] = [];
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    emails.push(decodeURIComponent(m[1]!).toLowerCase());
  }
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ");
  for (const m of text.matchAll(EMAIL_RE)) emails.push(m[0].toLowerCase());

  const phones: string[] = [];
  for (const m of html.matchAll(/tel:([+0-9\s()./-]{7,})/gi)) phones.push(m[1]!.trim());
  const textPhone = text.match(PHONE_RE)?.[0];
  if (textPhone) phones.push(textPhone);

  return { emails: [...new Set(emails)], phones: [...new Set(phones)] };
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
  //
  // The TRIGGER IS THE MISSING CONTACT, not the website status. Restricting
  // this to none/portal_only leads meant a lead WITH a site never got a contact
  // search — including "Bánó Porta", whose site 404s, so it yielded no address
  // while a live one sat on a portal page. Owning a (dead) website is no reason
  // to be unreachable; without an address the lead cannot be contacted at all,
  // which is the whole point of the pipeline.
  const targets = leads.filter(
    (l) => !l.email || !isCorroboratedEmail(l.email, l),
  );
  const found = new Map<
    QualifiedLead,
    { email?: string; phone?: string; listings?: PortalListing[] }
  >();

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
        // PASS 1 — snippets (free).
        const text = results.map((r) => `${r.title} ${r.snippet}`).join(" ");
        let email = corroboratedEmail(firstBusinessEmail(text), lead);
        let phone = lead.phone
          ? undefined
          : normalizePhone(text.match(PHONE_RE)?.[0]);

        const terms = geoTerms(lead, region);
        // DIGITAL FOOTPRINT, from the results we already have: portal pages that
        // name this business. Free — no extra request. A hit counts when the
        // title carries a brand token (a generic "szállás Keszthely" title is
        // the portal's own landing page, not an entry about this lead) and the
        // host is not the lead's own site.
        const listings: PortalListing[] = [];
        const brand = tokens(lead.name).filter(
          (t) => t.length >= 4 && !GENERIC_NAME_TOKEN.has(t),
        );
        for (const r of results) {
          if (!r.link || !isListingHost(r.link, lead.website)) continue;
          const hay = deaccent(`${r.title} ${r.snippet}`.toLowerCase());
          if (!brand.some((t) => hay.includes(t))) continue;
          if (listings.some((x) => x.url === r.link)) continue;
          listings.push({ url: r.link, title: r.title.slice(0, 120) });
        }

        // PASS 2 — read the pages. Only when the snippets left something open,
        // so a lead answered by pass 1 costs no extra fetches.
        if (!email || !phone) {
          for (const r of results.slice(0, MAX_PAGES_PER_LEAD)) {
            if (!r.link) continue;
            const page = await fetchHtml(r.link);
            // The page must be ABOUT this business (brand AND locality) —
            // otherwise we would lift the neighbouring listing's details.
            if (!page || !verify(lead.name, terms, page.html)) continue;
            const { emails, phones } = extractContacts(page.html);
            // We READ this page and it checked out — promote it from "mentions
            // the name" to a verified listing (or add it if the title was terse).
            const known = listings.find((x) => x.url === r.link);
            if (known) (known as { verified?: boolean }).verified = true;
            else if (isListingHost(r.link, lead.website)) {
              listings.push({ url: r.link, title: r.title.slice(0, 120), verified: true });
            }
            if (!email) {
              email = emails.find(
                (e) => isBusinessEmail(e) && isCorroboratedEmail(e, lead),
              );
            }
            if (!phone) {
              phone = normalizePhone(
                phones.find((p) => PHONE_RE.test(p.replace(/\s/g, "")) || PHONE_RE.test(p)),
              );
            }
            if (email && phone) break;
          }
        }
        if (email || phone || listings.length) found.set(lead, { email, phone, listings });
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
    // Listings MERGE with what is already known (a re-run must not lose an
    // entry a previous pass found), newest verdict winning per URL.
    const byUrl = new Map<string, PortalListing>();
    for (const x of [...(l.listings ?? []), ...(f.listings ?? [])]) {
      const prev = byUrl.get(x.url);
      byUrl.set(x.url, prev?.verified ? { ...x, verified: true } : x);
    }
    return {
      ...l,
      email,
      phone: l.phone ?? f.phone,
      listings: byUrl.size ? [...byUrl.values()] : l.listings,
    };
  });
}

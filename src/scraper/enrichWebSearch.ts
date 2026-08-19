import { webSearch, webSearchAvailable } from "./sources/webSearch.js";
import type { QualifiedLead } from "./types.js";

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
  /tourinform|onkormanyzat|@.*\.gov\b|sentry|no-?reply|newsletter|webmaster|postmaster|zimmerinfo|centralmediacsoport|@uni-|\.edu\b/i;

/** Machine-generated local parts (long hex hashes) are never a person. */
const HASH_LOCAL_RE = /^[0-9a-f]{16,}@/i;

/** Is this address plausibly the business's own contact? (Reused by reenrich.) */
export function isBusinessEmail(email: string): boolean {
  return !NON_BUSINESS_EMAIL_RE.test(email) && !HASH_LOCAL_RE.test(email);
}

function firstBusinessEmail(text: string): string | undefined {
  for (const m of text.match(EMAIL_RE) ?? []) {
    if (isBusinessEmail(m)) return m.toLowerCase();
  }
  return undefined;
}

export async function enrichWebSearch(
  leads: QualifiedLead[],
  apiKey: string,
  cseId: string,
  region: string,
): Promise<QualifiedLead[]> {
  // Any configured backend will do (Brave primary, CSE legacy) — the old
  // CSE-credential guard silently skipped contact search on Brave-only configs.
  if (!webSearchAvailable()) return leads;

  const targets = leads.filter(
    (l) =>
      !l.email &&
      (l.websiteStatus === "none" || l.websiteStatus === "portal_only"),
  );
  const found = new Map<QualifiedLead, { email?: string; phone?: string }>();

  let next = 0;
  async function worker(): Promise<void> {
    while (next < targets.length) {
      const lead = targets[next++];
      try {
        const results = await webSearch(
          `${lead.name} ${region} kapcsolat`,
          apiKey,
          cseId,
          5,
        );
        const text = results.map((r) => `${r.title} ${r.snippet}`).join(" ");
        const email = firstBusinessEmail(text);
        const phone = lead.phone ? undefined : text.match(PHONE_RE)?.[0];
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

  return leads.map((l) => {
    const f = found.get(l);
    if (!f) return l;
    return { ...l, email: l.email ?? f.email, phone: l.phone ?? f.phone };
  });
}

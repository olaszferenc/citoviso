import { webSearch } from "./sources/webSearch.js";
import type { QualifiedLead } from "./types.js";

// Web-search enrichment (catch-all): for no-site leads still missing an email,
// search "name + region + kapcsolat" on the open web and pull contact out of the
// result titles/snippets. Cheap first pass (no page fetch); fetching result pages
// is a later refinement. Only the email-poorest segment is targeted → few queries.
const CONCURRENCY = 3;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE =
  /(?:\+36|0036|06)[\s/().-]*\d{1,2}[\s/().-]*\d{3}[\s/().-]*\d{3,4}/;

export async function enrichWebSearch(
  leads: QualifiedLead[],
  apiKey: string,
  cseId: string,
  region: string,
): Promise<QualifiedLead[]> {
  if (!apiKey || !cseId) return leads;

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
        const email = text.match(EMAIL_RE)?.[0]?.toLowerCase();
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

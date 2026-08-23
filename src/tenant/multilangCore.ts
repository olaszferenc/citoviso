// ADR-0063 „Többnyelvű honlap" — the CORE shared by the editor (stale detection,
// snapshot decoration) and the paid generation flow. This file must NOT import
// editor.ts (the editor imports us).
//
// The model: the tenant pays ONCE for a 3-language generation of the site's
// CURRENT persisted content. The canonical content hash computed here is the
// anchor of that purchase — any later content save produces a different hash,
// which flips the state to 'stale' (the served translations keep showing the
// last PAID state until a new paid generation replaces them).

import { createHash } from "node:crypto";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import type { Recipe, SiteData } from "../engine/recipe.js";
import { langName } from "../i18n/lang.js";

/** The site's units as moduleContentFor returns them (structural type — no editor import). */
export interface TranslatableUnit {
  id: string;
  name: string;
  slug: string | null;
  capacity: number | null;
  description: string | null;
  amenities: string[];
}

/**
 * Every visitor-visible FREE-TEXT string of the effective site content, deduped.
 * String-keyed on purpose: the same source string is translated ONCE and applied
 * everywhere it occurs (unit names appear in units, pricing and booking — an
 * inconsistent per-occurrence translation would break the name-joins between them).
 *
 * Deliberately NOT collected:
 *  · `name` (site) — the property's proper name, never translated;
 *  · `reviews` — authentic guest quotes (§B.17: a quote in another language is
 *    no longer the guest's words);
 *  · `contact.address` — postal reality, not prose.
 */
export function collectTranslatableStrings(
  data: SiteData,
  units: readonly TranslatableUnit[] = [],
  recipe?: Recipe,
): string[] {
  const out = new Set<string>();
  const add = (s: string | undefined | null) => {
    const v = (s ?? "").trim();
    if (v) out.add(v);
  };
  add(data.tagline);
  add(data.intro);
  for (const h of data.highlights ?? []) add(h);
  for (const a of data.amenities ?? []) add(a);
  for (const u of data.usp ?? []) add(u);
  for (const p of data.poi ?? []) add(p);
  add(data.hours?.note);
  for (const r of data.rooms ?? []) {
    add(r.name);
    add(r.capacity);
    add(r.note);
    add(r.price);
  }
  for (const f of data.faqs ?? []) {
    add(f.q);
    add(f.a);
  }
  for (const s of data.stats ?? []) {
    add(s.label);
    add(s.value);
  }
  for (const p of data.photos ?? []) add(p.alt);
  add(data.pricing?.note);
  for (const u of data.pricing?.units ?? []) {
    add(u.name);
    for (const s of u.seasons ?? []) add(s.label);
  }
  add(data.location?.approachNote);
  add(data.location?.parkingNote);
  add(data.newsletter?.title);
  add(data.newsletter?.subtitle);
  for (const u of data.booking?.units ?? []) add(u.name);
  add(data.booking?.responseNote);
  for (const u of units) {
    add(u.name);
    add(u.description);
    for (const a of u.amenities) add(a);
  }
  // The recipe's editorial voice (SectionCopy) — measured live: without it the
  // section kickers/headings stayed Hungarian on the German page. `accent` is NOT
  // collected on its own: it must be a SUBSTRING of the (translated) title/lead,
  // which translateRecipe re-establishes or drops.
  for (const s of recipe?.sections ?? []) {
    add(s.copy?.eyebrow);
    add(s.copy?.title);
    add(s.copy?.lead);
    // Collected so the accent has a CHANCE to survive: it lives on only when its
    // translation lands as a literal substring of the translated title/lead.
    add(s.copy?.accent);
  }
  return [...out];
}

/**
 * Apply the translation map to the recipe's editorial copy (SectionCopy). The
 * `accent` highlight is a substring of the title/lead by contract — it survives
 * only if its translation is literally contained in the translated carrier;
 * otherwise it is dropped (the accent is optional everywhere, a missing italic
 * tone beats a broken highlight).
 */
export function translateRecipe(recipe: Recipe, map: Readonly<Record<string, string>>): Recipe {
  const tr = (s: string | undefined): string | undefined => {
    const v = (s ?? "").trim();
    return v ? (map[v] ?? v) : undefined;
  };
  return {
    ...recipe,
    sections: recipe.sections.map((s) => {
      if (!s.copy) return s;
      const title = tr(s.copy.title);
      const lead = tr(s.copy.lead);
      const eyebrow = tr(s.copy.eyebrow);
      const accentTr = tr(s.copy.accent);
      const accentOk =
        accentTr && ((title?.includes(accentTr) ?? false) || (lead?.includes(accentTr) ?? false));
      return {
        ...s,
        copy: {
          ...(eyebrow ? { eyebrow } : {}),
          ...(title ? { title } : {}),
          ...(lead ? { lead } : {}),
          ...(accentOk ? { accent: accentTr } : {}),
        },
      };
    }),
  };
}

/**
 * Canonical hash of the translatable content — THE anchor of a paid generation
 * (ADR-0063 §4). Sorted so field-traversal order can never flip the state; a
 * hash change means the tenant actually changed visible text.
 */
export function multilangContentHash(
  data: SiteData,
  units: readonly TranslatableUnit[] = [],
  recipe?: Recipe,
): string {
  const strings = collectTranslatableStrings(data, units, recipe).sort();
  return createHash("sha256").update(JSON.stringify(strings)).digest("hex");
}

/** Apply a source→translated map to the site data + units, consistently. */
export function applyTranslationMap(
  data: SiteData,
  units: readonly TranslatableUnit[],
  map: Readonly<Record<string, string>>,
  targetLang: string,
): { data: SiteData; units: TranslatableUnit[] } {
  const tr = (s: string | undefined | null): string | undefined => {
    const v = (s ?? "").trim();
    if (!v) return undefined;
    return map[v] ?? v; // missing translation → source survives (loud in review, never blank)
  };
  const trReq = (s: string): string => tr(s) ?? s;
  const out: SiteData = {
    ...data,
    lang: targetLang,
    tagline: trReq(data.tagline),
    intro: trReq(data.intro),
    highlights: (data.highlights ?? []).map(trReq),
    ...(data.amenities ? { amenities: data.amenities.map(trReq) } : {}),
    ...(data.usp ? { usp: data.usp.map(trReq) } : {}),
    ...(data.poi ? { poi: data.poi.map(trReq) } : {}),
    ...(data.hours ? { hours: { ...data.hours, ...(data.hours.note ? { note: trReq(data.hours.note) } : {}) } } : {}),
    ...(data.rooms
      ? {
          rooms: data.rooms.map((r) => ({
            ...r,
            name: trReq(r.name),
            ...(r.capacity ? { capacity: trReq(r.capacity) } : {}),
            ...(r.note ? { note: trReq(r.note) } : {}),
            ...(r.price ? { price: trReq(r.price) } : {}),
          })),
        }
      : {}),
    ...(data.faqs ? { faqs: data.faqs.map((f) => ({ q: trReq(f.q), a: trReq(f.a) })) } : {}),
    ...(data.stats
      ? { stats: data.stats.map((s) => ({ ...s, label: trReq(s.label), value: trReq(s.value) })) }
      : {}),
    photos: (data.photos ?? []).map((p) => ({ ...p, alt: trReq(p.alt) })),
    ...(data.pricing
      ? {
          pricing: {
            ...data.pricing,
            ...(data.pricing.note ? { note: trReq(data.pricing.note) } : {}),
            ...(data.pricing.units
              ? {
                  units: data.pricing.units.map((u) => ({
                    ...u,
                    name: trReq(u.name),
                    ...(u.seasons
                      ? { seasons: u.seasons.map((s) => ({ ...s, label: trReq(s.label) })) }
                      : {}),
                  })),
                }
              : {}),
          },
        }
      : {}),
    ...(data.location
      ? {
          location: {
            ...data.location,
            ...(data.location.approachNote ? { approachNote: trReq(data.location.approachNote) } : {}),
            ...(data.location.parkingNote ? { parkingNote: trReq(data.location.parkingNote) } : {}),
          },
        }
      : {}),
    ...(data.newsletter
      ? {
          newsletter: {
            ...(data.newsletter.title ? { title: trReq(data.newsletter.title) } : {}),
            ...(data.newsletter.subtitle ? { subtitle: trReq(data.newsletter.subtitle) } : {}),
          },
        }
      : {}),
    ...(data.booking
      ? {
          booking: {
            ...data.booking,
            units: data.booking.units.map((u) => ({ ...u, name: trReq(u.name) })),
            ...(data.booking.responseNote ? { responseNote: trReq(data.booking.responseNote) } : {}),
          },
        }
      : {}),
  };
  const outUnits = units.map((u) => ({
    ...u,
    name: trReq(u.name),
    description: tr(u.description) ?? u.description,
    amenities: u.amenities.map(trReq),
  }));
  return { data: out, units: outUnits };
}

export interface MultilangState {
  readonly siteId: string;
  readonly languages: string[];
  readonly status: "active" | "stale";
  readonly contentHash: string;
  readonly generatedAt: Date;
  readonly notifiedAt: Date | null;
}

/** The site's current paid translation state, or null when never purchased. */
export async function getMultilang(siteId: string): Promise<MultilangState | null> {
  const row = await db
    .selectFrom("site_multilang")
    .selectAll()
    .where("site_id", "=", siteId)
    .executeTakeFirst();
  if (!row) return null;
  return {
    siteId: row.site_id,
    languages: row.languages,
    status: row.status,
    contentHash: row.content_hash,
    generatedAt: row.generated_at as unknown as Date,
    notifiedAt: (row.notified_at as unknown as Date) ?? null,
  };
}

/**
 * ADR-0063 §4: compare the CURRENT content hash with the paid one; a mismatch
 * flips the state to 'stale'. Returns whether this call NEWLY staled it (the
 * caller sends ONE notification per stale episode, not one per keystroke) —
 * and whether a matching hash healed a stale state (a paid generation just ran,
 * or the tenant edited the text back to the paid wording).
 */
export async function reconcileMultilangState(
  siteId: string,
  currentHash: string,
): Promise<{ newlyStale: boolean; state: MultilangState | null }> {
  const state = await getMultilang(siteId);
  if (!state) return { newlyStale: false, state: null };
  if (state.contentHash === currentHash) {
    if (state.status === "stale") {
      await db
        .updateTable("site_multilang")
        .set({ status: "active", notified_at: null, updated_at: new Date() as unknown as never })
        .where("site_id", "=", siteId)
        .execute();
      return { newlyStale: false, state: { ...state, status: "active", notifiedAt: null } };
    }
    return { newlyStale: false, state };
  }
  if (state.status === "stale") return { newlyStale: false, state };
  await db
    .updateTable("site_multilang")
    .set({ status: "stale", updated_at: new Date() as unknown as never })
    .where("site_id", "=", siteId)
    .execute();
  return { newlyStale: true, state: { ...state, status: "stale" } };
}

/**
 * ADR-0063 §4: tell the tenant their translations went stale — ONE mail per stale
 * episode (guarded by notified_at; reconcileMultilangState clears it on heal).
 * Hungarian body, matching the existing tenant mails (loginEmail.ts precedent —
 * the tenant-facing mail surface is Hungarian today).
 */
export async function notifyMultilangStale(tenantId: string, siteId: string): Promise<void> {
  const state = await getMultilang(siteId);
  if (!state || state.status !== "stale" || state.notifiedAt) return;
  const user = await db
    .selectFrom("tenant_user")
    .select(["contact_email"])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!user?.contact_email) return;
  const adminUrl = `${config.publicSiteUrl.replace(/\/$/, "")}/admin`;
  const langs = state.languages.map((l) => langName(l)).join(", ");
  await getEmailSender().send({
    to: user.contact_email,
    subject: "A honlapja idegen nyelvű változatai elavultak",
    text:
      `Kedves Partnerünk!\n\n` +
      `Ön módosította a honlapja tartalmát, ezért a korábban legenerált idegen nyelvű ` +
      `változatok (${langs}) már nem a friss szöveget mutatják. A lefordított oldalak ` +
      `továbbra is elérhetők a legutóbb kifizetett állapotukban.\n\n` +
      `Ha szeretné, hogy a fordítások is a friss tartalmat mutassák, az admin felületen ` +
      `a „Többnyelvű honlap" résznél indíthatja el az újragenerálást (a generálás díja ` +
      `alkalmanként fizetendő):\n${adminUrl}\n\n` +
      `Üdvözlettel,\nCitoviso`,
  });
  await markMultilangNotified(siteId);
}

/** Stamp that the stale notification went out (one mail per episode). Guarded on
 *  status: if a heal raced the in-flight send, stamping the now-ACTIVE row would
 *  silently suppress the NEXT stale episode's mail. */
export async function markMultilangNotified(siteId: string): Promise<void> {
  await db
    .updateTable("site_multilang")
    .set({ notified_at: new Date(), updated_at: new Date() as unknown as never })
    .where("site_id", "=", siteId)
    .where("status", "=", "stale")
    .execute();
}

/**
 * Inject the language layer into a rendered snapshot: hreflang alternates in the
 * head (ADR-0041 — a language page is URL production) + a small fixed language
 * switcher. Deterministic string surgery, same pattern as toPrivatePreview.
 * `current` = the language of THIS page; the primary lives at "/", a translation
 * at "/<lang>/". Colors come from the site's own --cit-* tokens (design doctrine).
 */
export function decorateWithLanguages(
  html: string,
  opts: {
    readonly current: string;
    readonly primaryLang: string;
    readonly languages: readonly string[];
    /** Canonical absolute base (https://host) when known — hreflang needs absolute URLs. */
    readonly baseUrl?: string;
  },
): string {
  const all = [opts.primaryLang, ...opts.languages.filter((l) => l !== opts.primaryLang)];
  const hrefOf = (lang: string) => (lang === opts.primaryLang ? "/" : `/${lang}/`);
  const head = opts.baseUrl
    ? all
        .map(
          (l) =>
            `<link rel="alternate" hreflang="${l}" href="${opts.baseUrl}${hrefOf(l)}">`,
        )
        .concat(`<link rel="alternate" hreflang="x-default" href="${opts.baseUrl}/">`)
        .join("\n  ")
    : "";
  const links = all
    .map((l) => {
      const active = l === opts.current;
      const label = l.toUpperCase();
      return active
        ? `<span class="cit-lang-on" aria-current="true" title="${langName(l)}">${label}</span>`
        : `<a href="${hrefOf(l)}" title="${langName(l)}">${label}</a>`;
    })
    .join("");
  const widget = `
<div class="cit-lang-switch" data-cit-module="multilang">
  <style>
    /* Skin tokens only (§B design doctrine) — the engine's :root guarantees them. */
    .cit-lang-switch{position:fixed;top:12px;right:12px;z-index:60;display:flex;gap:2px;
      padding:4px;border-radius:var(--cit-radius);
      background:color-mix(in srgb, var(--cit-surface) 85%, transparent);
      backdrop-filter:blur(6px);font:600 12px/1 var(--cit-font-body);}
    .cit-lang-switch a,.cit-lang-switch .cit-lang-on{display:inline-block;min-width:32px;
      padding:8px 6px;text-align:center;border-radius:calc(var(--cit-radius) - 4px);
      color:var(--cit-ink);text-decoration:none;letter-spacing:.04em;}
    .cit-lang-switch a:hover{background:color-mix(in srgb, var(--cit-accent) 25%, transparent);}
    .cit-lang-switch .cit-lang-on{background:var(--cit-accent);color:var(--cit-on-accent);}
  </style>
  ${links}
  <script>(function(){
    /* DEV slug-path fix: on /t/<slug>/… the root-relative links must keep the
       prefix (a local tester's tap would otherwise leave the site). No-op on
       the real hosts, where the pathname never starts with /t/. */
    var m=location.pathname.match(/^\\/t\\/[a-z0-9-]+/);if(!m)return;
    document.querySelectorAll(".cit-lang-switch a").forEach(function(a){
      a.setAttribute("href",m[0]+a.getAttribute("href"));
    });
  })();</script>
</div>`;
  let out = html;
  if (head && out.includes("</head>")) out = out.replace("</head>", `  ${head}\n</head>`);
  if (out.includes("</body>")) out = out.replace("</body>", `${widget}\n</body>`);
  else out += widget;
  return out;
}

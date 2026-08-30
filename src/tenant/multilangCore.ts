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
import { amenityIconIdFor } from "../engine/amenityIcon.js";
import { langName } from "../i18n/lang.js";
import { flagSvg } from "../ui/flags.js";
import { T, langForTenant, langNameLocalized, prepareMailLang } from "../i18n/mail.js";
import { logTenantMessage } from "./messages.js";

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
  // AMENITY ICON BRIDGE (2026-08-27): the guest page resolves amenity icons by
  // exact catalogue label — which the translation below is about to replace.
  // This is the one point where source and translation are both in hand, so
  // record translated-label → catalogue id for every source that IS a catalogue
  // label. Covers amenities, unit amenities and woven highlights alike.
  const amenityIconMap: Record<string, string> = { ...(data.amenityIconMap ?? {}) };
  for (const [src, translated] of Object.entries(map)) {
    const id = amenityIconIdFor(src);
    if (id) amenityIconMap[translated] = id;
  }
  const out: SiteData = {
    ...data,
    lang: targetLang,
    tagline: trReq(data.tagline),
    intro: trReq(data.intro),
    highlights: (data.highlights ?? []).map(trReq),
    ...(data.amenities ? { amenities: data.amenities.map(trReq) } : {}),
    ...(Object.keys(amenityIconMap).length ? { amenityIconMap } : {}),
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
  // ADR-0067: the tenant is written to in THEIR site's language, never Hungarian
  // by default. The language names inside the sentence are localized too — a
  // Polish owner must not read "német (Deutsch)".
  const lang = await prepareMailLang(await langForTenant(tenantId));
  const langs = state.languages.map((l) => langNameLocalized(l, lang)).join(", ");
  const msg = {
    to: user.contact_email,
    // Our own service notice to the tenant, no guest data → pilot BCC applies.
    audience: "platform" as const,
    subject: T(lang, "A honlapja idegen nyelvű változatai elavultak"),
    text:
      T(lang, "Kedves Partnerünk!") +
      "\n\n" +
      T(
        lang,
        "Ön módosította a honlapja tartalmát, ezért a korábban legenerált idegen nyelvű változatok ({langs}) már nem a friss szöveget mutatják. A lefordított oldalak továbbra is elérhetők a legutóbb kifizetett állapotukban.",
        { langs },
      ) +
      "\n\n" +
      T(
        lang,
        "Ha szeretné, hogy a fordítások is a friss tartalmat mutassák, az admin felületen a „Többnyelvű honlap” résznél indíthatja el az újragenerálást (a generálás díja alkalmanként fizetendő):",
      ) +
      `\n${adminUrl}\n\n` +
      T(lang, "Üdvözlettel,") +
      "\nCitoviso",
  };
  await getEmailSender().send(msg);
  // ADR-0084: into the tenant's own mailbox too.
  await logTenantMessage({
    tenantId,
    channel: "email",
    kind: "multilang",
    subject: msg.subject,
    bodyText: msg.text,
    recipient: msg.to,
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
 * Inject the language layer into a rendered snapshot — the APPROVED design
 * (assets/design-refs/tenant-site/README.md, tulaj 2026-08-29).
 *
 * ⛔ MIÉRT NEM LEBEGŐ ELEM (mérve, 16 sablon × 2 nézet): az első változat egy
 * fixen lebegő kapcsoló volt z-index:60-nal, és a tulaj tesztjén EGYÁLTALÁN NEM
 * LÁTSZOTT — a sablonok saját fejléce (z-index:100) eltakarta. Az akkori őr azt
 * mérte, hogy a kapcsoló BENNE VAN-e a HTML-ben; a látogató viszont azt látja,
 * ami a képernyőn legfelül van.
 *
 * A megoldás sablon-tudatos, nem globális:
 *   · ASZTALI — a chip a lap SAJÁT menüsorába szövődik (az utolsó menü-link mellé),
 *     így a sablon elrendezése tartja meg: nem takarhat el menüt vagy CTA-t;
 *   · MOBIL  — külön sáv a lap tetején, NEM sticky (görgetéskor kimegy), mert
 *     6 sablon mobilon elrejti a navot, ott a beszőtt chip eltűnne.
 * Zászló + NÉV (inline SVG, emoji tilos §B); a váltás valódi navigáció.
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
  // A nyelv SAJÁT neve (endonim), nagy kezdőbetűvel: a "német (Deutsch)" alakból a
  // vendégnek a "Deutsch" mond valamit — a magyar exonim neki idegen. A LANG_NAME
  // magyarul kisbetűs ("magyar"), feliratként viszont nagybetűvel kezdünk.
  const label = (lang: string) => {
    // Példa: német (Deutsch) → Deutsch; magyar → Magyar.
    const raw = langName(lang);
    // A zárójeles rész az ENDONIM — azt tartjuk meg, a magyar exonimot eldobjuk
    // (a vendégnek az endonim mond valamit, nem a magyar exonim). ⚠️ Első
    // próbálkozásom a zárójelet a TARTALMÁRA cserélte, amitől a két név
    // összeragadt — a mobil sávon azonnal látszott.
    const endonym = /\(([^)]+)\)\s*$/.exec(raw)?.[1] ?? raw;
    const name = endonym.trim() || lang;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const head = opts.baseUrl
    ? all
        .map((l) => `<link rel="alternate" hreflang="${l}" href="${opts.baseUrl}${hrefOf(l)}">`)
        .concat(`<link rel="alternate" hreflang="x-default" href="${opts.baseUrl}/">`)
        .join("\n  ")
    : "";

  const item = (l: string, cls: string) =>
    `<a class="${cls}${l === opts.current ? " on" : ""}" href="${hrefOf(l)}" hreflang="${l}"` +
    `${l === opts.current ? ' aria-current="true"' : ""}>${flagSvg(l, 18)}<span>${label(l)}</span></a>`;

  // ASZTALI: lenyíló chip (JS nélkül is működik — <details>).
  const chip =
    `<span class="cit-lang-nav" data-cit-module="multilang">` +
    `<details class="cit-lang-dd"><summary>${flagSvg(opts.current, 18)}` +
    `<span>${label(opts.current)}</span><i aria-hidden="true">▾</i></summary>` +
    `<div class="cit-lang-list">${all.map((l) => item(l, "cit-lang-o")).join("")}</div>` +
    `</details></span>`;
  // MOBIL: saját sáv a lap tetején.
  const bar =
    `<div class="cit-lang-bar" data-cit-module="multilang">` +
    `${all.map((l) => item(l, "cit-lang-i")).join("")}</div>`;

  const css = `<style data-cit-lang>
.cit-lang-dd{position:relative;font:600 12px/1 var(--cit-font-body)}
.cit-lang-dd>summary{list-style:none;display:flex;align-items:center;gap:7px;padding:7px 11px;
  border-radius:999px;color:inherit;cursor:pointer;
  background:color-mix(in srgb,currentColor 14%,transparent);
  border:1px solid color-mix(in srgb,currentColor 26%,transparent)}
.cit-lang-dd>summary::-webkit-details-marker{display:none}
.cit-lang-dd>summary i{font-style:normal;opacity:.6}
.cit-lang-list{position:absolute;right:0;top:calc(100% + 6px);padding:5px;border-radius:12px;
  min-width:160px;background:var(--cit-surface);box-shadow:var(--cit-shadow);z-index:20}
.cit-lang-o{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;
  color:var(--cit-ink);text-decoration:none}
.cit-lang-o.on{background:color-mix(in srgb,var(--cit-accent) 18%,transparent)}
.cit-lang-nav{display:inline-flex;align-items:center;margin-left:10px;vertical-align:middle}
.cit-lang-bar{display:none;justify-content:center;gap:2px;padding:6px 8px;
  background:var(--cit-surface);border-bottom:1px solid var(--cit-line)}
.cit-lang-i{display:inline-flex;align-items:center;gap:6px;padding:5px 7px;border-radius:8px;
  color:var(--cit-ink);text-decoration:none;opacity:.72;font:600 11px/1 var(--cit-font-body)}
.cit-lang-i.on{opacity:1;background:color-mix(in srgb,var(--cit-accent) 18%,transparent)}
@media(max-width:640px){.cit-lang-bar{display:flex}.cit-lang-nav{display:none}}
</style>`;

  // ⛔ A sáv a FOLYAMATBAN ül (nem sticky — tulajdonosi kérés: görgetéskor menjen ki),
  // viszont a sablonok fele FIXEN rögzíti a saját fejlécét a lap tetejére, ami
  // rátakarna. Ezért a lap saját fix/sticky, fent horgonyzott elemeit lejjebb
  // toljuk a sáv magasságával. Számított, nem sablon-lista: nincs mit karbantartani.
  // (Mérve: enélkül 5 sablonon a sáv takarásba került.)
  const shiftJs =
    `<script data-cit-lang-shift>(function(){function f(){` +
    `var b=document.querySelector('.cit-lang-bar');` +
    `if(!b||getComputedStyle(b).display==='none'){` +
    `document.querySelectorAll('[data-cit-lang-shifted]').forEach(function(e){` +
    `e.style.top=e.dataset.citLangShifted;e.removeAttribute('data-cit-lang-shifted')});return;}` +
    `var h=b.getBoundingClientRect().height;if(!h)return;` +
    `Array.prototype.forEach.call(document.body.querySelectorAll('*'),function(e){` +
    `if(e===b||b.contains(e)||e.hasAttribute('data-cit-lang-shifted'))return;` +
    `var st=getComputedStyle(e);if(st.position!=='fixed'&&st.position!=='sticky')return;` +
    `var t=parseFloat(st.top);if(isNaN(t)||t>=h)return;` +
    `e.dataset.citLangShifted=st.top;e.style.top=(t+h)+'px';});}` +
    `if(document.readyState!=='loading')f();else addEventListener('DOMContentLoaded',f);` +
    `addEventListener('resize',f);})();</scr` + `ipt>`;

  let out = html;
  if (out.includes("</head>")) out = out.replace("</head>", `  ${head}\n${css}</head>`);
  else out = css + out;
  // A sáv a body ELSŐ eleme (a lap saját fejléce elé, folyamatban — nem lebegve).
  out = out.replace(/<body([^>]*)>/i, `<body$1>${bar}`);
  // A chip a fejléc UTOLSÓ linkje mellé. A masthead-kontraktus (2026-08-30) óta a lap
  // LÁTHATÓ menüsora a masthead link-sávja — az elsődleges cél tehát az; enélkül az első
  // <nav> a csak-görgetve-látszó sáv lenne, és a chip a masthead ALÁ kerülne (takarás,
  // a láthatóság-őr fogta). Fallback: első <nav>, majd <header> (card-sidebar, mérve).
  const navBlock =
    /<nav class="cit-mast-links"[\s\S]*?<\/nav>/i.exec(out) ??
    /<nav[\s\S]*?<\/nav>/i.exec(out) ??
    /<header[\s\S]*?<\/header>/i.exec(out);
  if (navBlock) {
    const block = navBlock[0];
    const lastLink = block.lastIndexOf("</a>");
    if (lastLink !== -1) {
      out = out.replace(block, block.slice(0, lastLink + 4) + chip + block.slice(lastLink + 4));
    }
  }
  if (out.includes("</body>")) out = out.replace("</body>", `${shiftJs}</body>`);
  else out += shiftJs;
  return out;
}

// First-party guest reviews: guest writes → owner decides → it goes live (ADR-0046).
//
// WHY FIRST-PARTY IS THE BACKBONE rather than imported Google text: this data is
// OURS. We may store it, moderate it, render it into the static snapshot, and keep
// it when a tenant leaves a portal — at zero marginal cost, which is what a 690
// Ft/month module can actually carry. The Google side stays a NUMBER (placeRating.ts).
//
// The moderation flow mirrors booking on purpose: the owner decides FROM THE E-MAIL
// with one tap and no login. An owner who will not sign in to approve a booking will
// not sign in to approve a review either — the module would just collect dust.
//
// HONEST LIMIT, so nobody promises it to a tenant: reviews the reviewed party
// moderates make the page ineligible for Google's star rich result either way. The
// value here is on-page trust and owned data, not a star in the search listing.

import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import { db } from "../db/client.js";
import { getEmailSender } from "../email/sender.js";
import { T, langForSite, prepareMailLang } from "../i18n/mail.js";
import { effectiveModuleConfig } from "../moduleConfig.js";
import { getPlaceRating } from "./placeRating.js";

export interface ReviewInput {
  readonly siteId: string;
  /** Null = about the place as a whole. */
  readonly unitId?: string | null;
  readonly authorName: string;
  readonly authorEmail?: string | null;
  readonly rating: number;
  readonly body: string;
  /** 'YYYY-MM' of the stay; optional and never inferred (§B.17). */
  readonly stayMonth?: string | null;
}

export interface CreateResult {
  readonly ok: boolean;
  readonly id?: string;
  /** Guest-facing messages when ok === false. */
  readonly errors: string[];
}

const STAY_MONTH = /^\d{4}-\d{2}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_BODY = 10;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** The site's review settings, with catalogue + industry defaults applied. */
export async function reviewSettings(siteId: string): Promise<Record<string, unknown>> {
  const row = await db
    .selectFrom("site_module_config")
    .select(["config"])
    .where("site_id", "=", siteId)
    .where("module", "=", "reviews")
    .executeTakeFirst();
  return effectiveModuleConfig("reviews", (row?.config ?? null) as Record<string, unknown> | null, null);
}

/**
 * Record a guest's review as PENDING and tell the owner. Nothing reaches the page
 * before a human verdict: an open form that published instantly would let one bot
 * or one competitor rewrite a tenant's front page in minutes.
 */
export async function createReview(
  input: ReviewInput,
  publicBaseUrl: string | null,
): Promise<CreateResult> {
  const errors: string[] = [];
  const name = input.authorName.trim();
  const body = input.body.trim();
  const email = input.authorEmail?.trim() ?? "";
  const rating = Math.round(Number(input.rating));
  // ADR-0067: these errors are shown to the GUEST on the tenant's own page — in
  // the page's language, never Hungarian by default.
  const lang = await prepareMailLang(await langForSite(input.siteId));

  if (!name) errors.push(T(lang, "Kérjük, adja meg a nevét."));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    errors.push(T(lang, "Kérjük, adjon értékelést egy és öt csillag között."));
  }
  if (body.length < MIN_BODY) errors.push(T(lang, "Kérjük, írjon pár szót az élményéről."));
  if (email && !EMAIL.test(email)) errors.push(T(lang, "Az e-mail cím nem érvényes."));
  if (input.stayMonth && !STAY_MONTH.test(input.stayMonth)) {
    errors.push(T(lang, "A tartózkodás hónapja hibás."));
  }

  const settings = await reviewSettings(input.siteId);
  if (settings.collectEnabled === false) {
    return { ok: false, errors: [T(lang, "Ezen az oldalon jelenleg nem lehet véleményt írni.")] };
  }
  if (errors.length) return { ok: false, errors };

  // Cheap duplicate guard: the same address may not file twice within a day. Not a
  // real anti-abuse wall (moderation is), just enough to stop a double submit and
  // the most obvious flooding.
  if (email) {
    const recent = await db
      .selectFrom("site_review")
      .select("id")
      .where("site_id", "=", input.siteId)
      .where("author_email", "=", email)
      // DB clock, not the app's — one less thing to drift.
      .where(sql<boolean>`created_at > now() - interval '1 day'`)
      .executeTakeFirst();
    if (recent) {
      return { ok: false, errors: [T(lang, "Már küldött véleményt. Köszönjük!")] };
    }
  }

  const token = randomBytes(24).toString("base64url");
  const row = await db
    .insertInto("site_review")
    .values({
      site_id: input.siteId,
      unit_id: input.unitId || null,
      author_name: name.slice(0, 160),
      author_email: email.slice(0, 200) || null,
      rating,
      body: body.slice(0, 2000),
      stay_month: input.stayMonth || null,
      action_token: token,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await notifyOwner(row.id, token, String(settings.notifyEmail ?? ""), publicBaseUrl);
  return { ok: true, id: row.id, errors: [] };
}

interface ReviewRow {
  id: string;
  site_id: string;
  unit_id: string | null;
  author_name: string;
  author_email: string | null;
  rating: number;
  body: string;
  stay_month: string | null;
  status: string;
  action_token: string;
  verified: boolean;
  created_at: Date;
  unit_name?: string | null;
  tenant_id?: string;
}

async function loadReview(where: { id?: string; token?: string }): Promise<ReviewRow | null> {
  let q = db
    .selectFrom("site_review")
    .leftJoin("site_unit", "site_unit.id", "site_review.unit_id")
    .innerJoin("site", "site.id", "site_review.site_id")
    .selectAll("site_review")
    .select(["site_unit.name as unit_name", "site.tenant_id as tenant_id"]);
  if (where.id) q = q.where("site_review.id", "=", where.id);
  if (where.token) q = q.where("site_review.action_token", "=", where.token);
  return ((await q.executeTakeFirst()) as ReviewRow | undefined) ?? null;
}

const STARS = (n: number): string => "★".repeat(n) + "☆".repeat(5 - n);

/** The owner's notification, carrying the two one-tap verdict links. */
async function notifyOwner(
  id: string,
  token: string,
  configuredEmail: string,
  publicBaseUrl: string | null,
): Promise<void> {
  const rev = await loadReview({ id });
  if (!rev) return;

  let to = configuredEmail.trim();
  if (!to) {
    const fallback = await db
      .selectFrom("site")
      .innerJoin("tenant_user", "tenant_user.tenant_id", "site.tenant_id")
      .select("tenant_user.contact_email as email")
      .where("site.id", "=", rev.site_id)
      .executeTakeFirst();
    to = fallback?.email ?? "";
  }
  if (!to) return; // nowhere to send; it still waits in the admin inbox

  const base = publicBaseUrl ?? "";
  const yes = `${base}/velemeny/${token}/kiteszem`;
  const no = `${base}/velemeny/${token}/nem-teszem-ki`;
  const unit = rev.unit_name ? ` — ${rev.unit_name}` : "";

  // ADR-0067: the owner reads it in their own site's language.
  const lang = await prepareMailLang(await langForSite(rev.site_id));

  const text =
    T(lang, "Új vendégvélemény") +
    `${unit}\n\n` +
    `${rev.author_name} · ${STARS(rev.rating)}\n\n` +
    `${rev.body}\n\n` +
    `${T(lang, "Kiteszem az oldalra:")} ${yes}\n${T(lang, "Nem teszem ki:")} ${no}\n\n` +
    T(lang, "A vélemény addig nem látszik az oldalon, amíg Ön nem dönt.");

  const html =
    `<p style="font-size:17px"><strong>${T(lang, "Új vendégvélemény")}${esc(unit)}</strong></p>` +
    `<p style="font-size:16px;line-height:1.7">` +
    `<strong>${esc(rev.author_name)}</strong><br>` +
    `<span style="font-size:19px;letter-spacing:2px">${STARS(rev.rating)}</span>` +
    (rev.stay_month ? `<br><span style="color:#666">${esc(rev.stay_month)}</span>` : "") +
    `</p>` +
    `<p style="font-size:15px;color:#444;line-height:1.7">„${esc(rev.body)}"</p>` +
    `<p style="margin:28px 0">` +
    `<a href="${esc(yes)}" style="display:inline-block;padding:16px 28px;background:#16283f;` +
    `color:#fff;text-decoration:none;border-radius:10px;font-size:17px;font-weight:600">${T(lang, "Kiteszem az oldalra")}</a>` +
    `&nbsp;&nbsp;` +
    `<a href="${esc(no)}" style="display:inline-block;padding:16px 28px;border:1px solid #ccc;` +
    `color:#16283f;text-decoration:none;border-radius:10px;font-size:17px">${T(lang, "Nem teszem ki")}</a>` +
    `</p>` +
    `<p style="font-size:14px;color:#666">${T(lang, "A vélemény addig nem látszik az oldalon, amíg Ön nem dönt.")}</p>`;

  await getEmailSender().send({
    to,
    subject: T(lang, "Vendégvélemény: {author} ({rating}/5)", {
      author: rev.author_name,
      rating: rev.rating,
    }),
    text,
    html,
  });
}

export interface DecisionResult {
  readonly ok: boolean;
  /** 'published' | 'rejected' | 'already' | 'unknown' */
  readonly outcome: string;
  readonly authorName?: string;
  /** ADR-0067: the site's language — the verdict page renders in it. */
  readonly lang?: string;
  /** Whose snapshot needs rebuilding — the page is a static file, so a verdict that
   *  does not trigger a re-render is a verdict the owner never sees take effect. */
  readonly tenantId?: string;
}

/**
 * Apply the owner's verdict. Idempotent for the same reason booking is: e-mail
 * clients prefetch links and owners double-tap, so the second visit must report
 * the decision already made rather than flipping it.
 */
export async function decideReview(
  token: string,
  verdict: "published" | "rejected",
  publicBaseUrl: string | null,
): Promise<DecisionResult> {
  const rev = await loadReview({ token });
  if (!rev) return { ok: false, outcome: "unknown" };
  const base = {
    authorName: rev.author_name,
    // ADR-0067: opened from the owner's localized e-mail — stay in that language.
    lang: await prepareMailLang(await langForSite(rev.site_id)),
    ...(rev.tenant_id ? { tenantId: rev.tenant_id } : {}),
  };
  if (rev.status !== "pending") {
    return { ok: true, outcome: rev.status === verdict ? "already" : rev.status, ...base };
  }

  await db
    .updateTable("site_review")
    .set({ status: verdict, decided_at: new Date() })
    .where("id", "=", rev.id)
    .execute();

  if (verdict === "published") await thankGuest(rev, publicBaseUrl);
  return { ok: true, outcome: verdict, ...base };
}

/**
 * Tell the guest their words are live — and, if the owner asked for it, invite
 * them to Google too.
 *
 * NOTE THE DIRECTION: this goes to someone who already stayed and already wrote,
 * not to a visitor reading the page. Sending a prospective guest to Google would
 * hand away the visit we were paid to convert; sending a departing one there
 * raises the owner's Maps visibility, which is the thing they actually buy.
 */
async function thankGuest(rev: ReviewRow, publicBaseUrl: string | null): Promise<void> {
  if (!rev.author_email) return;

  const settings = await reviewSettings(rev.site_id);
  const site = await db
    .selectFrom("site")
    .innerJoin("tenant", "tenant.id", "site.tenant_id")
    .select("tenant.display_name as name")
    .where("site.id", "=", rev.site_id)
    .executeTakeFirst();
  // ADR-0067: the GUEST is thanked in the language of the site they wrote on.
  const lang = await prepareMailLang(await langForSite(rev.site_id));
  const host = site?.name ?? T(lang, "A szállásadó");

  let invite = "";
  if (settings.inviteToGoogle !== false) {
    const place = await getPlaceRating(rev.site_id);
    if (place) {
      invite =
        `\n\n` +
        T(
          lang,
          "Ha van rá pár perce, a Google-on is megoszthatja az élményét — ezzel másoknak is sokat segít:",
        ) +
        `\n${place.writeUrl}\n`;
    }
  }

  const body =
    T(lang, "Kedves {name}!", { name: rev.author_name }) +
    `\n\n` +
    T(lang, "Köszönjük a véleményét — mostantól látható {host} oldalán.", { host }) +
    `${invite}\n\n` +
    `${host}\n`;

  await getEmailSender().send({
    to: rev.author_email,
    subject: T(lang, "Köszönjük a véleményét"),
    text: body,
    ...(publicBaseUrl
      ? { html: `<p style="font-size:16px;line-height:1.7">${esc(body).replace(/\n/g, "<br>")}</p>` }
      : {}),
  });
}

export interface ReviewItem {
  readonly id: string;
  readonly unitName: string | null;
  readonly authorName: string;
  readonly rating: number;
  readonly body: string;
  readonly stayMonth: string | null;
  readonly status: string;
  readonly verified: boolean;
  readonly token: string;
  readonly createdAt: Date;
}

/** The owner's review list for the admin (pending first, newest first). */
export async function getReviews(siteId: string, limit = 60): Promise<ReviewItem[]> {
  const rows = await db
    .selectFrom("site_review")
    .leftJoin("site_unit", "site_unit.id", "site_review.unit_id")
    .selectAll("site_review")
    .select("site_unit.name as unit_name")
    .where("site_review.site_id", "=", siteId)
    .orderBy("site_review.status")
    .orderBy("site_review.created_at", "desc")
    .limit(limit)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    unitName: (r as { unit_name: string | null }).unit_name,
    authorName: r.author_name,
    rating: r.rating,
    body: r.body,
    stayMonth: r.stay_month,
    status: r.status,
    verified: r.verified,
    token: r.action_token,
    createdAt: new Date(r.created_at as unknown as string),
  }));
}

export interface PublishedReview {
  readonly quote: string;
  readonly author: string;
  readonly meta?: string;
  readonly rating: number;
}

/**
 * What the page may show: PUBLISHED rows only, newest first, capped by the owner's
 * maxCount. The status filter is the whole point — a pending or rejected review
 * leaking onto the page would break the promise moderation makes.
 */
export async function publishedReviews(siteId: string): Promise<PublishedReview[]> {
  const settings = await reviewSettings(siteId);
  const max = Math.max(1, Math.min(20, Number(settings.maxCount ?? 6)));
  const rows = await db
    .selectFrom("site_review")
    .leftJoin("site_unit", "site_unit.id", "site_review.unit_id")
    .selectAll("site_review")
    .select("site_unit.name as unit_name")
    .where("site_review.site_id", "=", siteId)
    .where("site_review.status", "=", "published")
    .orderBy("site_review.created_at", "desc")
    .limit(max)
    .execute();

  return rows.map((r) => {
    const unit = (r as { unit_name: string | null }).unit_name;
    // meta is built only from what the guest actually supplied — never padded.
    const bits = [r.stay_month, unit].filter((b): b is string => Boolean(b));
    return {
      quote: r.body,
      author: r.author_name,
      ...(bits.length ? { meta: bits.join(" · ") } : {}),
      rating: r.rating,
    };
  });
}

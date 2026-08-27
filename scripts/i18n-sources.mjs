// ⛔ THE i18n doctrine's file list — the SINGLE source shared by both guards
// (scripts/extract-i18n.mts writes the catalog from it, scripts/i18n-lint.mts
// forbids unwrapped Hungarian in it).
//
// WHY ONE LIST: it used to be two copies. The drift between them dropped every
// ADR-0044 module-section label from the catalog — wrapped in T(), then never
// translated. ADR-0067 was the same bug one level up: the entire OUTGOING MAIL
// chain appeared in neither list, so a Polish tenant (and that tenant's German
// guest) received hardcoded Hungarian while every gate reported green.
//
// Adding a customer-facing file here is what BINDS it to the doctrine. If a new
// customer-facing surface is not on this list, it is not guarded — that is the
// failure mode this file exists to make impossible to repeat by accident.

export const I18N_SOURCES = [
  // ── The rendered page chain ──────────────────────────────────────────────
  "src/engine/templateKit.ts",
  // The shared tenant module sections (ADR-0044).
  "src/engine/moduleSections.ts",
  "src/generator/generateEngine.ts",
  // Serve-time injection onto the LIVE tenant page.
  "src/server/ownerLogin.ts",
  "assets/runtime/cit-runtime.js",
  "assets/runtime/cit-configurator.js",

  // ── The OUTGOING MAIL chain (ADR-0067) ───────────────────────────────────
  // Every letter a CUSTOMER reads: the tenant, the buyer, the lead — and the
  // tenant's own GUESTS (booking confirmations, review thank-yous), who are the
  // most visible failure of all: they see the tenant's site in one language and
  // its mail in another.
  "src/i18n/mail.ts",
  "src/email/loginEmail.ts",
  "src/email/invoiceEmail.ts",
  "src/email/mockRequestEmail.ts",
  "src/email/outreachEmail.ts",
  // ADR-0078: a saját webcím értesítői (kész / elkelt a név) — a tenant a SAJÁT
  // site-nyelvén kapja. ⚠️ Ez a lista a doktrína hatóköre: ami lemarad róla, az
  // némán magyarul megy ki (ADR-0067/0070 kétszer megégetett minket).
  "src/email/domainEmail.ts",
  // ADR-0070: the cold outreach mail's SUBJECT AND BODY live here, not in
  // email/outreachEmail.ts (which only wraps them in HTML). This file was missing
  // from the list until 2026-08-26 and was hardcoded Hungarian throughout — the
  // single most lead-critical text we send. Nothing broke only because a DIFFERENT
  // gate (the ADR-0036 country gate) blocks non-`hu` leads today; the day that
  // opens, every lead would have received Hungarian with every guard green.
  "src/outreach/draft.ts",
  "src/booking/requests.ts",
  "src/reviews/reviews.ts",
  "src/tenant/multilangCore.ts",
  // ADR-0070: the COLD OUTREACH's entire subject+body+SMS — the one letter leads
  // are born from. It sat OUTSIDE every guard list while the country gate happened
  // to mask it; that near-miss is why the scope is now DERIVED (i18n-scope.mts).
  "src/outreach/draft.ts",
  // ADR-0070 derived-scope finds: lead-visible surfaces OUTSIDE the mail body.
  "src/generator/demoFrame.ts",
  "src/outreach/heroShot.ts",
  "src/tenant/prices.ts",
  "src/auth/tenantAuth.ts",

  // ── The TENANT ADMIN (ADR-0067) ──────────────────────────────────────────
  // The owner's own workspace. A Polish tenant administering their Polish site
  // through a Hungarian control panel is the same defect as a Hungarian letter.
  // ⛔ NOT here on purpose: src/server/legalViews.ts + src/legal.ts. Legal
  // wording (ÁSZF, Impresszum, elállás, DPA) is a per-country LEGAL pack, never
  // machine translation (§B.18) — a mistranslated ÁSZF is a liability, not a UI bug.
  "src/server/adminViews.ts",
  "src/server/moduleConfigViews.ts",

  // ── The INTERNAL CONSOLE (ADR-0067 ③) ────────────────────────────────────
  // Operator-facing, and prepared for a non-Hungarian colleague: the language is
  // a per-ACCOUNT setting (migration 0037), not a market parameter. Two operators
  // with different languages share one console and one dataset.
  "src/console/views.ts",
  "src/console/partnerViews.ts",
];

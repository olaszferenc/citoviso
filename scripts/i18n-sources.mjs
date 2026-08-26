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
  "src/booking/requests.ts",
  "src/reviews/reviews.ts",
  "src/tenant/multilangCore.ts",

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

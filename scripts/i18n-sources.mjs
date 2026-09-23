// ⛔ THE i18n doctrine's file list — the LINT's scope.
//
// ⚠️⚠️ 2026-09-14 (ADR-0157 utókör): ez a lista MÁR NEM az extraktoré. A két őr
// két KÜLÖNBÖZŐ kérdést tesz fel, és egy listán osztozva a gyengébbik hatóköre
// lett mindkettőé:
//   · lint      — „van-e ebben a fájlban BURKOLATLAN vevő-szöveg?"  → ítélet-igényű,
//                 ezért marad kurált lista. A `public.ts` például a SAJÁT magyar
//                 marketing-landingünk szövegeit is tartalmazza, aminek a fordítása
//                 külön, meg nem hozott üzleti döntés — a lint ide-vétele véletlenül
//                 döntené el (feedback_widening_a_shared_list_needs_per_consumer_decision).
//   · extractor — „benne van-e MINDEN BURKOLT string a katalógusban?" → itt nincs
//                 mérlegelnivaló: aki `T()`-be tette, KIMONDTA, hogy fordítandó.
//                 Ezért az `extract-i18n.mts` a TELJES `src/`-t olvassa, lista nélkül.
// Mérve a szétválasztás előtt: 46 burkolt literál 7 fájlban SOHA nem jutott nyelvi
// csomagba, mert a FÁJLJUK nem volt ezen a listán — köztük a felfüggesztett honlap
// teljes vendég-lapja, a foglalási érdeklődés hibaüzenetei és egy vevőnek szóló
// forgalmi levél. A katalógus `--check` frissesség-kapuja mostantól szerkezetileg
// zárja az osztályt (piros próbával igazolva: sosem listázott fájlba tett burkolt
// string → exit 1).
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
  // Elek FK-001 E1: a SZÁMLA-TÉTEL neve. EGY regiszter szolgálja ki a tenant-admin
  // Dokumentumok sorát ÉS a számla-levél tárgyát — a címke ezért ITT él, nem
  // duplikálva a nézetben és a levélben (ami garantáltan elcsúszna). A fájl
  // felvétele a listára az, ami a doktrína alá KÖTI (feedback_guard_scope_is_the_doctrine).
  "src/billing/invoiceItem.ts",
  "src/email/mockRequestEmail.ts",
  "src/email/outreachEmail.ts",
  // ADR-0078: a saját webcím értesítői (kész / elkelt a név) — a tenant a SAJÁT
  // site-nyelvén kapja. ⚠️ Ez a lista a doktrína hatóköre: ami lemarad róla, az
  // némán magyarul megy ki (ADR-0067/0070 kétszer megégetett minket).
  "src/email/domainEmail.ts",
  // ADR-0080: a megújulás/dunning levelek + a T+7 SMS szövege — a tenant a SAJÁT
  // site-nyelvén kapja a fizetési felszólítást is (a freeze-értesítő pláne nem
  // mehet ki rossz nyelven: jogi vitában az a kérdés, értesítettük-e ÉRTHETŐEN).
  "src/email/billingEmail.ts",
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
  // ADR-0101: the ESCALATION FOLLOW-UP writes its own subject + every paragraph of a
  // second lead-facing letter, and it was never on this list — the derived scope
  // surfaced it only when the follow-up stopped borrowing the cold letter's text.
  // Same failure shape as draft.ts above: the file that WRITES the copy must be here,
  // not just the one that wraps it in HTML.
  "src/outreach/escalationFollowup.ts",
  // ADR-0070 derived-scope finds: lead-visible surfaces OUTSIDE the mail body.
  "src/generator/demoFrame.ts",
  "src/outreach/heroShot.ts",
  // ADR-0134/0140 kép-kapu: a megtagadás INDOKA (miért nem érhető el a kép; illetve hogy
  // a renderelt lapot egy újabb generálás felülírta) az operátor képernyőjén ÉS a
  // küldő-út `flagged` okai közt is megjelenik — a levél-adapterig elérő lánc tagja.
  "src/outreach/mockPhotoHealth.ts",
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
  // ADR-0157 — a FELFÜGGESZTETT honlap VENDÉG-lapja. Mérve 2026-09-14: a szövegei
  // rendesen `T(lang, …)`-gal születtek, de a fájljuk (`public.ts`) SOHA nem volt
  // ezen a listán, tehát egyetlen string sem került a katalógusba — egy német
  // tenant vendége magyarul kapta a lapot, MINDEN kapu zöldje mellett. A katalógus
  // oldalát a fenti extractor-szétválasztás zárta le; ez a sor a LINT hatóköre.
  "src/server/suspendedPage.ts",
  // Ugyanabból a mérésből: burkolt szövegük volt, listájuk nem. Mind a öt TISZTÁN
  // átment a linten (mérve 2026-09-14) — valódi vevő- és operátor-felületek, csak
  // sosem került rájuk sor. A foglalási ÉRDEKLŐDÉS hibaüzenetei a VENDÉGNEK szólnak,
  // a forgalmi levél a TULAJNAK megy, a modul-előnézet feliratait a vendég olvassa.
  "src/booking/enquiry.ts",
  "src/email/trafficEmail.ts",
  "src/email/programsEmail.ts",
  "src/server/modulePreview.ts",
  "src/console/testLogViews.ts",
  "src/console/photoProxy.ts",
  // Elek FK-001 E2: the Üzenetek tab's TOPIC chip labels („Foglalások", „Számlázás",
  // „A honlapom", „Fiók") live here, NEXT TO the predicate they describe. A label
  // copied into the view and a mapping kept in the data layer are two copies that
  // drift, and the drift is invisible: the filter keeps working, only the sentence
  // turns false. Listing the file is what BINDS it to the doctrine
  // (feedback_guard_scope_is_the_doctrine).
  "src/tenant/messageTopics.ts",
  // FK-006b HIBA-1: the THREAD's name („előfizetés", „foglalási kérés", „többnyelvű
  // modul") that the „Ez a legfrissebb" badge carries lives here for the same reason
  // — next to the registry that keys the thread. Same file, same binding.
  "src/tenant/messageThreads.ts",
  // ⛔ The Foglalások tab was MISSING from this list until 2026-09-12 — the third
  // time the scope, not the wrapping, was the defect (ADR-0067, then ADR-0070).
  // Every label on it already went through T(lang, …) and every gate was green,
  // yet none of those strings ever reached the catalog: a non-Hungarian tenant
  // administered their bookings in Hungarian, and nothing could report it.
  "src/server/bookingViews.ts",

  // ── The INTERNAL CONSOLE (ADR-0067 ③) ────────────────────────────────────
  // Operator-facing, and prepared for a non-Hungarian colleague: the language is
  // a per-ACCOUNT setting (migration 0037), not a market parameter. Two operators
  // with different languages share one console and one dataset.
  "src/console/views.ts",
  // Lead-list column labels + column meanings moved OUT of views.ts into the shared
  // registry — a copy-bearing file that must be listed here, or every header and
  // legend line would silently fall back to Hungarian for a foreign operator
  // (feedback_guard_scope_is_the_doctrine).
  "src/console/leadFilters.ts",
  "src/console/partnerViews.ts",
];

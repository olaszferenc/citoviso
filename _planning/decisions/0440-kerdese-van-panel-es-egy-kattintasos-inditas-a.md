## ADR-0440 — „Kérdése van?” panel és egy kattintásos indítás a lead-lapon (T2)

**Dátum:** 2026-11-12 · **Döntött:** tulaj (a §2b terv-körben, a koordinátoron át: T2; a 8 pont alább) ·
**Terv:** `assets/design-refs/prospect-page/kerdes-inditas/` · **Kapcsolódik:** ADR-0342 (kártya nélküli próba),
ADR-0364 (a próba azt ígéri, amit ad), ADR-0417 (belépés-emlékeztető), ADR-0192 (modul-függőség),
ADR-0242/0396 (pirula-pár), ADR-0408 („Árak és rendelés”), 2026-10-27 (válasz-szöveget a tulaj hagy jóvá)

**Kontextus.** A kiküldött lapon a vevő a fizetős kapuig nem jutott el: a próba egy hosszú űrlap volt két
pipával, az árat a rendelő-panel mondta meg, a kérdéseit (ár, további költség, mi van benne, mi lesz a próba
után) SMS-ben/e-mailben tette fel, és órákig várt kézi válaszra. A 38 valós beérkező válaszból a kérdések
mind ugyanabba a 8 kategóriába estek.

**Döntés.**
1. **Testreszabás = T2:** „Csomagok és modulok” külön lapon (csomag-kártyák + „Testre szabom modulonként”).
   A fő út EGY gomb („Indítsa el”); aki nem választ, annak nincs plusz döntés („Csomag: ráér”).
2. **„Megrendelem most, próba nélkül” másodlagos link marad** — a meglévő rendelő-panelt nyitja a választással.
3. **A próba előtt választott csomaggal fut a próba** (`startTrial` `modules` → `trialModulesFromSelection`:
   eladható kapcsolós modulok + gerinc + kötelező párok, ezek kapnak `trial_grant`-ot; a folytatás ezt jelöli elő).
4. **Éves fizetésnél a −25% az egész első éves díjra jár** (a meglévő `applyOffer` az éves listaáron így számol).
5. **Spam-korlát a szabad kérdés mezőn:** 300 karakter, 4 mp, **100 kérdés / lead / nap**, 5 rögzítés / lead / nap,
   **300 / IP / óra**, link/e-mail/telefonszám nem tárolódik. `POST /p/<token>/ask`, napló `prospect_question` (0134).
6. **Automatikus válasz kifelé MÉG NEM:** a kész válaszok a LAPON jelennek meg (determinisztikus, nincs LLM-
   és API-hívás); az illeszthetetlen kérdés a tulaj jóváhagyó sorába megy (`outreach_reply`, `page:<id>`), a
   választ a tulaj hagyja jóvá. Leiratkozott lead kérdése nem kerül a sorba. A `?k=<kategória>` mélylink a
   jóváhagyott válaszból a kész válaszra visz.
7. **Click-wrap: egy mondat a gomb alatt** (`TRIAL_CLICKWRAP_V1`) áll az ÁSZF- és a fotó-nyilatkozat pipája
   helyett; szó szerint ez kerül a `free_trial.terms_text` / `photo_rights_text` oszlopba.
8. **A cég telefonszáma mindenhonnan kimarad:** a válaszokból, a platform-levelek láblécéből, a rendelési
   levelek kapcsolat-sorából és az ADR-0417 emlékeztető-levélből („Ha elakadt, hívjon minket” törölve).
   **SMS ékezet nélkül (GSM-7)** — új SMS-szöveg ebben a körben nem született.

**Megvalósítás.** `assets/runtime/cit-configurator.{js,css}` (a `#ar` blokk, a válaszkészlet, a szabad mező,
a csomag-lap, az indító lap a régi próba-űrlap helyén, a pirula-pár új szerepe a kérdés-oldalon) ·
`src/generator/configurator.ts` (`AskEntry`, `trial.clickwrap`) · `src/console/server.ts` (`/p/:token/ask`,
`ask` manifest, a próba `modules` + `clickwrap`) · `src/replies/pageQuestion.ts` · `src/trial/package.ts` ·
`src/trial/start.ts` · `src/legal.ts` · `migrations/0134_prospect_question.sql` · telefon: `src/email/platformLayout.ts`,
`src/email/orderEmail.ts`, `src/email/loginEmail.ts`, `src/trial/loginReminders.ts`.
Őrök: `scripts/page-question-check.mts` (+ `--selftest`), `scripts/free-trial-check.mts` ⑮,
`scripts/trial-login-reminder-check.mts` (nincs telefonszám), `scripts/mock-trial-overlay-check.mts` (az egy kattintásos lap).

**Mellékjavítás (a main-en is piros volt, a land kapuja).** `mock-trial-overlay-check` ⑪: card-sidebar
1536×864-en, süti-sávval a pirula-pár a hős cím-sorára ült (a `meta-row` DIV, nem P). A `heroTitleRects`
a cím alatti rövid, vezérlő nélküli szöveges testvért is akadálynak veszi (≤ 160 karakter, nincs benne
link/gomb/kép) — az ADR-0382 „a hős-cím melletti szavakra nem ül” elve.

**Mérnöki eltérés a mocktól (a koordinátornak jelentve).** A közvetlen rendelés a meglévő rendelő-panelt
nyitja (a fizetés jogi kellékei ott élnek; két checkout két igazság volna); az e-mail kötelező maradt
(belépés, számla, értesítők); a hős-gomb helyett a pirula-pár bal tagja viszi az árat (21 sablon hőse érintetlen);
SMS-es érdeklődés-továbbítás nem épült (a viselkedés-üzenetes szállal egyeztetve), a lap nem ígéri.

**Nyitott (pénz/jog → tulaj).** A jogi oldalakon (Impresszum, ÁSZF) a telefonszám MARADT: a 45/2014. (II. 26.)
Korm. rendelet 11. § fogyasztói szerződésnél a vállalkozás telefonszámát is kéri, ha van ilyen. Kivegyük-e onnan is?

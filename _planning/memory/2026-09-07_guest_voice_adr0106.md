# 2026-09-07 — ADR-0106: vendég-hang korpusz + multi-portál cap fel + „Honnan tudjuk?" forrás-panel

## Kiindulás (tulaj-panasz)

A mock-szöveg műszaki-leíró és taszító („nyugodt kemping központi fürdőszobával, fehér
csempével"); az ownerIntro kézi FB-beillesztés ellentmond az ember-mentes jövőképnek; a
kurátor nem látja, mi honnan folyik be; több portálon megtalált szállásból csak keveset
olvasunk; a Google-vélemények szövegét nem hasznosítjuk.

## Diagnózis (mérve)

- A hangnem-prompt már jó (ADR-0097) — a plafon az ADAT.
- Google-véleményből CSAK szám jött; a régi elutasítás oka a NÉZETENKÉNTI díj volt, ami a
  generálás EGYSZERI hívására nem áll (5 vélemény ≈ 0,025 USD/lead).
- `enrichPortal` leadenként 2 profilnál megállt, pedig a jelölt-lista 6 hostos.
- Lead-mező- és fotó-provenance létezett, SZÖVEG-provenance nem.

## Elvégezve (mind landolt ebben a körben)

1. **ADR-0106** a `_planning/DECISIONS.md`-ben.
2. **① Vendég-hang**: `enrichGuestReviews` pass (Places Details `reviews`, A4-kapuzott
   place-id, 30 napos frissesség `guestReviewsFetchedAt`-tal — az üres válasz is friss
   válasz) + portál schema.org `review` node-ok (CSAK high-band, a fotókkal azonos kapu;
   `PortalReview` a profilon). Generátorban: `guestVoice` blokk a promptban (hangnem+tény,
   szó szerinti átvétel tilos, negatívum tilos), az idézet-verifikáció ÉS a tényhűség-őr
   korpusza kiterjesztve. Generálás-úton stale-nél inline refetch; bukásnál a stale Google-
   tartalom DROP (policy), sosem használjuk elavultan.
3. **② Cap fel**: `portalLookup` default 2→6 (= a host-dedupolt jelölt-lista szélessége);
   politeness változatlan.
4. **④ Forrás-panel** (§2b kapu VÉGIG: 2 mock → tulaj „legyen az A" → kontraktus
   `assets/design-refs/console/source-panel/` → surface-gate approve → kód):
   `inputs.sourcePanel` pillanatkép a generálásból (portálok, vélemény-számok, ownerIntro,
   kép-jogállások, `facts[{label,source,quote?}]` — az idézet-attribúció ugyanazzal a
   squeeze-szabállyal, amivel a verifikáció futott); konzolban `mockSourcePanel` a Mock-fülön
   (4 kártya + elem→chip→idézet lánc a marketing-őr `copyNames` egyeztetőjével + forrástalan-
   sáv + „csak a problémák" szűrő). Régi artifactnál a panel nem jelenik meg.
5. **KB**: `console-lead` entry új szekció + dedikált, scriptből lőtt `source-panel.png`
   (kb-shot: `#ls-mocks` horgony + elem-lövés, sticky-sávok rejtve). Tudásbázis-őr első körben
   FLAG (idézet-nélküli ág elhallgatva; régi-mock eset; kép-elavulás) → javítva → PASS.

## Mérések (Pitypang Vendégház, élő)

- 5 Google-vélemény befolyt; sellingPoints 9 tény, köztük vendég-hang eredetűek
  („borkóstoló présházban", „csillagos ég alatti dézsázás"); az intro már vendég-hanggal zár
  („A vendégek visszatérően dicsérik a házigazdák kedvességét…"). Mindhárom őr PASS.
- Panel-viselkedés Playwrighttal: idézet nyit/csuk, 3 guest-chip, szűrő, JS-hiba 0.
- Mock-viselkedés tanulság (megint): a width-transition MIATT a kattintás utáni azonnali
  mérés hamis ❌-et adott — animációnál `waitForTimeout` a mérés előtt.

## Tanulságok

- **A kb-shot minden képet újralő és zaj-diffet termel** (apró byte-eltérések az érintetlen
  entry-ken is) — csak az érintett entry képeit tartsd meg, a többit `git checkout`-old,
  különben a commit „mindent frissítettem"-nek hazudja magát.
- A no-quote forrás-doboz szövege forrás-függő legyen (leírás vs. szolgáltatás-lista) —
  §B.17 a saját felületünkre is áll.
- Places-díj érv mindig ÚTVONAL-függő: per-view és per-lead-egyszeri költség két külön világ.

## Nyitva

- Vendég-hang tömeges bemérése a teljes lead-parkon (60-as budget/futás) — hatás a
  marketing-őr PASS-arányra.
- Kimaradt-tények egykattintásos visszaadása a forrás-panel chipjeiről (ma a szöveg-panel
  chipjei tudják).
- ADR-0101 outreach-levél implementáció (előző szálról továbbra is nyitva).

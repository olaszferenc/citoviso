## ADR-0453 — A /p lap végleges elrendezése: kérdésblokk a teljes terv után, lebegő sáv, előnézeti terv-kártyák, a kijelölt terv a kérésben

**Dátum:** 2026-11-16 · **Döntött:** tulaj („1)B 2B) kell, az előnézeti kártyák. 3.A De le ne vedd a rendlési
lehetőséget”; az egyesített mockra: „annyi, ha a lap alján a másik tervre kattint, akkor ugorjon a lap tetejére
az új designnal”) · **Kapcsolódik:** ADR-0440 (kérdés-indítás — felülírja az ①-et), ADR-0449 (próba és rendelés a
nézett/futó tervből — kiterjeszti), ADR-0451 (Kinézet lap — erre épül a „később is cserélheti”), plan-tabs
(§E „Tetszett?” blokk, §F 19), §B.17, §2b

**Kontextus.** A tulaj kérdése: „tuti jó, hogy a kérdésekkel kezdünk ilyen kinézettel? nem kavar be a WOW
hatásba, meg hogy akkor mi is az oldal része és mi nem?” — az ADR-0440 blokkja a hős UTÁN, a terv közepén állt;
a pirula-pár a betöltéstől kint volt. A második kérdés: hol választja ki a lead, melyik tervet indítja vagy
rendeli. A rendelés a nézett tervhez kötődött, ez a felületen nem látszott. Három mock-kör (C1 elrendezés,
C2 tervválasztó, D egyesített) után jóváhagyva.

**Döntés.** (Kontraktus: `assets/design-refs/prospect-page/p-lap-vegleges/README.md`.)
1. **A terv zavartalanul fut le.** Az ár-kártya + „Kérdése van?” (`#ar`, `#kerdes`) a TELJES terv után, „A honlap-terv
   vége” vonal mögött, világos Citoviso-blokkban (a manifest elé, a keretező lábléc marad az utolsó szó).
   A horgonyok (`#ar`/`#kerdes`/`#inditas`/`?k=`) változatlanok.
2. **Lebegő sáv a pirula-pár helyett** a hideg lead lapon: a nyitókép után jön, „Kérdése van?” · „Megrendelem /
   havi X Ft-tól” · „Indítsa el · N. terv / {n} nap ingyen”; a Citoviso-blokknál és nyitott lap/panel alatt
   félreáll; a Foglalás-sáv és a süti-sáv fölött ül (`fixedBottomTop`, `--citui-consent-h`).
3. **A terv saját rögzített/tapadó sávjai** a Citoviso-blokkban félreállnak — MÉRVE (`position: fixed|sticky`),
   nem sablon-osztálylistából (a D mock osztálylistája nem általánosít).
4. **Rendelés nem tűnik el:** az ár-kártyán „Az Ön választása · N. terv · Csere”, „Indítsa el”, alatta egyenrangú
   keretes „Megrendelem most / N. terv · próba nélkül”; a sávban is.
5. **Terv-kártyák** (csak ≥ 2 terv): a lezáró blokkban a MÁSIK terv kártyája azt a tervet tölti be, a lap
   TETEJÉTŐL (ott kijelölt = nézett, eltérés-sor nincs); az indító lapon és a rendelő panelen helyben jelöl,
   eltérés esetén „A lapon most az 1. tervet látja, de a 2. terv van kiválasztva · Megnézem”. A kijelölés
   linkenként a munkamenetben él (`sessionStorage`); a felső sáv a nézett tervet váltja, a kijelölést nem.
   A rendelő panel fejléce „1. / 3 — Terv és csomag”. A „Tetszett?” blokk (`#cit-plans-end`) a konfigurátoros
   lapon beleolvad a kártyákba.
6. **Szerver-szerződés:** a próba és a rendelés a kérés `plan` mezőjét veszi, a link SAJÁT tervkészletéhez mérve
   (`listProspectPlans`, ugyanaz, mint ADR-0449 `/v/<n>/` útvonalaié; ott az approved-kapu és az elutasított terv
   `not_available`-je változatlan). Nem létező tervszám vagy nem szám → 404, semmi nem íródik; `plan` nélkül a
   cím terve. A `/folytatas` a futó tervet viszi (változatlan).
7. **„Az ár ugyanaz”** csak ha minden terv ugyanabban az árazási régióban áraz (`PlansEntry.samePrice`): az ár
   modul-alapú (`buildManifest`: régió + polc, a sablon csak a minta-állapotot dönti el), tehát egy régión belül
   igaz. „Később is cserélheti” mindig (ADR-0451 megépült).

**Mért.** `scripts/p-lap-check.mts` (valódi konzol-lánc, két valódi sablon: parallax + wordmark-grow, 390/1280):
első képernyőn nincs sáv; a lezáró blokk kártyája a 2. tervet a lap tetején tölti be; az indító lapon kijelölt
2. tervvel a próba-site a 2. terv artifactjából épül; a rendelő panelen kijelölt terv kerül az
`order_intent.plan_artifact_id`-be; idegen tervszám elutasítva; JS-hiba 0. Önteszt: a böngésző kiveszi a `plan`
mezőt → ④/⑤ piros.

**Következmény.**
- Felülírt pontok jelölve: `kerdes-inditas` 1., 2., 10., 11.; `plan-tabs` §E, §F; `proba-gomb` 1.; `order-pill` 2.;
  `survey-bar` 2. A pirula-pár más lapokon (konfigurátor, `/folytatas`) változatlan.
- Új vevő-oldali feliratok magyar fallbackkel; a fordítást Bábel végzi.
- Nyitott: a felmérő sáv (survey) a lebegő sáv gombjait a `blockingRects`-en át kerüli — külön kapu nem méri
  (a `mock-trial-overlay-check` kérdés-blokk nélküli lapon mér).

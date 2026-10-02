## ADR-0302 — A sablon szövege egy valódi szállás honlapjáé: nincs „játék-szöveg”, ál-jelölés és kártyánkénti átlag-csillag (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva — a tulaj (a koordinátoron át, szó szerint: „mind igen”) · M4 SUB
(koordinátor: CIT „élesi teszt” fő session; brief: `~/rc-briefs/javitas-elek-0930/m4-sablon-szovegek.md`) ·
**Kapcsolódó:** ADR-0292 (vendég-oldal magáz, vendég-kritikus), a csillagszám egy szabálya (2026-09-29), ADR-0300 (az M3 editorial-párja, ugyanaz az őr: `scripts/template-copy-check.mts`), az M3 szál
(editorial) · **Kontraktus:** `assets/design-refs/tenant-site/sablon-szovegek/`

**A lelet.** Elek élesi jelentése → az M3 átnézte a 19 sablont: a referencia-tervek „játéka” a valódi lead lapján
idegen („A kamra”, „Vendégkönyv” Google-véleményekre, „Egy nap nálunk” + 01–04 egy szolgáltatás-listára,
„1. fejezet” a szobákon, „Wellness” bármire, „>> Foglalási konzol //”, „A porta”, mindig teli mérő-sáv, római
számok). Öt sablon az ÁTLAG csillagsorát minden vélemény-kártyára kirajzolta (minden vendég „az átlagot adta”);
az arch-frames vélemény-szakasza a galéria címét viselte. A tulaj mércéje: „Hol írnám ki ilyet egy honlapra?”

**Döntés.**
1. A sablonok menü- és szakasz-szövege az, amit egy magyar szállás a saját honlapjára kiírna (Szolgáltatások,
   Vélemények, Képek, Gyakori kérdések, Írjon nekünk, Amit nálunk talál …); a kinézet nem változik.
2. Nincs ál-jelölés: sorszám, római szám, „fejezet”, mindig teli sáv, pont a név/főcím végén, helyszín-ikon egy
   szolgáltatáson.
3. Vélemény-kártyán nincs csillagsor (a `Review` nem hordoz saját csillagot); az átlag sora egyszer, a fejlécben.
4. Egy szakasz-cím egyszer látszik egy lapon; a vélemény-szakasz a saját címét viseli.
5. A minta-szöveg is magáz (ADR-0292).
6. A vendég-kritikus kódalapú tegező-felismerése alak-szabály (`src/generator/addressRegister.ts`), nem szólista.

**Őrök.** `scripts/template-copy-check.mts` (csillagsor · vélemény-cím · tiltólista renderelve és forrásban · galéria-cím
egyszer · ál-jelölések; az editorial az M3 szál tételeivel ugyanide kerül) · `scripts/address-register-check.mts` ·
`scripts/shot-user-agent-check.mts` (mellékmérés: a lake-balaton a HeadlessChrome UA-t 429-cel tiltja).

**Nyitva.** A kompozíciós (nem sablonos) ágban (`primitives.ts`) ma is „Vendégkönyv / Levelek a vendégkönyvből” és
római számozás (`cit-rit-no`) él — nem volt a jóváhagyott listán.

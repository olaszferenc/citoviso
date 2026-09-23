## ADR-XXXX — Automata heti programajánló: település-kulcsos gyűjtés, automatikus kitöltés, csak-tulaj levél (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, őrökkel) · **Kapcsolódó:**
ADR-0207 (átnevezés + fordítás-kapu), ADR-0026 (Brave), ADR-0084 (tenant-postafiók), ADR-0108 (havi levél mintája).

**Kontextus.** A `poi` modul (publikus: „Heti programajánló", ADR-0207 körében átnevezve)
eddig egy kézzel gépelt „Mi van a közelben?" lista volt. A mért gyűjtő-lánc (2026-09-22,
`_planning/memory/2026-09-22_programajanlo_modul.md`) és a jóváhagyott választó-terv (B,
`assets/design-refs/console/programajanlo/`) megvolt, kód nem.

**Döntések (tulajdonosi, 2026-09-23).**
1. **Település-kulcsos gyűjtés, NEM tenantonkénti.** Egy település hetente egyszer
   gyűlik, akárhány tenant körébe esik; a tenant jelöltjei a 30 km-es körébe eső
   települések programjai. Mérve: három tenant körét 96 helyett **42** település fedi le.
   Táblák: `settlement` (OSM-cache + lakosság), `event_gather_run` (futásonkénti költség
   és hozam, USD-ben), `local_event` (az esemény HELYE szerinti település).
2. **Lekérdezés: ≥1000 fő + a saját település mindig** (a 2026-09-22-i mérés szerint).
   ⚠️ NEM mért feltevés, hogy a lakosság-lefedettség előrejelzi az esemény-lefedettséget —
   az `event_gather_run` hozamából kell korrigálni.
3. **A távolság „N km", felirat-kiegészítés nélkül** („marad a cca 11 km"). A számítás
   légvonalas (haversine); a saját település „Helyben". Tudott korlát: a Balaton két partja
   között a légvonal jóval rövidebb az útnál — a tulaj ezt elfogadta.
4. **Ha a tulaj nem választ, az automatika tölt ki** a legközelebbi közelgő programokkal,
   a választottak UTÁN. Egy „Automata" modul nem állhat üresen azért, mert senki nem kattintott.
   A választó ki is mondja („A szabad N helyre automatikusan…"), a levél is.
5. **Heti levél CSAK a tulajnak** (B változat + figyelmeztetés: „Önnek kell kiválasztania…").
   ⛔ Vendég-levél nincs (2026-09-22-i döntés); a vendég-értesítés külön, fizetős modulként
   a BACKLOG-ban parkol.
6. **Honlap-blokk: A (napirend-lista)** — `assets/design-refs/public-site/programajanlo/`
   (kontraktus): mobilon 5 + „Még N program" (JS nélkül is nyílik), asztalon két hasáb;
   a „Nyilvános forrásokból gyűjtjük…" lábszöveg a tulaj kérésére KIKERÜLT — a forrás-link
   minden sorban az utóda.
7. **A programcímek nem fordítódnak** (tény a forrásból) — ezért a heti csere nem teszi
   „elavulttá" a fizetett fordítást (a multilang-hash nem látja őket).

**Kapuk a láncban (kódban, nem a promptban):** dátum-ablak (14 nap, max. 31 napos esemény),
**dátum-a-szövegben** (a modell dátumának szerepelnie kell a lap szövegében), a forrás a lap
SORSZÁMÁBÓL képződik (a modell nem tud URL-t kitalálni), ismeretlen hely = nincs sor,
token-halmazos dedup (összetett szavakkal: „Gasztrofesztivál" ⊃ „fesztivál"). Max. 3 lap/host
hetente (mennyiség, nem whitelist).

**Mért költség (2026-09-23, Rozé Fogadó köre, 41 település):** $0,43/hét, 40 egyedi
program → egy MAGÁNYOS tenantnál ~650 Ft/hó a 490 Ft/hó árral szemben (fele Brave, fele
Haiku); közös régióban arányosan kevesebb. Az ár a tulaj döntése (Árazás lap).

**Ütemezés:** `citoviso-events.timer`, naponta 05:30 — gyűjtés hétfőn (vagy ha még sosem),
napi újrarenderelés (a lejártak lekerülnek), heti tulaj-levél (idempotencia: `tenant_message`
`programs`).

**Vásárláskor azonnal (tulajdonosi döntés, 2026-09-23: „különben dühös lesz a tenant"):**
`citoviso-events-pending.timer` ötpercenként `--pending` módban: a poi-s tenant, akinek a
saját települése még SOSEM volt begyűjtve, azonnal megkapja a körét (kb. egy óra), az oldala
újrarenderelődik. Szándékosan NEM az aktiválási utakba kötve (provisioning, modul-vásárlás,
upsell, modulváltás…): egy kihagyott út ugyanazt a dühös tenantot adná, a gyakori futás
viszont minden utat lefed. Postgres advisory lock: a napi és az ötperces futás sosem gyűjti
(és fizeti) kétszer ugyanazt.

**Őrök:** `scripts/events-gates-check.mts` (kapuk mindkét irányban, a mért duplapárokkal),
`scripts/programs-editor-check.mts` (a B kontraktus mért listája a valódi képernyőn + mentés-
visszaolvasás + hamisított id elutasítása).

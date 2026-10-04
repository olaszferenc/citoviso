## ADR-0318 — A generált mock egyelőre nem visz Citoviso-reklámot: a kredit-sáv kapcsolható, alapból KI (2026-10-04)

**Dátum:** 2026-10-04 · **Státusz:** elfogadva (tulajdonosi kérés; SUB, brief `~/rc-briefs/mock-citoviso-reklam-ki.md`) ·
**Kapcsolódó:** ADR-0032 ④ (a Citoviso-kredit bevezetése — ezt szűkíti a mockra), §A demó-jelölés (`demoFrame.ts`,
`prospectNotice.ts` — NEM érinti), §B.17.

### Kérés
Tulaj, 2026-10-04, szó szerint: „a mockok ne generáljanak egyenlőre citoviso-s reklámot”.

### Lelet — mi számít reklámnak a mockon
Az EGYETLEN tisztán promóciós elem a `src/generator/runtime.ts` `CIT_CREDIT` sávja: „Ezt az oldalt a Citoviso
készítette — modern honlap percek alatt.” link a citoviso.com-ra, a lábléc alatt. Az `injectRuntime` fűzi MINDEN
oldalra, egy kódból: a mockra (generateEngine, recopy, heroOverride, konzol sablon-előnézet, régi generate-út) ÉS
az élő tenant-oldalra (conversion/provision, tenant/editor, tenant/multilangGenerate). A sáv a mentett mock-HTML-be
sül bele (generáláskor), tehát a már legenerált mockokon újragenerálásig megmarad.

NEM reklám, nem nyúltunk hozzá (a termék működése vagy jogi kötelezettség):
- `demoFrame.ts` „…nyilvános adatok alapján készült a Citoviso rendszerével” — §A demó-jelölés (az intake-kapu és a
  `/m/:token` követeli, `provenanceCheck` FRAMING_MARKERS).
- `prospectNotice.ts` „Készítette: <hirdető>” felső sáv és az „Ön a Citoviso ügyfele” lábléc — a megkereső
  azonosítása (Grt./GDPR), leiratkozás, adatkezelési link.
- `render.ts` / `renderVaried.ts` „Előzetes terv — … készült a Citoviso motorral” demo-badge és az AI-promptok
  (`aiMock.ts`, `mockFromCorpus.ts`, `corpus.ts`) ugyanilyen lábléc-kérése — a régi (nem motoros) generátor-utak
  demó-jelölése. → a tulaj döntése lent, a Kiegészítésben (5. pont).

### Döntés
1. `config.mockCitovisoCredit` (`MOCK_CITOVISO_CREDIT=1` env) — alapból KI. Bekapcsolva a mock újra kapja a sávot.
2. `injectRuntime(html, lang, phase = "mock")`: a sáv `phase === "live"` esetén MINDIG, mockon csak a kapcsolóval.
   A jelöletlen hívó MOCKNAK számít, így egy elfelejtett fázis sosem teszi vissza a reklámot egy lead előnézetére.
   A hat élő hívó (provision, tenant editor ×3, multilang ×2) kifejezetten `"live"`-ot ad — az élő tenant-oldal
   viselkedése VÁLTOZATLAN (ADR-0032 ④ ott él tovább).
3. Visszafordíthatóság: 🔄 triviális — egy env-sor.


### Kiegészítés (2026-10-04, tulaj-döntés a két KÉRDÉSRE)
Tulaj, szó szerint: „reklám: csak a készült a citoviso motorral a reklám és a régiekről nem kell levenni”.
4. **A már legenerált / kiküldött mockokról NEM vesszük le** a beégett sávot — kiszolgáláskori szűrés nincs.
5. **A „készült a Citoviso motorral” szövegrész REKLÁM** → ugyanaz a kapcsoló (`MOCK_CITOVISO_CREDIT`) vezérli, alapból KI:
   `render.ts` és `renderVaried.ts` demo-badge-e (az „Előzetes terv — paletta · hangulat” rész marad), valamint az
   `aiMock.ts` és `mockFromCorpus.ts` prompt lábléc-kérése (KI állásban: „Előzetes terv”, és a corpus-adaptáló prompt
   kifejezetten tiltja a blueprint „Referencia-dizájn — Citoviso korpusz” láblécének átvételét).
   **Az „Előzetes terv” demó-jelölés MARAD** (§A; a `provenanceCheck` FRAMING_MARKERS bármelyik jelölőt elfogadja —
   mérve: a kapcsoló nélküli render és renderVaried kimenete `checkDemoFraming` → pass).
   A `corpus.ts` saját prompt-sora („Referencia-dizájn — Citoviso korpusz”) a belső korpusz-referencia jelölése, nem
   a mocké; a tulaj szava szerint csak a „motorral” szöveg reklám, ezért érintetlen.

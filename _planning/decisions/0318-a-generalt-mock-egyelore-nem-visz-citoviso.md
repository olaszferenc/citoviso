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
  demó-jelölése. KÉRDÉS a tulajnak, ha ezeket is reklámnak tekinti; most érintetlen.

### Döntés
1. `config.mockCitovisoCredit` (`MOCK_CITOVISO_CREDIT=1` env) — alapból KI. Bekapcsolva a mock újra kapja a sávot.
2. `injectRuntime(html, lang, phase = "mock")`: a sáv `phase === "live"` esetén MINDIG, mockon csak a kapcsolóval.
   A jelöletlen hívó MOCKNAK számít, így egy elfelejtett fázis sosem teszi vissza a reklámot egy lead előnézetére.
   A hat élő hívó (provision, tenant editor ×3, multilang ×2) kifejezetten `"live"`-ot ad — az élő tenant-oldal
   viselkedése VÁLTOZATLAN (ADR-0032 ④ ott él tovább).
3. Visszafordíthatóság: 🔄 triviális — egy env-sor.

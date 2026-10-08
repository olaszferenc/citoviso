## ADR-XXXX — http-s fotó a https-es mockon: https-emelés vagy saját proxy, a kapu a kiszállított URL-t méri

**Dátum:** 2026-10-08 · **Döntött:** koordinátor-brief (mock-http-foto-20261008), megvalósítás: CIT SUB session

**Kontextus.** A $0-s saját-honlapos fotó-behúzás (ADR-0337) `http://` kép-URL-eket hoz. A mock
https-en fut; a böngésző a vegyes tartalmú képet https-re emeli, és ahol a szállás hosztjának rossz a
tanúsítványa, ott a kép NEM jelenik meg (Forrás 880497a6, Kerékhegy 0ccc74f6 — Vera sem látta). A
fotókapu „ép"-et mondott, mert a szerver http-n 200-at kapott. Mérve élesen (2026-10-08, csak
olvasás): 16 lead · 237 http-s fotó-URL · 12 hoszt; 12 mock (6 lead) már legenerálva ilyen képpel.
https-en 5 hoszt (118 URL) BÁJTRA ugyanazt adja; 6 hoszt (104 élő URL) tanúsítvány-hibás (rossz név,
lejárt, önaláírt); 1 hoszt (szallas-kereso.hu, 15 URL) http-n is 403 (bot-tiltás, külön ügy).

**Döntés.**
1. **Generáláskor dől el, http-fotónként** (`src/generator/photoTransport.ts`): ha a https-változat
   sha256-ra azonos képet ad → (a) a https URL kerül a lapra; különben → (b) a saját szerverünkön át:
   `<PUBLIC_BASE_URL>/configure/<artifactId>/photo/<hash>`. Költség: fotónként egy https-kérés a
   szállás saját hosztjára, $0; Places nincs benne.
2. **Nem nyílt proxy.** A route csak az artefaktum TÁROLT forrásaira old fel (`siteData.photos`,
   a régebbi utaknál `inputs.photoTransport`), és csak `http://` forrást szolgál ki (a Places média
   https, tehát ide nem juthat). `/configure/` előtag: élesen ez a konzol nyilvános, nginx-en
   átengedett útja (a `/mock/` operátor-only, új előtaghoz nginx-módosítás kellene).
3. **A siteData a forrás-URL-t tartja** (jogállás, hero-pontszám kulcsa, élesítés); a csere a
   RENDERELT HTML-en történik minden írásnál: generálás (motor, AI, sablon), hero-csere, újraszövegezés,
   kézi szöveg, `scripts/rerender-mock.mts`.
4. **A fotókapu a kiszállított URL-t méri** (`classifyServedRefs`): `http://` hivatkozás = `insecure`
   törött, és NEM vehető tudomásul (az újrarenderelés $0-ért megjavítja); a proxy-URL a tárolt
   forrásán mérődik; idegen/ismeretlen proxy-URL törött. Kivétel a loopback (`127.0.0.1`/`localhost`):
   a böngésző sem blokkolja, ez a helyi kapu-fixture-ök útja.
5. Őr: `scripts/mock-photo-transport-check.mts` (piros ikrekkel), pre-commitba kötve.

**Visszafordíthatóság:** 🔄 — a forrás-URL megmarad, egy újrarenderelés visszaállítja a régi lapot.

**Elvetett alternatívák.** Kiszolgáláskori átírás (a lemezen lévő fájl http-n maradna, a hero-shot és
a kapu mást látna, mint a lead); mindent proxyzni (fölösleges forgalom ott, ahol a hoszt https-e jó);
a konzol aláírt `/photo` proxyja (operátor-only, és a session-titok cseréje minden kiküldött lapot eltörne);
vak https-emelés ellenőrzés nélkül (a 6 rossz tanúsítványú hosztnál pont ez a hiba).

**Státusz:** megvalósítva, élesre a nagy deployjal. A már legenerált éles mockokhoz deploy után:
`npx tsx scripts/rerender-mock.mts <artifactId>` (AI-költség nélkül, a tárolt receptből).

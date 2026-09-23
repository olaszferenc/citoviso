## ADR-0140 — Egy artefaktum = egy fájl: az újragenerálás ne írja felül, amit már jóváhagytunk (2026-09-13)

**Kontextus.** Az ADR-0134 kép-kapu utóméréséből. A generátor a renderelt mock fájlnevét a
lead nevéből és a sablonból állította össze (`mock-<slug>-<sablon>.html`), tehát **ugyanannak
a leadnek ugyanazzal a sablonnal való újragenerálása FELÜLÍRTA a korábbi artefaktum fájlját**.
Mérve a dev-parkon (2026-09-13): **10 fájlon 29 artefaktum** osztozott; egy leaden két
`approved` mock mutatott ugyanarra a lapra.

**Miért súlyos — és miért nem „csak" rendetlenség.** A `/mock/<id>` és a `/p/<token>` a
`mock_artifact.path`-ból olvas. A régi artefaktum linkje tehát az ÚJ tartalmat szolgálja ki:
**a kurátor mást hagyott jóvá, mint ami a leadhez kimegy** — a §I (ígéret ⇔ szállítás)
közvetlen sérülése. Ugyanez tette megtéveszthetővé a saját ADR-0134 kapumat: a felülírt régi
artefaktumra az ÚJ fájl képeit mértem, így egy törött mock **zöldre válthatott** attól, hogy
mellé generáltak egy épet — pontosan ez történt a mai sweepben, ahol ugyanaz a fájl kétszer
szerepelt „6 kép / 0 törött"-tel. A `heroOverride` és a `recopy` szintén `row.path`-ba ír:
közös fájlon ezek **némán átírták egy másik artefaktum tartalmát**.
⚠️ A `generateEngine` kommentje már ki is mondta, hogy „one artifact = one file" — de a
szabály csak a SABLON-változatokat választotta szét. A komment igaz volt a szándékról és
hamis a viselkedésről.

**Döntés.**
① **A fájlnév az ARTEFAKTUM AZONOSÍTÓJÁBÓL származik**, egyetlen helyen
(`persist.mockArtifactPath`). Az azonosítót a render ELŐTT kérjük el (`newArtifactId`), és a
DB-sor is azt kapja — különben a lemez és a sor némán elválna. A három korábbi, kézzel írt
névadó-másolat egyike sem tette egyedivé.
② **A FELÜLÍRT fájl MINDIG blokkol, és tudomásul sem vehető.** A `photoGateBlocks` ezt a
`verdict === "ok"` ág ELŐTT vizsgálja: a képek ilyenkor lehetnek épek, épp ezért mondana a
kapu zöldet. A kurátor pipája arra a lapra szólt, amit LÁTOTT; egy azóta fölé írt tartalomról
nem dönthetett. A felirat sem a kép-mondatot mondja rá — más a baj, más a mondat.
③ **A meglévő sorokat nem írjuk át.** A felülírt tartalom nincs meg; visszaállítani nem lehet,
csak hazudni róla. A régi artefaktumok maradnak, és a kapu megnevezi, melyik nem a sajátját
szolgálná ki.

**Őr.** `scripts/mock-photo-gate-check.mts` bővítve: ① két azonosító két fájlt ad, ② a név az
azonosítóból származik, ③ **szerkezeti iker** — egyik generátor-ág sem épít kézzel
`mock-${…}.html` nevet, és mindkettő a közös névadót hívja, ④ a felülírt fájl ép képekkel is
blokkol, ⑤ tudomásul sem vehető. A szerkezeti állítást **visszarontva mérve pirosra megy**
(a kézi név-építés visszatétele 2 bukás).

**Visszafordíthatóság:** 🔄 kód-szintű, migráció nélkül. A régi, nem egyedi nevű fájlok
érintetlenek; az új generálások egyedi nevet kapnak.

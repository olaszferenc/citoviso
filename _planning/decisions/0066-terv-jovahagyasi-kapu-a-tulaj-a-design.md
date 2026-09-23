## ADR-0066 — Terv-jóváhagyási kapu: a tulaj a DESIGN-PROJEKTBEN lát és hagy jóvá, kód csak utána

**Dátum:** 2026-08-25 · **Státusz:** elfogadva (tulajdonosi rendelet) · **Kapcsolódó:**
ADR-0065 (mock-először — ezt PONTOSÍTJA), ADR-0062/§B.19 (látogató-szemű ítélet), ADR-0021 (dizájn-mag).

### Probléma (mérve, 2026-08-25)

Az ADR-0065 kimondta a „mock-először" sorrendet, de a végrehajtás mégis elcsúszott: a
tulaj visszajelzése után az AI legyártotta az új tervet, **megnézte magának**, majd azonnal
nekiállt a működő szűrő-logikának, interaktív tesztnek és adat-javításnak — **anélkül, hogy a
tulaj egyetlen képet is látott volna**. A tulaj szava: „TÖK FÖLÖSLEGES ÍGY A WORKFLOW."
Két külön hiba: (1) hiányzott a KIMONDOTT jóváhagyási pont, (2) amikor mégis megmutattam,
a chatbe küldtem képet, holott a tulaj a DESIGN-PROJEKTBEN akarja nézni — ott ugyanis nem
csak néz, hanem **bele is tud nyúlni**.

### Döntés

1. **A jóváhagyás KAPU, nem udvariasság.** Döntés-igényű felület-munkánál a terv elkészülte
   UTÁN és a tulaj jóváhagyása ELŐTT SEMMI más nem történhet: nincs működő logika, nincs
   tesztelés, nincs adat-csiszolás, nincs kód. A kapu kimenetei: ✅ jóváhagyva → mehet a kód ·
   ✏️ módosítás → új terv-kör · ❌ elvetve.
2. **A terv HELYE a Design-projekt** (`claude.ai/design`, Citoviso Design System), NEM a chat.
   Az AI a `DesignSync`-kel tölti fel; a tulaj ott nézi, és ott **maga is módosíthat** (Edit /
   canvas-chat). A tulaj módosítását az AI `get_file`-lal olvassa vissza — nem kell átgépelni.
   Chatbe képet küldeni csak külön kérésre.
3. **A JÓVÁHAGYOTT terv commitba megy** (`assets/design-refs/console/…`), mint a megvalósítás
   KONTRAKTUSA — befagyasztott, önállóan renderelő pillanatkép. Ez pontosítja az ADR-0065 §3-at:
   a *piszkozat* eldobható és nem commitolt, a *jóváhagyott* terv viszont repó-tartalom, mert
   ehhez mérjük a kész kódot.
4. **Apró javítás** (elírás, szín-fix, meglévő minta követése, hibajavítás) továbbra is mehet
   közvetlenül, ui-shot ellenőrzéssel — a kapu a KINÉZETI DÖNTÉST igénylő munkára szól.
5. **Kapu-erősítés:** a szabály a `CLAUDE.md` §2b-be is bekerül (az kötelezi a jövő sessionöket,
   az ADR-t nem mindenki olvassa vissza), + PostToolUse-nudge (`ui-shot-nudge.mjs`) emlékeztet.

### Visszafordíthatóság

🔄 Munkarend-szabály. A „döntés-igényű" határ tapasztalattal finomítandó — kétség esetén
terv-először. ⛔ Amit NEM lehet visszavonni: a jóváhagyás nélküli továbbdolgozást.

### ⚠️ Utólagos lelet a landoláskor — a jóváhagyott C terv és az ADR-0064 viszonya

A terv-kör alatt NEM olvastam vissza az **ADR-0064**-et (másik szál, 2026-08-23), pedig az
ugyanerről a felületről rendelkezik; a landolási rebase hozta felszínre. A jóváhagyott
`assets/design-refs/console/finance-c-tabla.html` három ponton eltér tőle — **kódolás előtt
tisztázandó, és az ADR-0064 az elsőbbségi** (korábbi tulajdonosi rendelet):

1. **Irány-ikon oszlop.** ADR-0064 §2: „a bizonylatnak TÍPUSA van, **iránya nincs a felületen**".
   A tervben van sor eleji ↗/↙ irány-ikon → elhagyandó, vagy a tulaj kimondott engedélyével marad
   (a „Típus" oszlop amúgy is hordozza: „vevői számla" / „szállítói számla").
2. **A szűrés mechanikája.** ADR-0064 §3: „egy **GET-formban**, lenyílók change-re" (szerver-oldali,
   JS nélkül is működik). A terv kliens-oldali JS-szűrő, ami CSAK a betöltött sorokat szűri — 14
   sornál mindegy, 5000-nél nem. → A megvalósítás GET-form legyen, az autocomplete progresszív
   ráépítés rá.
3. **Dátum-szűrő.** ADR-0064 §3: „dátum **tól-ig**"; a tervben szöveg-tartalmaz szűrő van.
   → Kelte és Fiz. határidő oszlopnál tól-ig mezőpár kell.

Ami EGYEZIK és megerősíti egymást: oszloponkénti szűrő a fejléc alatt, **deviza/Pénznem oszlop**
(ADR-0064 is felsorolja), EGY tábla mindkét irányra (irány = szűrő, nem szekció), fizetve-szűrő,
és hogy a tulaj referencia-képernyője a spec maga.

**Meta-tanulság:** a CLAUDE.md §1.4 („döntés implementálása ELŐTT vissza kell olvasni az érintett
ADR-t") a TERV-fázisra is vonatkozik, nem csak a kódra — a jóváhagyott terv ugyanúgy kontraktus.
Párhuzamos szálaknál a `git fetch` + ADR-visszaolvasás legyen a terv-kör ELSŐ lépése.

# 2026-09-13 — Egy artefaktum = egy fájl (ADR-0140)

**Honnan jött:** az ADR-0134 kép-kapu utóméréséből, a tulaj kérésére („javítsd a ②-t").

## A lelet

A generátor a fájlnevet a lead nevéből és a sablonból rakta össze, ezért ugyanannak a
leadnek ugyanazzal a sablonnal való ÚJRAGENERÁLÁSA **felülírta a korábbi artefaktum
lapját**. Mérve a dev-parkon: **10 fájlon 29 artefaktum** osztozott.

**Miért nem csak rendetlenség:** a `/mock/<id>` és a `/p/<token>` a `path`-ból olvas, tehát
a régi artefaktum linkje az ÚJ tartalmat szolgálja ki — a kurátor mást hagyott jóvá, mint
ami a leadhez kimenne (§I). A `heroOverride` és a `recopy` szintén `row.path`-ba ír: közös
fájlon ezek NÉMÁN átírták egy másik artefaktum tartalmát.

⛔ **És ez az én saját kapumat is megtévesztette:** a felülírt régi artefaktumra az ÚJ fájl
képeit mértem, így egy törött mock **zöldre válthatott** attól, hogy mellé generáltak egy
épet. A mai sweep pontosan ezt mutatta: ugyanaz a fájl kétszer, „6 kép / 0 törött".

⚠️ A `generateEngine` kommentje már kimondta, hogy „one artifact = one file" — de a szabály
csak a SABLON-változatokat választotta szét. **A komment igaz volt a szándékról és hamis a
viselkedésről**; ugyanaz a hibaosztály, mint a „mérés megvolt, következtetés hiányzott".

## Szállítva

- `persist.mockArtifactPath()` + `newArtifactId()`: a név az AZONOSÍTÓBÓL származik,
  **egyetlen helyen**. Az azonosítót a render ELŐTT kérjük el, és a DB-sor is azt kapja
  (`recordMockArtifact({id})`) — különben a lemez és a sor némán elválna.
- A három kézzel írt névadó-másolat megszűnt (2 fájl, 3 hívási hely).
- `photoGateBlocks`: a felülírt fájl **MINDIG blokkol, és tudomásul sem vehető** — a
  `verdict === "ok"` ág ELŐTT, mert a képek ilyenkor épek lehetnek.
- A felirat nem a kép-mondatot mondja rá: más a baj, más a mondat.
- A meglévő sorokat NEM írjuk át: a felülírt tartalom nincs meg, visszaállítani nem lehet,
  csak hazudni róla.

## Őr

5 új állítás a `mock-photo-gate-check.mts`-ben, köztük a **szerkezeti iker**: egyik
generátor-ág sem épít kézzel `mock-${…}.html` nevet, és mindkettő a közös névadót hívja.
**Visszarontva mérve pirosra megy** (a kézi név-építés visszatétele 2 bukás).

## Nyitott

- A parkban **29 artefaktum** osztozik 10 fájlon (örökség). A kapu megnevezi őket; a
  jóváhagyottak közt jelenleg nincs ilyen (a felülírt ELEK-artefaktumot egy párhuzamos
  szál visszaminősítette).
- Egy leaden KÉT `approved` mock állt (a `curateArtifact` fölérendelése valamelyik úton
  nem futott) — mérve azóta 1. Külön lelet, nem ez az ADR javítja.

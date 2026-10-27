## ADR-0410 — A robots.txt válaszát az RFC 9309 szerint olvassuk

**Dátum:** 2026-10-27 · **Státusz:** elfogadva (lokál, nem élesítve) · Módosítja: a portál-olvasás udvariassági rétegét (`src/scraper/sources/portals/politeness.ts`)

### Kontextus

A behúzó minden oldal előtt elolvassa a host robots.txt-jét. A régi szabály a 401-es és a 403-as
választ tiltásnak vette („a host jelez valamit, amin nem olvasunk át”). A Fecske Kabin (30a461c4)
saját oldala, a fecskekabin.hu a robots.txt-re 403-at ad, a lapjait viszont a botunk User-Agentjével
is kiszolgálja (200). A behúzó ezért 422-vel állt meg („a robots.txt nem olvasható”).

Az RFC 9309 (§2.3.1) szerint a 4xx-es robots.txt „nem elérhető”: a robot korlátozás nélkül olvashat,
ugyanúgy, mintha nem volna fájl. Teljes tiltást csak a „nem érhető el” eset jelent (5xx, hálózati hiba).
A koordinátor és a tulaj döntése (2026-10-27): **igen, térjünk át az RFC 9309-re**, a 429 kivételével.

### Döntés

1. **2xx:** a fájlt beolvassuk, és betartjuk (Allow/Disallow, a leghosszabb egyezés szabálya, Crawl-delay).
2. **4xx, a 429 kivételével** (401, 403, 404, 410 …): nincs korlátozás.
3. **429, 5xx, hálózati hiba, időtúllépés** és minden más olvashatatlan válasz: teljes tiltás.
4. Hostonként egy robots-kérés, 6 órás gyorsítótárral; a lapkérések a meglévő hostonkénti szünettel mennek.
5. Változatlan: azonosítható User-Agent, böngésző-hamisítás nincs, anti-bot kihívást nem kerülünk meg.

### Következmények

- A 401/403-as robots.txt-ű saját oldalak (Fecske Kabin) behúzhatók.
- A szabály egy tiszta függvényben él (`robotsPolicyForStatus`), őre a valódi `mayFetch`-en méri,
  hálózat nélkül: `scripts/robots-policy-check.mts`.

### Visszafordíthatóság

🔄 Olcsón visszavonható: egyetlen függvény; külön commitban, hogy a deploy előtt tisztán visszafordítható legyen.

### Elvetett alternatíva

- A 401/403 további tiltásként kezelése: a szabvány mást mond, és élő saját oldalt zárt ki.
- Kivétel-lista hostonként: kézi karbantartás, és ugyanazt a szabályt sértené.

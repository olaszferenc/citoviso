## ADR-0477 — Országfüggő kontaktkereső (HR): ingyenes kereső a szótárból, aggregátor-szűrő, website-írás, egy kód dev/prod DB-kapcsolóval

**Státusz:** ELFOGADVA (brief `hr-kontaktkereso-20261125`, koordinátor `cit9b4690e3`) — a szótár-kulcsok a repóban;
a lánc-kód (`~/rc-briefs/uj-lanc-hr/`) az éles lánc (`~/rc-briefs/uj-lanc/`) cseréjére **a koordinátor engedélyére vár**
(`bash ~/rc-briefs/uj-lanc-hr/atallas.sh go`). ·
**Épít:** ADR-0467 (gyűjtés országfüggően), ADR-0470 (HR végpróba), ADR-0475 (település-index, isAffiliateRedirect).

### Kontextus
A tulaj 2026-11-25-én azt mondta, hogy az e-mail-címek forrása a lánc kontaktkeresője: a begyűjtött leadeket utána
ez frissíti, Magyarországon így megy. A Makarska dev-próbában (ADR-0475) a 47 leadből csak 7-nek volt e-mailje. A
kontaktkereső HR-re ezért nem működött:
- a Bing az idézőjeles nevet és a települést figyelmen kívül hagyja, a Brave 429-et ad;
- a housity.net / buiibo.com átirányítást saját honlapnak vette, és az aggregátor e-mailjét adta;
- a megtalált saját honlapot nem írta a `website` mezőbe;
- a lánc csak az éles DB-t ismerte.

Mérve 2026-11-25-én a dev gépről, headless böngészőben: a Startpage a Google indexét adja (a kivonatokban e-mail és
telefon is van); a Qwant és az Ecosia csak az első kérésre válaszol. Blokkol: DuckDuckGo (418), Mojeek (ALTCHA),
Yandex (captcha), Google friss profillal (`/sorry/`). Portálok: az apartmanija.hr adatlapja kiadja a tulaj
telefonját és néha az e-mailjét a szabad szövegben. A külföldi tükrei (direct-croatia.com, obmorju.si, direkt-kroatien.de
stb.) ugyanazt az adatbázist adják, de gépi fordítással az e-mailt is átírják („apartitonkita @ gmail. com”).
Az accommodation.croatia.hr-en (HTZ) és a TZ Tučepi listáján nincs tulaj-kontakt.

### Döntés
① **A kereső az ország szótárából jön.** Új HR-kulcsok (`src/countryLexicon/hr.json`):
- `chainKontaktSearchEngines: ["startpage","qwant"]`: a sorrend egyben a tartalék-sorrend, motoronként külön
  kihátrálással (2, 4 … 60 perc). A lánc `kontakt/kereso.mjs` fájlja böngészővel olvas, nem API-val ($0).
  A Startpage nyelve a meglévő `chainHonlapStartpageLui`.
- `chainKontaktAggregatorRegex`: ha egy „saját” jelölt végső hosztja aggregátor vagy portál, illetve
  affiliate-továbbítás (ADR-0475 `isAffiliateRedirect`, a lánc-portja), akkor nem saját honlap.
- `chainKontaktFillWebsite: true`: üres `website` mező esetén írja a saját honlapot, ha pontosan egy erős saját oldal
  van, amelynek a hosztjában ott a márkaszó, és vagy a telefon egyezik, vagy a Maps-panel linkeli. Telefon-ütközésnél
  nem ír.
- A `chainKontaktSkipHostRegex` kiegészül a gépi fordítású apartmanija-tükrökkel és a housity/buiibo/vrbo
  hosztokkal. Az eredeti apartmanija.hr forrás marad.

A meglévő `portalTownIndexes` kulcs (ADR-0475) a kontaktkeresőben is jelöltet ad: közös márkaszó és ≤1 km.
Ha az adatlap telefonja egyezik a leadével, a portálon talált e-mail elsődleges forrás lesz (`portal-ti`).

② **HU bájtra változatlan.** A HU-szótár egyik új kulcsot sem kapja. Kulcs nélkül a kód a régi úton megy
(Bing + Brave, nincs település-index, nincs aggregátor-szabály, nincs website-írás). Mérve 14 HU-leaden (dev DB,
determinisztikus minta) régi/régi/új futással: a keresőkérések száma azonos (Bing 25, Brave 3, Maps 9), 0 új
kereső- vagy index-kérés. A verdikt+írás egyezése: régi–régi 11/14, régi–új 12–13/14, vagyis az eltérés a web zajának
szintjén marad.

③ **Egy kód, DB-kapcsolóval.** `CIT_DB=prod|dev` (alapértéke `prod`; más érték → leáll, prodra soha nem esik
vissza). A dev a helyi psql-t (`/tmp:5433 citoviso_dev`) és a dev konzolt (`:4600`) használja, a cache-ek és a
done-fájlok dev-ben külön fájlba mennek. A lánc-önteszt: `kontakt/selftest-orszag.mjs`.

### Mérés (dev DB, $0, 2026-11-25)
- **Makarska, 47 lead: 7 → 17 e-mailes.** Kontaktkereső: saját honlap 2, Facebook 2, apartmanija.hr 1;
  Startpage e-mail-kereső: 5.
- **Baška Voda / Brela, 97 lead: 32 → 57 e-mailes** (a honlap nélküliek közül 1 → 22).
- Kézi átnézésnél kiesett: 3 ügynökség-e-mail, 1 foglaló-aloldal, 5 rossz képlink, 1 turisztikai irodai cím. Ezek
  hosztjai és mintái bekerültek az aggregátor-, illetve a `chainKontaktEmailDenyRegex` szabályba.
- Mock a teljes láncon (Villa Dalmatino, Parallax), $0,26 API-egyenérték.

Részletek: `_planning/memory/2026-11-25_hr-kontaktkereso.md`.

### Visszafordíthatóság
🔄 A HR-kulcsok törlésével a régi út visszaáll. A lánc-csere tgz-mentéssel megy, és egy paranccsal visszaállítható
(`atallas.sh rollback`).

### Elvetett alternatívák
- Fizetős kereső-API (Brave API, SerpAPI, Google CSE): tilos (feedback_email_outreach_free_only).
- DuckDuckGo / Mojeek / Yandex: captchát adnak (mérve).
- A tükör-portálok e-mailje: gépi fordítással torzul, ezért kihagyva.

### Nyitott
- Az átnéző (`egylepes-elo` / `kor.sh`) még prod-kötött; nem része ennek a változtatásnak.
- Az `orszag.py` (a Python-iker) még nem kapott DB-kapcsolót.
- A Startpage kb. 200 kérés után blokkol (Baška Vodán 35/45 leadnél állt le, a Qwant sem válaszolt): nagy tételt
  több napra kell bontani, vagy egy további ingyenes motor kell.
- A Maps-panel címében marad az ikon-karakter (U+E0C8), és a csak irányítószámos cím is beíródik: a meglévő kód
  hibája, HU-n is él.

## ADR-XXXX — Ország-réteg 3/7: a jogi csomag országonként, az ország nyelvén — a piac-kapu a csomag teljességét nézi

**Státusz:** ELFOGADVA (tulaj 2026-11-18, ügyvédi állásponttal; brief `orszag-reteg-3g-jogi-csomag-20261118.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0110 (tenant jogi lábazat), ADR-0111 (piac-kapu), ADR-0036 §C, ADR-0437 (ország-réteg `legal_pack` mező), ADR-0456 (megkeresés: `untranslated`, „Bábelre vár”), ADR-0457, ADR-0412 (csak Bábel fordít) ·
**Lezárja:** ADR-0111 „Nyitott” első pontját (a jogi csomag tartalma országonként) és a 03-INVARIANTS §27 figyelmeztetését.

### Kiváltó

Egyetlen, magyar jogi csomag volt (`src/legal.ts`, a saját jogi lapok, a tenant-impresszum és -adatkezelés, a
megkeresés jogi mondatai, a süti-sáv), ezért az ADR-0111 piac-kapu minden nem-HU országot zárva tartott — és ha
egy piacot a tulaj megnyitott volna, a vevő magyar jogi szöveget kapott volna. **Ügyvédi álláspont (tulaj,
2026-11-18):** a mai jogi szövegek AZ ADOTT ORSZÁG NYELVÉN elhelyezve lehetővé teszik az üzletszerzést abban az
országban; az ügyvéd további kommentjéig így használható.

### Döntés

① **A csomag = a magyar forrás Bábel-fordítása, országonként** (`src/legalPack.ts`,
`src/i18n/babel/legal/<CC>.json` `{country, lang, base, entries}`). A kulcs a TELJES magyar egység (mondat,
bekezdés, a saját lapoknál a blokkelem belső HTML-je helyőrző-értékekkel) — a magyar szöveg bármely változása a
régi fordítást árván hagyja, a csomag hiányos lesz, a kapu zár. A csomag nyelve az ország-sor `default_lang`-ja.
A tartalom azonos, csak a nyelv más: a jogszabály-hivatkozást (45/2014. Korm. r., Grt., Eker.tv., GDPR) a fordítás
NEM honosítja — ez a Bábel-export szabálya is. Futásidőben semmi nem generálódik (§H.22).

② **Két alkalmazás, egy szótár.** A rövid, bélyegzett szövegek (fotójogi nyilatkozat, ÁSZF-elfogadás, lemondó
nyilatkozat, ismétlődő fizetés, próba-elfogadás, ÁFA-megjegyzés, süti-sáv, megkeresés jogi mondatai, leiratkozó
lap) `pack.t(hu)`-val; a saját jogi lapok (ÁSZF, elállás, impresszum, adatfeldolgozás, adatkezelés)
`translateLegalHtml()`-lel: a magyar lap helyőrző-adatokkal renderelve, egységenként fordítva, majd kitöltve,
`?c=<CC>` / `?l=<nyelv>` címen. A tenant-lapok és a sáv a renderelőn átfutó fordítóval (`trOf(pack)`), a forrás-
egységeket egy rögzítő fordító gyűjti a lapok tényleges renderelésével — új felirat nem maradhat ki a számlálásból.

③ **Helyi kötelező elemek ADATBÓL** (`src/legal.ts` `LEGAL_LOCAL`, nem nyelvi if-ek): IT CIN (+ CIR) és P.IVA ·
ES NRUA + regionális turisztikai szám + NIF · PT AL-szám + online panaszkönyv-link (alapértéke a nemzeti cím) +
vitarendező szerv + NIF · FR regisztrációs szám + SIREN + a tárhelyszolgáltató címe és telefonja (LCEN) · BG
nyilvántartási szám + ЕИК · HR kategorizálási határozat + OIB. Értékük `tenant_legal.local_fields` (0141), az
admin „Jogi adatok” panelje a meglévő mezőmintával kéri, hiányuk a meglévő `missingImprintFields` /
„— nincs megadva —” mintával látszik; a sávban (minden oldalon) a regisztrációs számok és az IT P.IVA.
**Saját fogyasztói vitarendezőnk** (FR médiateur, PT RAL) konfigból (`LEGAL_ADR_FR` / `LEGAL_ADR_PT`); amíg üres,
az ország FOGYASZTÓI útja zárva (a rendelés `consumer_route_closed`), a vállalkozói nyitva.

④ **A piac-kapu = jóváhagyás ÉS teljes csomag** (`markets.marketGate` / `isMarketApproved`; teljesség:
`legalPackStatus` — lekérdezhető, dokumentumonkénti számlálással, a 8. lépés „Országok” lapja ezt mutatja). Mivel
minden hívó ezt olvassa, egyszerre zár: hideg megkeresés, próba, pay-link, élesítés — és MOSTANTÓL a konfigurátor
is (minden belépő: `regionForArtifactOrNull`) és a rendelés felvétele (`orderLegalPack`). Hiányos csomagnál a
saját jogi lap 404, a levél jogi sora a fallback-listára kerül (a §C-kapu TARTJA), a tenant nem kap jogi lapot és
sávot. ⛔ Magyar fallback SOHA.

⑤ **Bélyeg:** a rendelés és a próba a csomag szövegét bélyegzi, és mellé `legal_pack` = `<ország>/<nyelv>/
aszf-<v>+tenant-<v>` (0141, additív; a HU szövegek bájtra a régiek, a HU rendelés bélyege `HU/hu/…`).

⑥ **Süti-sáv:** a 3/5-ből parkolt i18n-patch alkalmazva, a szöveg a jogi csomagból. Az elutasító gomb a mai
HU-sávon is az első rétegen, az elfogadással azonos méretben áll (kontúros vs. kitöltött) — HU-változás nincs.

⑦ **A HU-csomag bájtra a régi** — mérve (22 HU-kimenet pillanatképe előtte/utána; e2e ⑤; country-layer-check ⑪).

### Mérés
- `scripts/country-layer-check.mts` ⑪ (pre-commit): a lefordított csomagokban nincs magyar (forrással egyező
  egység, ő/ű), helyőrző/jelölés ép, nyelv = ország-sor; bélyeg ország+nyelv+verzió, mindkét elfogadás-insert
  írja; a `legal_status`-t csak a `markets.ts` olvassa, a kapu teljességet kér, minden konverziós belépő olvassa,
  hiány → kivétel (nem magyar), a teszt-kapcsolók nincsenek a `.env`-ben; a hat ország helyi sémája definiált;
  HU bájtra.
- `scripts/legal-pack-e2e.mts` (scratch DB, HU+IT+BG+PT, FR egységszinten): 58/58.
- A közös gate miatt a meglévő külföldi e2e-k (country-mock, country-outreach, money-path, market-gate-check)
  jelölő-fixtúrát kapnak (`scripts/lib/legal-pack-fixture.mts` — nem fordítás, temp könyvtár). BG fixtúra-pénznem
  BGN → EUR (2026-01-01 óta).

### Visszafordíthatóság
🔄 — additív oszlopok; a HU út változatlan; a kapu szigorítása egy függvény (`marketGate`).

### Nyitott
- **Bábel:** a hat ország csomagja (IT 228, BG 227, FR 229, ES 228, HR 227, PT 231 egység):
  `npx tsx scripts/babel-pack.mts legal-export <CC> [--lang <kód>]` → fordítás → `legal-import <CC> <fájl> --seed`.
  Az ország-sor (`default_lang`) nélkül a `--lang` kell; a gate ország-sort is kér.
- A konzol „Piacok — jogi csomag” panelje a jóváhagyást mutatja, a csomag-hiányt még nem (a 8. lépés „Országok”
  lapja a `marketGate().reasons`-t olvassa).
- A tenant-admin UI-feliratai (nem jogi) a UI-csomagból jönnek; a hiány-figyelmeztetés szövege a magyar törvényt
  nevezi — tartalmilag azonos (ügyvédi álláspont), ha az ügyvéd mást mond, ott kell módosítani.

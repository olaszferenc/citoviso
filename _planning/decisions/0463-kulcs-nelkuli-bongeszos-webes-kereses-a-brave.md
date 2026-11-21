## ADR-0463 — Kulcs nélküli, böngészős webes keresés a Brave után (Startpage, $0)

**Státusz:** ELFOGADVA (tulaj 2026-11-22: „a brave kiváltása már most is mehet”, keret: pénzt nem költünk; koordinátor `citb64f0ed0`, brief `brave-kivaltas-20261122.md`) · **Élesítés:** NINCS (külön utasítás) ·
**Épít:** ADR-0026 (webes keresés egy interfész mögött, Brave elsődleges) — azt nem írja felül, kiegészíti egy harmadik backenddel.

### Kiváltó

2026-11-21-én mindkét Brave-kulcs (`BRAVE_API_KEY`, `BRAVE_API_KEY_2`) HTTP 402-t adott, mert elfogyott
az ingyenes keret. Kulcs nélkül a `webSearch()` üresen tér vissza: kimarad a honlap-felderítés
(`enrichSiteSearch`, `enrichOutdated`), a kontakt-keresés (`enrichWebSearch`), a portál-jelölt keresés
(`portalListing`) és az események gyűjtése (`events/gather`). Fizetős API-t vagy kreditet a tulaj nem enged.
(2026-11-21 23:56-kor az első kulcs újra 200-at adott, valószínűleg megújult a havi kerete. A sorrend ezt kezeli:
amíg van élő kulcs, az fut.)

### Döntés

1. **Sorrend:** Brave (amíg van használható kulcs) → **böngészős keresés** → legacy CSE (csak ha be van állítva) → üres.
   Ha egy Brave-hívás a sorban utolsó kulcsot is félreteszi (402), UGYANAZ a lekérdezés azonnal a böngészőhöz megy,
   így a lead felderítése nem vész el csendben (ADR-0026 elve).
2. **Motor: Startpage**, fej nélküli Chromiumban (`src/scraper/sources/webSearchBrowser.ts`). Mérve 2026-11-22-én a dev gépről:
   - **Startpage:** működik. Google-forrású találatokat ad, de a saját IP-jéről, így nem égeti a mi IP-nk Google-captcha keretét.
     Az első látogatásnál proof-of-work oldalt kap, ezt a böngésző magától megoldja.
   - **Yahoo:** a 2. gépi lekérdezéstől `/_bv/` bot-ellenőrzésre irányít.
   - **Bing** (böngészőből és sima HTTP-n is): botnak a kérdéshez nem tartozó találatokat ad.
   - **DuckDuckGo** (html, lite, js): már az első kérdésre „anomaly” kihívást ad.
   - **Brave HTML:** 429 vagy üres oldal.
3. **Fékek:**
   - Folyamatonként egy böngésző, lustán indul, és 30 mp tétlenség után bezár (a CLI így ki tud lépni, a konzolban sem marad Chromium).
   - A lekérdezések sorban futnak, köztük legalább 3 mp szünettel.
   - Bot-ellenőrzés vagy tiltás után a backend 60 percig szünetel, ezt hangosan naplózza; a hívó addig üres eredményt kap.
     Tiltásnak számít, ha az oldal elhagyja a startpage.com-ot, vagy 403-at ad.
4. **Kapcsoló: alapból KI** (koordinátor, 2026-11-22). Csak `WEB_SEARCH_BROWSER=on` kapcsolja be; a dev `.env`-ben be van kapcsolva, élesen nincs, ezért ott nem indul Chromium, amíg a Hetzner-IP-ről nincs mérés. Ehhez Chromium kell (`CHROMIUM_PATH`, élesen `/usr/bin/chromium` megvan).

### Következmények

- **A Startpage nem tömeges motor** (mérve 2026-11-22): ~200 lekérdezés ~2,5 óra alatt, és a dev IP-t egy 403-as,
  nem a startpage.com-on lévő oldalra irányította. Ez tehát tartalék néhány kérdéshez, amíg a Brave-kulcs ki van merülve.
  Nem helyettesíti a Brave-et. A saját-honlap kapu 200 leades összevetésében 100 Brave-VAN-ból 23-at NINCS-nek ítélt,
  ezért ott a böngészős ítélet csak VAN_HONLAP lehet.

- **Élesen alapból KI**; ha valaki bekapcsolja, ezek érik el: a konzol reenrich és rescrape-photos gombja, a scrape-gyerekfolyamat, valamint a
  `citoviso-events(-pending)` timer (5 percenként) éri el. Bekapcsolva ezek a halott Brave-kulcs mellett Chromiumot indítanának
  (az éles gépen 3,7G RAM van). A Startpage viselkedését a Hetzner-IP-ről élesítés előtt külön meg kell mérni.
  Ha ott blokkol, a backend csak szünetel, hibát nem okoz.
- A saját-honlap kapu (`~/rc-briefs/uj-lanc/honlapcheck/`, nem a repó része) ugyanezt a motort használja
  (`web_check.py` + `kereso/serp.mjs`), a minőség-kapuja a 200 leades összevetés a korábbi Brave-ítéletekkel.

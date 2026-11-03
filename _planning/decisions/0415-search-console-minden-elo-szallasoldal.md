## ADR-0415 — Search Console: minden élő szállásoldal automatikus beküldése a Google-nek

**Dátum:** 2026-11-03 · **Státusz:** MEGVALÓSÍTVA (kód + őr landol), ⛔ ÉLESEN NINCS — élesítés: egyszeri beállítás + deploy, külön engedéllyel ·
**Kapcsolódik:** a „Portál-jutalék kiváltása és megtalálhatóság” ADR 1. pontja (tulaj 2026-11-02, „2-t is be kell küldeni”; 2026-11-03 „ok ez így jó mehet. ezt indítsuk is el.”), `_planning/VISIBILITY.md` §1/A, ADR-0041 (slug → saját domain 301), ADR-0071/0103 (domain-állapotgép, terv-B Websupport-zóna), ADR-0276 (OnFailure-riasztás)

### Döntés

1. **Mit küldünk be.** Minden élő (`site.status = 'live'`) oldal `https://<cím>/sitemap.xml`-jét:
   - **citoviso.com-os cím** — amikor az oldal élővé válik (próba indulása vagy vásárlás, amelyik előbb jön),
     az EGY közös `sc-domain:citoviso.com` Domain-tulajdon alá (a Domain-tulajdon minden aldomaint lefed);
   - **saját domain** — amikor a `site.custom_domain` beíródik (a `provisionDomain` pontosan akkor írja, amikor a
     DNS + TLS mérten rendben és a `custom_domain_status` `live`), a saját `sc-domain:<domain>` tulajdon alá.
     Ettől kezdve a citoviso.com-os cím 301-gyel a saját domainre visz, ezért annak sora **kivezetődik**
     (egy átirányító sitemapet a Google „Couldn't fetch”-ként jelentene, és a 301 a saját domaint teszi kanonikussá);
   - **újra**, ha a sitemap `<loc>`-halmaza megváltozik (új egység-aloldal, új fizetett nyelv) — 6 óránként nézzük.
2. **Egyeztető időzítő, nem hívás az élesítésben.** `citoviso-search-console.timer` (15 perc, prod) olvassa, mi él,
   és hozza összhangba a `search_console_target` táblával. Az élesítés kódja nem tud róla → a Google kiesése, a kvóta,
   a hiányzó kulcs sosem buktathat el próbát, vásárlást vagy domain-élesítést. Idempotens (egy sor oldal × cím).
   Hiba → visszalépés (15 perc, duplázva, max. 24 óra), az 5. egymás utáni hiba után EGY ház-levél.
   Napló: `search_console_event` (minden külső hívás, válaszkóddal és szöveggel; `live=false` = dev/mock).
3. **Saját domain ellenőrzése géppel.** A zónát mi kezeljük (Websupport, terv-B), ezért a service account maga
   ellenőrzi: Site Verification `getToken` (INET_DOMAIN, DNS_TXT) → TXT az apexre (csak HOZZÁAD, az SPF-et és a
   tulaj egyéb rekordjait nem érinti) → 5 perc terjedés → `webResource.insert` (a `SEARCH_CONSOLE_OWNER_EMAILS`
   társtulajdonosként) → `sites.add` → `sitemaps.submit`. A szállásadónak nincs vele dolga.
4. **A citoviso.com tulajdon egyszeri beállítás** (`scripts/search-console-setup.mts`), az időzítő nem nyúl hozzá.
5. **Csak éles hoszt hív Google-t** (`isLiveHost`); máshol ugyanaz a kód a mock-klienssel és a HELYI publikus
   szerverrel fut — a dev sosem éri el a Google-t, és sosem olvassa az éles oldalakat.
6. **Google Cloud:** `mineralcrm` projekt (ott él a Citoviso Maps-kulcsa is), bekapcsolva a `searchconsole` és a
   `siteverification` API, service account: `citoviso-search-console@mineralcrm.iam.gserviceaccount.com` (2026-11-03).

### Mit ad a beküldés (§B.17 — forrással)

- „submitting a sitemap is merely a hint: it doesn't guarantee that Google will download the sitemap or use the sitemap
  for crawling” — developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap. A robots.txt-beli
  `Sitemap:` sorral a Google magától is megtalálja („We will find it the next time we crawl your robots.txt file”, uo.).
- A beküldés többlete: „The sitemap should be fetched immediately”, és a Sitemaps-riport CSAK a beküldött sitemapet
  mutatja („It does not show any sitemaps discovered through a robots.txt reference”) — így látjuk, letöltötte-e a
  Google és hibát talált-e (support.google.com/webmasters/answer/7451001). A ping-végpont 2023 óta megszűnt
  (developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping). **Indexelést, helyezést nem ígér.**

### Korlátok (forrással)

- Search Console API: 20 QPS / 200 QPM felhasználónként (developers.google.com/webmaster-tools/limits) — egy futás
  legfeljebb 30 célt kezel, célonként ≤ 5 hívás.
- Legfeljebb **1000 tulajdon fiókonként** (support.google.com/webmasters/answer/34592) — minden saját domain egy
  tulajdon; a 1000. saját domain előtt dönteni kell (második service account).
- A Sitemaps-riport legfeljebb 1000 beküldést MUTAT tulajdononként (a beküldés ennél több is lehet) — a
  `sc-domain:citoviso.com` alatt ennyi aldomain látszik a felületen, a mi naplónk a teljes.

### Nyitott, mérendő (nincs dokumentálva)

- ⚠️ Hogy egy **service account maga** ellenőrizhet-e Domain-tulajdont DNS TXT-vel, egyetlen Google-oldal sem mondja ki.
  Az első élő próba (a citoviso.com „A” útja, vagy az első saját domain) dönti el; ha nem megy, a hiba a naplóban
  látszik, az élesítést nem érinti, és a tartalékút: a tulaj egyszer felveszi a service accountot tulajdonosnak.
- Hogy egy aldomain sitemapje `sc-domain:citoviso.com` alá beküldhető, a dokumentáció erősen állítja (Domain-tulajdon
  = minden aldomain; cross-submission ellenőrzött tulajdonnál), szó szerint nem — az első beküldés méri.

### Elvetett

- Hívás közvetlenül a próba-/vásárlás-/domain-kódban — egy külső hiba élesítést buktathatna, és nincs újrapróba.
- Fájl/meta-tag ellenőrzés a saját domainen (URL-prefix tulajdon) — a `public.ts`-be új útvonal kellene, és csak egy
  protokoll/hoszt-változatot fedne; a DNS TXT a www-t és a http-t is lefedi, és a zóna úgyis a miénk.

### Visszafordíthatóság

🔄 Az időzítő letiltása mindent megállít; a beküldött sitemap a Search Console-ban törölhető. A TXT-rekordok ártalmatlanok.

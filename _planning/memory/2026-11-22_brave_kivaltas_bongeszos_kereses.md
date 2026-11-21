# 2026-11-22 — Brave-kiváltás: kulcs nélküli böngészős keresés (csak tartalék), honlap-kapu Brave elöl + böngésző csak VAN

**Session:** `cit90798fff` (SUB), koordinátor `citb64f0ed0`, brief `~/rc-briefs/brave-kivaltas-20261122.md`. **ADR-0463.** Élesítés NINCS.

## Mérés (dev IP, headless Chromium)
- Startpage működik (Google-forrású találat a saját IP-jéről), de ~200 lekérdezés / ~2,5 óra után 403-ra tiltotta az IP-t (a startpage.com-on kívüli oldalra irányít).
- Yahoo: a 2. kérdéstől `/_bv/` bot-ellenőrzés, és egyszer 0 találatot adott hibajel nélkül. Bing: botnak a kérdéshez nem tartozó találat. DuckDuckGo html/lite/js: anomaly. Brave HTML: 429.
- A 200 leades minőség-kapu (100 Brave-VAN + 100 Brave-NINCS, élesből olvasva), Startpage:
  - VAN-ból: VAN 74, NINCS 23, GYANUS 3.
  - NINCS-ből: NINCS 61, VAN 5, GYANUS 1, és 33 hiba (a tiltás miatt).
  - A téves NINCS 23%, vagyis a böngésző csak VAN_HONLAP-ot dönthet.
- A `BRAVE_API_KEY` 11-21 23:56 óta újra 200 (megújult a kerete), a `_2` továbbra is 402.

## Elvégezve
- **Honlap-kapu** (`~/rc-briefs/uj-lanc/honlapcheck/`, nem repó):
  - `kor.sh`: a Brave megy elöl; a leadek, amelyekig a Brave nem jutott el, a `web_check.py`-hoz kerülnek (Startpage, `kereso/serp.mjs`).
  - A böngésző NINCS-e GYANUS-ként íródik; a `by` mező a forrás (brave / startpage-browser / free_dns).
  - Brave 402 esetén egy sor kerül a `lanc.log`-ba: „Brave 402, csak VAN-ítélet”.
  - Mentés: `kor.sh.bak-20261122`. A mintafájlok helye: `kereso/minta/`.
- **Repó:**
  - `src/scraper/sources/webSearchBrowser.ts` (új), `webSearch.ts`.
  - Sorrend: Brave → böngésző → CSE → üres. Tiltásnál 60 perc szünet.
  - `WEB_SEARCH_BROWSER` alapból KI (koordinátor); a dev `~/citoviso/.env`-ben `on`.
- A 722 ítéletlen no_site lead mind már megkeresett és mockos; a kapu szándékosan kihagyja őket. Koordinátor: utólagos ítélet nem kell.

## Nyitott
- Élesítés előtt meg kell mérni a Startpage-et a Hetzner IP-ről; addig élesen KI marad.
- Ha a Brave-kulcs ismét kifogy, a lánc NINCS-ítélet nélkül marad (látszik a `lanc.log`-ban).

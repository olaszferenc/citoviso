## ADR-0026 — Webes keresés backend: BRAVE SEARCH (a Google CSE zsákutca; a Bing API halott)

- **Kiváltó (2026-08-07):** a honlap-felderítés bekötésekor tévedésből a Google CSE-re építettem,
  holott a döntés 2026-07-07/11 óta megvolt — de CSAK session-jegyzetben
  (`_planning/memory/2026-07-07_presence_detection.md`), **nem ADR-ként**. A tulaj jogosan reklamált:
  ekkora projektnél a döntés ADR-be való, különben elsikkad és újra eldöntjük (rosszul).
  **Ez az ADR a jegyzetben rögzített döntés formalizálása, nem új döntés.**
- **Külső táj (kikutatva 2026-07-07):**
  - **Bing Web Search API: HALOTT** — a Microsoft 2025-08-11-én lekapcsolta.
  - **Google Programmable Search „entire web": KIVEZETÉS ALATT** — új PSE már nem kaphatja meg,
    a meglévők **2027-01-01-ig** élnek → nem szabad rá építeni. (Ráadásul a mi projektünkben a
    Custom Search API be sincs kapcsolva: 403.)
  - **Brave Search API**: független index, olcsó, nincs „site restriction" csapda. → **EZ A VÁLASZTÁS.**
- **Architektúra:** `sources/webSearch.ts` = **diszpécser egy interfész mögött** — Brave elsődleges
  (`BRAVE_API_KEY`), Google CSE csak LEGACY fallback (azoknak, akiknek még van entire-web joguk),
  backend nélkül üres eredmény, de **HANGOS** naplóval. A hívók (`enrichSiteSearch`, `enrichWebSearch`)
  a backendet nem ismerik. Backend-csere = egy adapter, nem pipeline-átírás.
- **⛔ A csendes degradáció TILOS (vérrel tanult):** a CSE 403-at eddig üres találatlistaként nyeltük el
  → valós honlappal bíró leadek „nincs honlapja"-ként mentek tovább. Egy ilyen leadnek azt írni, hogy
  „nincs honlapja", **hitelesség-romboló** (§F). Ezért minden backend-hiba hangosan naplóz (egyszer/ok).
- **⏱️ IDŐZÍTÉS (tulaj-döntés, 2026-07-11 — VÁLTOZATLAN):** a fizetős search-tail **akkor élesedik,
  amikor a KURÁTOR is automata.** Amíg ember kurál, ő elkapja a fals negatívot; a per-query költség
  csak automata kuráció + volumen mellett térül meg. Addig a 0-API domain-guess (fordított
  token-sorrenddel is) viszi a farkat. A kód KÉSZ és bekötve, kulcs nélkül no-op.
- **A presence-réteg rendje (változatlan, §F.13–16):** Maps `websiteUri` → domain-guess + geo-szigorú
  HTTP-proba (0 API) → **web-search tail (Brave)** → mindegyik találat UGYANAZON a `verify()`-on
  (márka-mag ÉS régió kötelező; parkolt/portál kizárva) — **brand-only = kollízió, elvetendő.**
- **Visszafordíthatóság:** 🔄 könnyű — a diszpécser mögött a backend cserélhető (SerpAPI/Tavily/Exa
  ugyanígy beköthető), a hívók érintetlenek.
- **Státusz:** ELFOGADVA (a 2026-07-07/11-i tulaj-döntés formalizálva 2026-08-07-én).
  Kulcs-beszerzés (`BRAVE_API_KEY`) = tulaj-feladat, az élesítés az automata kurációhoz kötve.

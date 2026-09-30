## ADR-0281 — A magyar névelő-placeholder ({art}/{Art}/{art2}) nem-magyar nyelven üres; a fordító újrapróbál (2026-09-30)

**Kontextus — mérve.** A nagy deploy GATE 5-je élesen elbukott: `en: 3694/3701 — 7 UI-string hiányzik`,
és a boot-öngyógyítás ugyanazt a hetet bukta kétszer (determinisztikus). Mind a hét `{Art} {domain} …`
alakú: az `{Art}` a `huArticle()` („A”/„Az”, ADR-0101 ①) — angolban nincs megfelelője, a fordító
jogosan hagyta el, a `translateBatch` placeholder-őre pedig eldobta a stringet, **újrapróba nélkül**.
A fordítás másik fele még rosszabb: a dev csomagokban mind a 6 nyelv mind a 33 névelős kulcsban
MEGŐRIZTE a tokent, vagyis az angol felület „We couldn't purchase A example.hu”-t írt.

**Döntés.**
1. Az `art`, `Art`, `art2` (`/^art\d*$/i`) nevű változó a MAGYAR határozott névelő. Ha a `T()` valódi
   fordítást ad vissza (nem-`hu` nyelv, és a csomag tartalmazta a stringet), a token egy szomszédos
   szóközzel együtt ÜRESRE cserélődik (`interpolate()` a `packs.ts`-ben, a `mail.ts` `T()`-je hívja — minden névelős hívás azon megy; a sablon-oldali `templateKit.ts` `T()`-jét névelő-var nem éri, ezért nem változott).
   Magyarul és a hu-fallbacknél a névelő marad.
2. A fordítónak az `{art}`-tokenek megőrzése NEM kötelező (a prompt ki is hagyatja őket); kitalálni
   viszont nem szabad olyat, ami a forrásban nincs. Minden más placeholder betűre kötelező.
3. A placeholder-sértő stringet a fordító legfeljebb 2 kisebb körben újrakéri, tételesen felsorolva a
   kötelező placeholdereket; ami így is bukik, hangosan kiíródik (`⛔ fordítás ELDOBVA`) és hiányként marad.
4. A deploy GATE 5-je akkor is fut, ha a tartomány-diff üres, de az éles `i18n-pack-status` (csak olvas) nem zöld.

**Őr:** `scripts/i18n-retry-check.mts` (mock modell, negatív kontrollal), pre-commit a `packs.ts`/`mail.ts`
változásakor.

**Következmény / nyitott.** A már lefordított 33 névelős kulcsból 31 az új rendereléssel tiszta; kettő
(„Felülírta: {art} {when}-i … mock.”) a régi fordításban birtokos szerkezetté torzult („Overridden by: {art}'s
mockup”) — ezek csak újrafordítással javulnak (csomag-adat, nem kód). Az admin modul-lista kliens-oldali
`data-art` összefűzése (adminViews `art(id)`) ettől független, nem-magyar nyelven ma is magyar névelőt ír.

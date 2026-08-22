# DEPLOY-TÁBLA — melyik szál része van kész, és mi mehet élesre

> **⚠️ 2026-08-22, ADR-0053 óta a fájllistás rész TÖRTÉNELEM.** Élesre VERZIÓ megy
> (`bash scripts/deploy-prod.sh <commit> --go`, a tulaj scope-olt engedélyével), nem fájl-lista —
> az import-closure kérdés szerkezetileg megszűnt (a checkout mindent visz). Az első szinkron
> (`prod/20260822-0916` = `1ca2523`) kivitte az alábbi konfigurátor-szál függő tételeit is,
> a 7 hiányzó migrációval együtt. A fájl TOVÁBBRA IS él arra, hogy egy szál jelezze: a része
> KÉSZ és mainen van-e (mert élesíteni csak olyan commitot szabad, amiben minden szál része ép).

**Miért van ez a fájl.** Egyszerre ~10 párhuzamos worktree-szál dolgozik, mindegyik a maga
darabján. Egy szál önmagában nem tudja megítélni, hogy az ő része élesíthető-e — ide írja be,
hogy KÉSZ és landolva van-e; az élesítés maga verzió-szinten történik (ADR-0053).

---

## Deploy előtt KÖTELEZŐ (mind olvasás, egyik sem mutál)

```bash
SSH="ssh -i ~/.ssh/citoviso_hetzner root@178.104.3.223"

# 1) fa-diff: mennyivel van lemaradva az éles
for f in $(git ls-files src assets public); do md5sum "$f"; done > /tmp/local-tree.txt
$SSH "cd /opt/citoviso/app && for f in \$(find src assets public -type f); do md5sum \$f; done" > /tmp/prod-tree.txt

# 2) migráció-diff (a séma és a kód EGYÜTT mozog)
ls migrations/*.sql | wc -l ; $SSH "ls /opt/citoviso/app/migrations/*.sql | wc -l"

# 3) import-closure: a kivinni kívánt belépési pont tranzitív függőségei megvannak-e élesen
#    (a `from "./…"` gráf bejárása; ha bármi hiányzik → NE fájlonként szemezgess)
```

**Deploy menete:** backup `/opt/citoviso/backups/<szál>-<ts>/` → rsync CSAK a listázott fájlokat →
`chown citoviso:citoviso` → érintett service restart → verifikáció a CF-edge-en, böngészővel,
**390px-en is**.

⚠️ Verifikálni az **untracked `/configure/<artifactId>`** úton, ne a `/p/<token>`-en — különben a
saját hívásaid `mock_view` sorokat írnak a lead-statisztikába.

---

## Szálak

### ✅ KÉSZ — Konfigurátor: nyitott lista, követhető ár, szabad domain (ADR-0051)
*Commitok: `2df930e`, `342f639`, `839f99e` — main-en, pusholva. 2026-08-21.*

- **Állapot:** befejezve, kapuk zöldek (`tsc`, `configurator-price-check` 3 nézetben,
  `configurator-placement-check`, `i18n-lint`, katalógus, `design-token-lint`).
- **Élesen MÁR kint van:** `assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`
  (backup `cfgprice-20260821-202239`, `citoviso-console` restart, edge-en verifikálva).
- **Élesre MÉG KIVIHETŐ, nyugodtan:**
  `src/console/server.ts` · `src/generator/configurator.ts` · `src/domains.ts` · `src/i18n/catalog.json`
  → ezekkel jelenik meg a saját-domain mező + a `GET /configure/:id/domain-check` végpont.
  **Feltétel:** a `server.ts` mai import-gráfja teljes legyen élesen (2026-08-21-én 10 fájl hiányzott:
  `moduleSections`, `kb`, `moduleConfig`, `reviews/*`, `tenant/units|prices|siteModuleConfig`,
  `scraper/sources/portals/photoQuality`) + a migrációk fussanak le.
- **Ha a fentiek nélkül megy ki:** nem tör el semmit — a kliens-oldali blokk magától nem renderel,
  ha a manifest nem hozza a `checkUrl`-t. Restart kell (a runtime-fájl a node-processzben cache-elt).
- **Verifikáció deploy után:** nyisd meg `https://citoviso.com/configure/<artifactId>` telefon-nézetben:
  a tételes lista nyitva, a lábban az összeg, kapcsolásra `±… Ft/hó` jelzés; a domain-résznél a
  „Egyik sem tetszik? Adja meg a sajátját" mező + „Ellenőrzés" gomb.

<!-- Új bejegyzés ide, a legfrissebb felülre. Sablon:
### ✅ KÉSZ — <szál neve> (<ADR>)
*Commitok: … — main-en, pusholva. <dátum>.*
- **Állapot:** …
- **Élesen már kint:** …
- **Élesre kivihető:** <fájlok> — feltétel: <migráció / függőség>
- **Verifikáció deploy után:** …
-->

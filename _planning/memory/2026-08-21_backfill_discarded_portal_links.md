# 2026-08-21 — A backfill megtalálta a portál-oldalakat, aztán eldobta őket

## Kiinduló kérdés (tulaj)

„Miért nem a teljes linkjét mentjük el a portáloldalaknak, ahol megtaláltuk a leadet?
Csak a portál oldal linkje kerül mentésre."

## Amit a mérés mondott — a gyanú premisszája HAMIS volt

A teljes deep-link mindig is tárolódott (`PortalListing.url`, `src/scraper/types.ts:206`),
a Brave-találat `r.link`-je változatlanul (`enrichWebSearch.ts:279`). A konzol a linket
rövid HOST-felirattal mutatja, de a `href` a teljes URL (`console/views.ts:1142`) —
lekért éles lead-oldalon ellenőrizve: minden külső link konkrét aloldalra megy, az
egyetlen gyökér-link a lead saját honlapja (helyesen).

⚠️ Első válaszomban ezt „hazudik a címke" hibaként adtam el és javítást ajánlottam —
tévesen. A rövid felirat + teljes href pontosan a kívánt viselkedés.

## A VALÓDI hiba, ami emiatt előkerült

A prod 419 leadjéből **4**-nek volt portál-linkje (lokálban 202/400). Nem a link
formátuma volt rossz — nem is keletkezett link. Ok:

1. **`reenrich.ts` `changes`-kapu.** A backfill csak honlap/e-mail/telefon változást
   számolt változásnak; a CSAK portál-linket vagy kontakt-napló bejegyzést kapó lead a
   `continue`-nál kiesett, a `raw` sosem íródott vissza. A dúsítás megtalálta a lapokat,
   majd eldobta. Javítva: a listings/contacts bővülés is változás, minden új link kap
   `listing` provenance-sort (szerializált jsonb).

2. **`enrichWebSearch.ts` mailto-regex.** `[^"'?>\s]+` — a saját markupját ESCAPELŐ oldal
   `&quot;&gt;`-tel zár, amiben nincs nyers `"` és `>`, így a match átfutott az escapelt
   farkon: `info@kehidaszallashely.hu&quot;&gt;info(@)…(.)hu&lt;/a&gt;` a lead e-mailjeként
   tárolódott volna. Javítva: `&` is tiltott karakter (a query-paramétert a `?` már vágta).

Éles mérés ugyanazon a 108 leaden: **16 → 98** érintett lead, **0 → 146** elmentett
portál-link. Prod portál-jelenlét: **4 → 61 lead, 10 → 159 link**, 149 `listing`
provenance-sorral.

## ⛔ FŐ TANULSÁG — a dry-run NEM kapu a nem-determinisztikus osztályra

A dry-run **0 honlap-átminősítést** mutatott, ezt hoztam bizonyítéknak („az ADR-0043-as
fals-pozitív osztály nem jött vissza"). Az `--apply` **1-et** csinált:

```
Muschel Panzió: portal_only → has_own (https://muschel-panzio.hotels-in-hungary.net/hu/)
```

A webes keresés futásonként MÁS találatot ad, ezért a dry-run erre az osztályra semmit
nem garantál. Aki dry-runt hoz garanciának, azt mondja meg, MIRE érvényes.

A találat fals pozitív: `hotels-in-hungary.net` white-label portál-aldomain-farm,
ugyanaz a minta, mint a már listázott `hungaryhotel.net` / `com-hotel.website`
(`qualify.ts` PORTAL_DOMAINS), csak ez a domain hiányzik. Következmény: a lead
`qualification=modern` lett → KIESETT a célcsoportból „van saját honlapja" címen,
holott nincs. Ez a §F hitelesség-hiba fordítottja.

## Nyitott (ENGEDÉLYRE VÁR, élesi írás)

1. `hotels-in-hungary.net` felvétele a `PORTAL_DOMAINS`-be (`src/scraper/qualify.ts`).
   A whack-a-mole strukturális fixe továbbra is ADR-0037 (platform-registry).
2. Muschel Panzió visszaállítása `no_site`-ra (célzott UPDATE; a pre-apply dump megvan:
   `/opt/citoviso/backups/reenrich-20260821-223812/lead+provenance.sql`).
3. `citoviso-console.service` restart — a mailto-fix a konzol „újra-dúsítás" gombjához
   (`reenrichOne.ts`) csak újraindítás után él. A CLI-futáshoz nem kellett.

## Módosított fájlok

- `src/scraper/enrichWebSearch.ts` (mailto-regex)
- `src/scraper/reenrich.ts` (changes-kapu + listing provenance + összegzés)

Éles deploy: mindkét fájl scp-vel, backup `/opt/citoviso/backups/deploy-20260821-203120/`.
A push előtti fa-diff tiszta volt (a prod verziói karakterre azonosak a main-nel), új
import egyikben sincs — a `reference_prod_deploy_import_closure` szerinti kötelező
import-gráf/fa-diff ellenőrzés megtörtént.

## Mellékes lelet

`pgrep -f "src/scraper/reenrich.ts"` a SAJÁT parancssorára illeszkedik → „még fut"-ot
mutat befejezett futásra is. Kétszer félrevezetett (lokál + prod). Helyes:
`ps -eo args | grep -v grep`, vagy a log lezáró sorára várni.

# 2026-11-18 — Ország-réteg 3/7: jogi csomag országonként (ADR-0458)

**Session:** `citf0a013ee` (SUB, koordinátor `cit9b4690e3`), brief `~/rc-briefs/orszag-reteg-3g-jogi-csomag-20261118.md`.

## Mi készült
- `src/legalPack.ts` (ÚJ): országcsomag-tár (`src/i18n/babel/legal/<CC>.json`), forrás-egységek gyűjtése a lapok
  renderelésével, `legalPackStatus` (teljesség, dokumentumonként), `translateLegalHtml`, `legalTextForLang`,
  `legalStamp`. Magyar fallback nincs: hiány → `LegalPackGap`.
- `src/legalPackCountry.ts` (ÚJ): a csomag az ország-sor nyelvén (`countryLegalPack`, `countryLegalStatus`).
- `src/legal.ts`: `LEGAL_LOCAL` (BG/FR/IT/ES/HR/PT helyi elemei), outreach/leiratkozó/süti szövegek ide költöztek
  (HU bájtra), impresszum + hiánylista helyi elemekkel.
- `src/markets.ts`: `marketGate` — jóváhagyás ÉS teljes csomag; `isMarketApproved` erre épül.
- Bekötve: saját jogi lapok `?c=`/`?l=` (`legalViews.serveOwnLegalPage`, mindkét szerver), tenant-lapok + sáv
  (`legalPages.ts`, `editor.ts`, `multilangGenerate.ts`), admin „Jogi adatok” helyi mezők, konfigurátor
  (szövegek + `?c=` link + gate a `regionForArtifactOrNull`-ban), rendelés (`orderLegalPack`, bélyeg), próba
  (bélyeg), megkeresés (`prospectNotice`, levél jogi sora, leiratkozó lapok), süti-sáv (patch + jogi csomag).
- Migráció `0141_legal_pack.sql` (additív): `tenant_legal.local_fields`, `order_intent.legal_pack`, `free_trial.legal_pack`.
- Bábel-munkapad: `babel-pack.mts legal-export|legal-import <CC>`.
- Őr: `country-layer-check` ⑪; e2e `scripts/legal-pack-e2e.mts` (58/58); fixtúra `scripts/lib/legal-pack-fixture.mts`;
  a meglévő külföldi e2e-k és a `market-gate-check` a fixtúrával; BG fixtúra-pénznem EUR.
- KB: `kb/entries/admin-legal/entry.hu.md` (a jogi lapok nyelve = az ország nyelve; helyi mezők).

## Nyitott
- Bábel: a hat országcsomag (lásd ADR „Nyitott”); a KB `admin-legal` cikk újrafordítása (a forrás változott).
- A konzol „Piacok — jogi csomag” panelje még nem mutatja a csomag-hiányt (8. lépés).
- money-path-e2e „locale cs-CZ” a tiszta mainen is piros (teszt-fixtúra hiba, nem e kör).

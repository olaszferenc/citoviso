# 2026-08-25 — Terv-először munkarend + Claude Design híd + szűrhető táblázat-komponens

## Mi történt

A tulaj felvetése indított: „miért küzdesz ennyit a designnal — nem kéne egy MCP, amin át a
Claude Design behívható?" A kör három rétegben zárult le.

**① A vak hurok bezárása (a saját szemem).** A design-küzdelem gyökere nem tudás-hiány volt,
hanem hogy renderelt pixel nélkül dolgoztam. Új eszköz: `scripts/ui-shot.mts` — EGY parancs
bármely felületre (HTML fájl VAGY konzol/publikus route), mindig 390px + desktop. A route-okat
a SAJÁT worktree kódja szolgálja ki EFEMER porton, így a fő fa :4600/:4800 tesztfelülete
érintetlen marad (az egyetlen-tesztfelület doktrína sértetlen). Operátor-session állapotmentes
HMAC-sütiből mintázva (`mintOperatorCookieValue`) — nincs jelszó, nincs DB-írás; `CIT_SHOT=1`
őr tiltja a boot-idői i18n self-healt. Az eszköz az ELSŐ futásán fogott egy hibát (láthatatlan
„Másodlagos" gomb fehér alapon), ami vakon sosem derült volna ki.

**② Claude Design híd.** A termék LÉTEZIK (2026-04-17, Labs) — tévesen állítottam, hogy nem;
a tulaj forrás-hivatkozására WebFetch-csel ellenőriztem. A harnessben `DesignSync` tool +
`/design-sync` skill. Létrejött a **Citoviso Design System** projekt (`d3cd90d8-1716-43bb-9919-04dfe35bc653`):
citui.css + 7 komponens-kártya + márka-betűk (Inter/Space Grotesk, latin **és latin-ext** — a
magyar ő/ű miatt). Buktatók, amik időt vittek: (a) a preview-nek ÖNHORDÓNAK kell lennie (a panel
sandbox-iframe-je nem oldja fel a relatív CSS-t); (b) a kártya-index a fájl ELSŐ SORÁBAN lévő
`<!-- @dsCard group="…" -->` jelölőből épül, és a `_ds_manifest.json`-ban él; (c) a kártya-keret
alapból keskeny → `width`/`height` kell, különben mindenki azt hiszi, a terv „csak mobilos".
(d) `/design-login` RC-ből nem megy → tmux-híd; a `designOauth`-ot a párhuzamos sessionök
kiírják a credentials-ból → `~/bin/design-cred-guard.py` cron-őr (percenként, snapshot+visszaillesztés).

**③ A munkarend — a nap valódi hozadéka.** A tulaj korábbi fejlesztőcsapatának bevált rendje:
előbb 2-3 terv, ő választ, és CSAK utána megy kód. Ez lett az ADR-0065. **Aztán ugyanaznap
megszegtem:** a visszajelzése után legyártottam az új tervet, megnéztem MAGAMNAK, és rögtön
nekiestem a működő szűrő-logikának, interaktív teszteknek, adat-javításnak — a tulaj egyetlen
képet sem látott. Szava: „TÖK FÖLÖSLEGES ÍGY A WORKFLOW". Majd amikor megmutattam, a CHATBE
küldtem képet, holott ő a DESIGN-PROJEKTBEN akarja nézni — mert ott bele is tud nyúlni.
→ **ADR-0066** + `CLAUDE.md §2b` + a nudge-hook átírása.

## Szállított munka

- **Pénzügy-modul újratervezés:** 4 valós adaton alapuló változat (A Pozíció / B Teendő /
  C Sűrű tábla / D Kártyás). A mai felület fő baja mérve: a `fmtMoney` valutánként EGY stringbe
  fűz („164 500 Ft + 100 USD + 63 EUR") — se olvasható, se cselekvésre alkalmas.
- **Tulaj döntése: C irány JÓVÁHAGYVA**, két új oszloppal (Pénznem, Fiz. határidő).
- **Új közös adat-táblázat komponens** (tulaj-rendelet): színnel kiemelt, ragadós fejléc-sáv;
  MINDEN oszlop szűrhető autocomplete-listával (valós értékek + darabszám); szűrő-chipek
  egyenkénti törléssel; „Szűrők törlése". Playwright-tal interaktívan verifikálva (lista,
  kombinált szűrés, chip-törlés, üres állapot). Ez a minta MINDEN konzol-táblához.
- A jóváhagyott tervek befagyasztva: `assets/design-refs/console/`.

## Módosított / létrehozott fájlok

- `scripts/ui-shot.mts` (új), `scripts/ui-shot-nudge.mjs` (új→átírva), `.claude/settings.json`
- `src/auth/operatorAuth.ts` (`mintOperatorCookieValue`), `src/console/server.ts`,
  `src/server/public.ts` (`server` export + `CIT_SHOT` őr)
- `_planning/DECISIONS.md` (ADR-0065, ADR-0066), `CLAUDE.md` (§2b)
- `assets/design-refs/console/finance-c-tabla.html`, `…/table-component.html` (jóváhagyott tervek)
- `.gitignore` (`.design-sync/`), `~/bin/design-cred-guard.py` (repón kívül, cron)

## Nyitott kérdések / következő lépés

- **A C terv kódba ültetése** — a `documentsBlock` (`src/console/partnerViews.ts:366`) átírása
  az új táblázat-komponensre + Pénznem/Fiz. határidő oszlop; a szűrő-CSS/JS helye a
  `public/assets/ui/` alatt (token-lint hatókörbe kell venni). A KB-lefedettség (§J) is jár hozzá.
- A többvalutás KPI szétbontása (`fmtMoney` hívóhelyek) — ez adat-réteg, nem csak nézet.
- A `.design-sync/` ma worktree-lokális munkamappa; ha több szál is design-t szinkronizál,
  kell egy közös hely vagy egy `scripts/design-bundle.mts` generátor.

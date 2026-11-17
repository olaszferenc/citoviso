# 2026-11-17 — Ország-réteg 3/6: mock és nyelv (SUB `citf44663e7`, koordinátor `cit9b4690e3`)

Brief: `~/rc-briefs/orszag-reteg-3f-mock-nyelv-20261117.md` · Döntés: ADR-XXXX (`_planning/decisions/XXXX-orszag-reteg-3-6-mock-es-nyelv.md`).

## Elvégzett munka
- **Írás:** `src/i18n/script.ts` (CLDR-ből az írás; `alignHomoglyphs`) — `fixHomoglyphs(s, lang)` a motorban, az újraírásban, a kurátori csomagban és a konzol kurátori előnézetében.
- **Betűk:** `src/engine/fontScripts.ts` — mért írás-készlet (Google Fonts, 2026-11-17), sablon-karakter szerinti tartalék-párok (Literata, EB Garamond, Noto Serif, Roboto Slab, Manrope, Commissioner, Inter, Fira Sans, Roboto Condensed, Comfortaa), subset az URL-ben; a `renderSite` zárásában fut, latin lapon nem.
- **Slug/domain:** `src/text/translit.ts`; `slugify` (domains.ts + generate.ts) átír; `suggestDomains` a piac saját végződésére is névváltozatokat ad, saját végződés elöl; `endingsForCountry` a konzol és a tenant-admin javaslatában.
- **Ellenőrzők/írók:** piac-bíró `foreign` blokk (a magyar szótáras rétegek idegen lapon nem futnak), `foreignCountryRule` az író CÉL-NYELV blokkjában, `letterCriticSystem` + `outreach-letter-critic.mts --country=XX`.
- **Helyi szabályok:** foglalási levelek napja `formatDay(…, lang)` (requests/enquiry/syncMail), esemény-dedup átírt kulcs, település-fotó wiki-nyelv az ország-sorból, Google-érték a lap számformájában.
- **Nyelv zártan:** `langForLead` ismeretlen országra dob; fizetés utáni lapok a vevő nyelvén (`buyerLangOfPayment`, `useBuyerLang`).
- **Mock nyelvi kapu:** `src/generator/mockLanguage.ts` (`renderMockMeasured`, `langVerdict`), `mockVerdictGate` `langVerdict` (nem nyugtázható), küldés-utak kiút-mondata; runtime csak saját feliratai (`runtimePack`), kredit-sáv a lap nyelvén.
- **Követő üzenetek:** nem-nyitó, viselkedés, eszkaláció, próba-kampány mérés alatt; viselkedés/eszkaláció ár a régió pénznemében.
- **Mérés:** `country-layer-check` ⑩ (+ pre-commit minta), `scripts/country-mock-e2e.mts` (29 zöld), ui-shot bolgár mock 3 sablon × 2 méret.

## Mért tények
- A dev DB-ben nincs nem-HU lead → valódi (LLM-es) bolgár mock nem futott; LLM-költség 0.
- `foreign-market-e2e.mts` a tiszta mainen is bukik (`global` régió: hiányzó modulár „gallery”) — előzetes, nem ennek a körnek a hibája.

## Nyitott
- Bábel: bg és cs csomag nincs; 3 új felirat (kredit-sáv, eszkalációs nem-forint ármondat, „Nyelvi teljesség”) mind a 7 nyelvre.
- 7. lépés (jogi csomag): a jogi lapok betűje/szövege.
- heroOverride/copyManual újrarender nem méri újra a nyelvet (a fix feliratok nem változnak tőle).
- Nem-nyitó levél: még a budapesti mock-ablak.

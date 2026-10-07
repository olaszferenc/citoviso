# 2026-10-07 — Csomag-kártyák: kedvezményes ár alapból + „első díj” jelölés

**Kérés (tulaj, brief):** az „Itt rendelheti meg” gombbal feljövő tarifacsomagok a kedvezményes árat
mutassák alapból, ne csak lent az összefoglalásnál. Utána: „igen kérek” a kártyán az „első díj” jelölésre.

**Elvégezve.**
- `syncPresetPrices()` (`assets/runtime/cit-configurator.js`): ajánlatnál fölül áthúzott listaár, alatta a
  fizetendő `offerPrice()` + egység, alatta kis „első díj” (`.cit-cfg-preset__first`, az összesítő
  ajánlat-sorának színe) — az egyszeri kedvezmény (ADR-0088) ne olvassa tartós árnak a vevő.
  Ajánlat nélkül változatlan. Ugyanaz a pár, mint a futó összegben (order-step1-offer ①).
- Kapu `scripts/checkout-item-block-check.mts` ⑨: minden kártya áthúzott + kedvezményes ár, „első díj”,
  az aktív kártya fizetendője = a futó összeg; ajánlat nélkül egyik sem. Két új önteszt-visszarontás
  (`kartya-listaar-kedvezmeny-nelkul`, `kartya-elso-dij-nelkul`), a `kartya-mindig-havi` az új sorra igazítva.
- `src/i18n/catalog.json`: „első díj”.

**Élesítés.** `5f90186a` = `prod/20261007-1242`; `bf149e6c` = `prod/20261007-1529` — vele (tulaj
jóváhagyásával) a `bdcfa0f9` i18n-javítás + 0092_translation_spend migráció; mentés
`/opt/citoviso/backups/db-pre-20261007-152854.sql.gz`. Hibanapló tiszta, a konfigurátor kérésenként
injektálódik → rerender nem kellett.

**Tanulság.** A `land.sh` törli a `_drafts/`-ot — az ott tartott képgyártó szkript is elveszik; tartsd a
scratchpadben abszolút importokkal. Első commitnál a `prospect-owned` kapu a tiszta mainen is piros volt
(48 párhuzamos park-író); újrapróbára zöld.

**Nyitott:** nincs.

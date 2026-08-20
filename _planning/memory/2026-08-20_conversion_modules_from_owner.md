# 2026-08-20 — Konverzió: a modulokat a TULAJ választja, nem az operátor

## Kiváltó (tulaj)

> „Mock Artefaktum részt és funkciót nem értem… nem értem és feleslegesnek tűnik. Azt mondtuk,
> hogy mindent megmutatunk alapból és a tenant testreszab. […] Tenant megnyitja a kapott
> megkeresésen a linket, utána meglátja a WOW ALL-IN oldalt, aztán testreszabja mit kér vagy
> nem kér?”

Igaza volt: valódi ellentmondás, nem félreértés.

## A lelet — két üzleti modell keveredett egy felületen

A lead-nézet „Mock-artefaktumok" szekciója a kurátori jóváhagyás UI-ja (generated → approve/reject
→ konvertálás privát előnézetbe). A **konverziós lépésben** volt egy operátori **„Megrendelt
modulok" checkbox-lista** (`convertForm`), amiből az operátor kézzel válogatta a `module_entitlement`-et.

Ez ütközött a kimondott elvvel (`mock=live` + ALL-IN + tulaj testreszab):

| réteg | ki dönt a modulokról | tábla |
|---|---|---|
| prospect-konfigurátor (`/p/:token`, `cit-configurator.js`) | **a tulaj** — ALL-IN nyit, ő vág le | `order_intent.modules` |
| ~~konverziós `convertForm` (operátor)~~ | ~~operátor~~ → **TÖRÖLVE** | `module_entitlement` |

A két modul-döntés párhuzamos volt; az operátori réteg felülírhatta a tulaj választását → felesleges
és félrevezető. A tulaj a hideg-megkeresés linkjén már mindent lát és maga szab testre.

## A fix (egyetlen forrás)

- Új közös segéd: **`modulesForConversion(orders)`** (`src/modules.ts`) — a tulaj legfrissebb
  `submitted` order-e, vagy **ALL-IN** (teljes katalógus) fallback, ha még nem konfigurált.
- `convertForm` (`src/console/views.ts`): checkbox helyett **read-only** megjelenítés
  („A tulaj a konfigurátorban ezeket kérte" / „…még nem konfigurált — teljes ALL-IN oldallal").
- Convert handler (`src/console/server.ts`): `form.getAll("module")` helyett
  `modulesForConversion(await getOrderIntents(id))`. Az operátor csak **jóváhagy → konvertál**.

## Élesítés

Commit `582e12f` → `origin/main`. Prod (`admin.citoviso.com`, Hetzner `citoviso-app-1`) **nincs git
alatt** — a deploy fájl-másolásos (scp `/opt/citoviso/app`), a service `npx tsx src/console/server.ts`
(nincs build-lépés), `systemctl restart citoviso-console.service`. Diff-before-deploy: a prod pontosan
a lokál HEAD-en állt (nincs prod-only hotfix). Smoke: service active, log tiszta, `:4600/leads` → 303.
`.bak-predeploy` rollback-pont a 3 fájlról a prodon.

## Tanulság

- A „mindent megmutatunk alapból + tulaj testreszab" elvet EGY forrás kényszerítse ki
  (`order_intent`), ne legyen operátori duplikátum-döntés a konverzión.
- Horgony: [[invariant_no_bait_and_switch_delivery]] (mock=live), ADR-0015 (modult csak láthatóan),
  ADR-0021 (prospect-konfigurátor a konverzió szíve).

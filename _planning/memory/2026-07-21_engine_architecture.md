# 2026-07-21 (este) — Barion sandbox-kör LEZÁRVA + a generáló motor architektúrája (ADR-0016)

## Barion sandbox teljes kör — LEZÁRVA ✅
A memória egyetlen függő szála (Barion sandbox POSKey + teszt-kör) kipipálva.
- A tulaj a `test.barion.com` sandboxban létrehozott + „open"-re submittelt egy shopot (Citoviso, Starter Fix
  1.49%). **Draft-shoppal a `Payment/Start` `ShopIsInDraftState`-et ad** — a shopot submittelni kell (a To-do
  lista/pénzfeltöltés sandboxban NEM kell, auto-approve). Az approval a `secure.test.barion.com`-ról a
  `api.test.barion.com`-ra **~2,5 perc alatt propagál** (nem azonnal).
- POSKey: `7f43a213-…` (draft állapotban is látszik a Shop details-nél). `.env`: `PAYMENT_GATEWAY=barion`,
  `BARION_URL=https://api.test.barion.com`, `BARION_PAY_URL=https://secure.test.barion.com`, `BARION_POSKEY`,
  `BARION_PAYEE=olaszferenc@gmail.com`, `PUBLIC_BASE_URL=http://100.97.188.105:4600`.
- **Teljes valós kör végigment:** valós teszt-kártyás (`4444 8888 8888 5559`) fizetés → `GetPaymentState`
  Succeeded → payment PAID (4880 Ft) → site LIVE → lead activation → **valós AAM teszt-számla `OV-2026-2`**
  (Számlázz teszt-fiók). A pay-link lejár (~perc) → `Expired`; új linkhez a régi `pending`-et le kell zárni.
- **Eszközök (commitolva):** `scripts/barion-smoke.ts` (adapter-smoke, DB nélkül), `scripts/barion-pilot.ts`
  (`email|start|status|fresh|confirm` módok — a callback nem ér célt Tailscale-en, ezért kézi `confirm` =
  handleWebhook közvetlen hívása), `scripts/pilot-inspect.ts` (order_intent buyer-adat).
- ⚠️ A `.env`-ben `PAYMENT_GATEWAY=barion` MARADT; `INVOICE_PROVIDER` visszaállítva `mock`-ra (véletlen valós
  teszt-számla ellen). Vissza gyors mock-fizetéshez: `PAYMENT_GATEWAY=mock`.

## A generáló motor architektúrája — ADR-0016 (a tulajjal közösen döntve)
Kiváltó: a tenant-admin szerkeszthetőség igénye feltárta, hogy a jelenlegi motor egyedi AI-HTML-t ad, a
`convertLead` pedig ezt a monolitikus HTML-t MÁSOLJA live-ba → nem szerkeszthető, nem `mock=live`.

**Döntés (részletek: `_planning/DECISIONS.md` ADR-0016 + auto-memory `project_composition_engine`):**
- KOMPOZÍCIÓS MOTOR + RECEPT-absztrakció. `adat → [AI-tervező] → recept → determinisztikus render(recept+adat+skin) → HTML`.
- `mock=live` GARANTÁLT (ugyanaz a motor+recept, más adat). Az LLM: HTML-író → kompozíció-tervező.
- **Réteg-számláló (a tulaj tisztázása):** 1 BACKEND (fix) + 1 közös MODUL/PRIMITÍV-készlet (token-témázott,
  NEM archetípusonként újra!) + N ARCHETÍPUS (= elrendezés-séma, a „frontend ami változik") + M SKIN (ráhúzható).
  Sokszínűség = archetípus × skin × modul-kompozíció (kombinatorika, nem darabszám).
- **WP KIZÁRVA** (indoklás az ADR-ben). Control/data plane: házon belül a motor+pipeline; a tenant CSAK a
  publikus site-ot (motor kimenete) + a tenant admint kapja; a motor SOHA nem települ a tenanthoz.

## Épített bizonyíték — `src/engine/` (additív, a régi pipeline érintetlen)
- `recipe.ts` (Recipe + SiteData típusok), `skins.ts` (2 skin, `--cit-*` tokenek), `primitives.ts` (4 determinisztikus
  primitív + közös CSS), `render.ts` (determinisztikus render), `planner.ts` (AI-tervező: LLM javasol, `enforce()`
  garantálja a gerinc + adat-kapuzás invariánsokat; `claude-opus-4-8`, json_schema output, null-fallback).
- `scripts/engine-prove.ts`: **mock=live skeleton-egyezés gépileg AZONOS ✅** (demó vs. GRANDIS adat, azonos váz).
- `scripts/engine-plan.ts`: valós Claude-tervező — GRANDIS(prémium)→`immersive-dark`, Nefelejcs(családias)→
  `editorial-warm`, GRANDIS-fotó-nélkül→gallery kimarad. Kimenet: `sites/_engine-proof/*.html` (gitignore-olt).

## Nyitott / következő
1. **Archetípus-réteg** (elrendezés-nyelvtanok: rács/scroll/split) — a jelenlegi szelet csak fix lineáris elrendezés.
2. **lead→SiteData mapping** (a planner valós DB-leadből fusson, ne kézi teszt-adaton).
3. **`convertLead` átkötése a motorra** (a mock-HTML-másolás kiváltása — ADR-0016 következménye).
4. **Készlet-bővítés** (több primitív/skin/archetípus → valódi több-száz-dimenzió).
5. **Tenant admin recept-szerkesztő** (a tulaj a receptet+adatot szerkeszti — az eredeti kiváltó igény).

## Módosított/létrehozott fájlok
- `_planning/DECISIONS.md` (ADR-0016) · `src/engine/{recipe,skins,primitives,render,planner}.ts`
- `scripts/{barion-smoke,barion-pilot,pilot-inspect,engine-prove,engine-plan}.ts`
- `.env` (Barion blokk — NEM commitolva) · `sites/_engine-proof/` (generált — gitignore)

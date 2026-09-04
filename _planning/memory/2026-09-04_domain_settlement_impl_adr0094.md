# 2026-09-04 — ADR-0094 ② elszámolás-képernyő IMPLEMENTÁLVA (a jóváhagyott B kontraktus)

## Mi történt

A 2026-09-03-i session jóváhagyott B tervének (kontraktus:
`assets/design-refs/console/domain-settlement/README.md`, surface-gate: approved)
teljes megvalósítása. A kapu approve-tokenje a kontraktusban rögzített tulaj-döntés
alapján lett kiváltva; a kész felület a befagyott tervhez lett mérve (ui-shot,
mindkét méret, Read-del megnézve).

### Szállítva

1. **Motor** — `src/domains/domainSettlement.ts` (ÚJ):
   - `settlementQuote()` — EGY olvasó eteti a GET-lapot, a POST-ordert és a
     teszteket (a tenant sosem fizethet mást, mint amit látott). Kötbér-alap:
     `floorMonthly ?? computeMonthly(renewableModuleIds)` (ADR-0094 ④ — a
     fizetős-domain ág, az adathiányos ág, tesztelve, nem vak).
   - `createSettlementOrder()` — kind=`domain_settlement` order a 0029
     vevő-öröklés mintával, fail-closed; a kifizetetlen előzményt felülírja
     (abandoned + cancelled payment), a KIFIZETETT mellett megtagadja.
   - `openSettlement()` / `voidUnpaidSettlement()`.
   - `activeDomainCommitment()` bővítve: `orderId` + `domainName`.
   - Migráció **0050**: kind-CHECK + tenant-CHECK bővítés + `settlement_take_domain`.
2. **Felület** (B kontraktus szerint) — `domainSettlementSection` az
   adminViews-ban + `.adm-settle__*` a `citui-admin.css`-ben (tokenekből):
   hűség-sáv mérővel, tételes számla, webcím-pipa (sor+végösszeg+gombfelirat+
   következmény EGYÜTT vált, `<label>`+change — nincs dupla-váltás), piros gomb
   élő összeggel, „Mégsem" ír-semmit link, záró képernyő DB-igazságból (ÁSZF §9
   mondattal). Danger-zóna elágazás: futó hűségnél a lemondás-gomb IDE visz;
   kifizetett elszámolásnál a resume-gomb helyett „írjon nekünk".
3. **Fizetési út** — POST: order → pay-link (`requestPayment`) → cancel élesítés →
   az ígért e-mail (`buildDomainSettlementEmail`, a dunning `billingEmails`
   listájára, `tenant_message` naplóval). Fail-closed: pay-link hiba → void, semmi
   nem marad. Webhook `domain_settlement` ág: számláz (tételnév: „lemondás-
   elszámolás"), NEM aktivál újra. **Route-őrök:** kézi cancel-POST futó hűségnél
   a settlement-lapra terel; resume a kifizetetlen elszámolást törli, a
   kifizetett mellett nem enged vissza.
4. **KB** — `admin-settlement` entry (anchor `admin.settlement`, helpLink a lap
   fejlécén) + kb-shot settlement-fixture (a terv-mock számaival) + az
   `admin-subscription` lemondás-szakasza hűség-feltétellel pontosítva.
   tudasbazis-or: első kör FLAG (3 jogos lelet: kötbér-alap kétágúsága,
   admin-subscription elavulás, hiányzó screenshot) → javítva → **PASS**.
5. **Külön kör:** `config.chromiumPath` halott alapérték (más user cache-e,
   eltűnt 1228-as pin) → futásidejű detektálás a SAJÁT `~/.cache/ms-playwright`
   legújabb LÉTEZŐ Chromiumára; `CHROMIUM_PATH` továbbra is felülír.

### Mérve

- `domain-provision-check`: MIND ZÖLD (+15 settlement-teszt: kötbér-számítás,
  0029 fail-closed, felülírás, void, paid-refuse, padló-nélküli ág, route-őr
  szerkezeti ikrek).
- Böngészős működés-teszt (Playwright, mock e-mail): pipa-átváltás 56→76→56 ezer,
  JS-hiba 0, POST-kör (order+pay-link+armed+üzenet-napló), záró képernyő, resume-
  void, cancel-bypass-terelés — MIND ZÖLD.
- kb-check --coverage 🟢 30/30, i18n-lint ✅, design-token-lint ✅, tsc ✅.

## Tanulságok

- ⛔ **NUL-bájt a forrásban = néma vakság:** egy JS-placeholderbe nyers U+0000
  került → a grep az egész fájlt binárisnak látta és ÜRES találatot adott hiba
  nélkül. Ha a grep hallgat, de a sed lát, ellenőrizz NUL-ra (`file` mondja).
- A kb-scan hook szerkesztésenként blokkol, amíg a horgonyhoz nincs entry — a
  KB-írást ELŐRE kell hozni, nem a végére.
- Az anchor a view-ban PONTOZOTT (`admin.settlement`), az entry-mappa kötőjeles.

## Dev-fixture (szándékosan BENT hagyva a lokál teszthez)

A `Nyugalom Vendégház` dev-tenant alatt: kifizetett `domain_upgrade` order
(`nyugalomvendeghaz.hu`, 12 hó, 8000 padló, 5 hónapja indult) + `subscription`
sor (fordulónap ~2026-09-22) + approved mock_artifact + egy `abandoned`
settlement-order nyom (a teszt-kör mellékterméke). ⚠️ A napi billing-timer
~2026-09-19-én T−3 előértesítőt küld az `info@nyugalom.example` címre —
`.example` domain, nem kézbesíthető, ártalmatlan, de a logban látszik.
⚠️ A fő fa :4800-án a settlement-route csak azután él, hogy a fő fán `git pull`
történt a land után.

## Nyitott

- Élesítés NEM történt (§0.3) — a 0050 migráció csak lokál.
- Barion-úton (sandbox) a settlement-fizetés vég-kör a tulaj teszt-körében.
- INWX valós integráció változatlanul az első éles domain-rendeléskor (ADR-0024).

## Módosított fájlok

migrations/0050_domain_settlement.sql (ÚJ) · src/domains/{domainSettlement.ts(ÚJ),
domainCommitment.ts} · src/db/schema.ts · src/payment/{service,billing}.ts ·
src/email/domainEmail.ts · src/server/{public,adminViews}.ts ·
public/assets/ui/citui-admin.css · kb/entries/{admin-settlement(ÚJ),
admin-subscription} · scripts/{domain-provision-check,kb-shot}.mts ·
src/i18n/catalog.json · src/config.ts (külön commit)

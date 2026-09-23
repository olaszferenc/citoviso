## ADR-0072 — Az élő tenant modul-készlete = amit KIFIZETETT (a kiegyenlítés a pénz-úton dől el)

- **Dátum:** 2026-08-26 · **Státusz:** ELFOGADVA, implementálva lokálban · **Kapcsolódó:** ADR-0014
  (provisioning ≠ élesítés), ADR-0033/0034 (modul-upsell fizetési kapu), ADR-0063 (multilang).
- **Kiváltó (tulaj, szó szerint):** *„Javítsd már ki, légyszi, azt, hogy azt kapja a tenant
  modulként, amiért már fizetett."*

**A rés — MÉRVE, nem feltételezve (2026-08-26, dev DB, 7 tenant):**

| tenant | site | fizetett | aktív | nem fizetett többlet |
|---|---|---|---|---|
| Villa Suzy Zamárdi | live | 3 (4 880 Ft) | 13 | **10** |
| Nyugalom Vendégház | live | **0 rendelés** | 12 | **12** |
| Aszfalt panzió | live | 13 (10 380 Ft) | 14 | **1** (`multilang`, 14 900 Ft, 0 fizetési rekord) |
| Rózsakert Panzió | live | 14 | 14 | 0 ✅ |

**A mechanizmus nem kiskapu volt, hanem ADDITÍV ÍRÁS.** A `convertLead`
(`src/conversion/provision.ts:215`) és az `activateUpsell` (`src/tenant/moduleUpsell.ts:156`)
egyaránt `onConflict … doUpdateSet({ active: true })`-tal ír: **csak bekapcsol, sosem kapcsol ki.**
Az operátor fizetés ELŐTTI ALL-IN előnézete (a `modulesForConversion` a teljes előfizetéses
katalógusra esik vissza, ha még nincs rendelés) ezért **TÚLÉLTE** az utána futó fizetett aktiválást:
Villa Suzynál 13:40-kor 13 entitlement született, 13:57-kor a fizetett order 3 modult adott át — a
maradék 10 egyszerűen ottmaradt. Egyik kapu sem hazudott: nem volt kapu.

**Döntés.**
1. **Új invariáns:** egy tenant aktív modul-entitlementje = a **kifizetett rendeléseinek uniója**
   (induló checkout + upsell + egyszeri), amint a site élesedik vagy már élő.
2. **A `provisioned` (privát előnézet) KIVÉTEL, szándékosan.** Az ADR-0014 kimondja, hogy a
   provisioning fizetés előtt is futhat, és az az előnézet MAGA a konverziós horog — kiegyenlítve
   üres oldalt kínálnánk megvételre. A kiegyenlítés oda tartozik, ahol pénz mozdul.
3. **Egy igazságforrás:** `src/tenant/paidEntitlements.ts` — `paidModuleIds()` +
   `syncEntitlementsToPaid()` (idempotens; az újraküldött webhook no-op).
4. **Két hívóhely, mindkettő a pénz-úton** (`src/payment/service.ts`): az induló aktiválásnál és az
   upsellnél. ⚠️ Az indulónál **a LIVE render ELŐTT** — a `moduleContentFor()` a jogosultságokból
   renderel, tehát utána egyenlítve a nem fizetett modul már kikerült volna a publikus oldalra.

**Amit a javítás NEM tesz.** Nem nyúl a meglévő sorokhoz. A három driftelt élő tenant a **következő
fizetéskor** rendeződik; a visszamenőleges javítás fizető ügyfelek adata, tehát tulajdonosi döntés.

**Őr:** `scripts/entitlement-paid-check.mts` (pre-commit, a pénz-út fájljaira szűrve). Három rétegű,
mert a helyes helper értéktelen, ha a route nem hívja: **viselkedés** (scratch DB-n újraépítve a
Villa Suzy-alakzat), **hívás-alak** (mindkét út hív + a sorrend a render előtt), **hatókör** (a
`provision.ts` NEM hívhatja). **Pirosra futtatva 4 rontással:** (a) a prospect→lead ág elvágása —
ez a legveszélyesebb hibamód, a fizető vevő megfosztása mindentől; (b) sync törlése az
`activate()`-ből; (c) a sync a render UTÁNRA mozgatva; mind piros. Plusz élő drift-jelentés a dev
DB-re, ami **függetlenül, SQL-ből** reprodukálta ugyanazt a három tenantet.

**Visszafordíthatóság:** 🔄 additív (új modul + két hívás + őr); a kikapcsolt entitlement sor
megmarad `active=false`-ként, nem törlődik.

**Nyitott.** ① A három driftelt tenant visszamenőleges rendezése (tulaj-döntés). ② Az `Aszfalt
panzió` `multilang`-ja **fizetési rekord nélkül** aktiválódott — a generálási út
(`multilangGenerate.ts:243`) a `markMultilangPaid`-en át fizetés-kapuzott, tehát valami megkerülte;
külön kivizsgálandó. ③ A `Nyugalom Vendégház` **rendelés nélkül** élesedett — az élesítésnek is
kapunak kellene lennie, nem csak a modul-készletnek.

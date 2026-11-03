## ADR-0414 — Rendszer-számlák a Bizonylatokban (tükör) + riasztás minden sikeres fizetésről

**Dátum:** 2026-11-03 · **Státusz:** elfogadva (lokál, nem élesítve) · Kiegészíti: ADR-0031 (bizonylat-mag), ADR-0098 (ÁAM-plafon), ADR-0276/0374/0376 (ház-riasztás, SMS, csendes óra), ADR-0283 (számla egyszer)

### Kontextus

Élesen mérve 2026-11-03: megjött az **első valódi fizető vevő** (Duna Vibe House, Rebeka Szego, CITO-2026-7,
`dunavibehouse.hu` dns_pending). A rendszerben minden lefutott — de a tulaj a konzolon **semmit** nem látott
belőle, és **semmilyen értesítést** nem kapott:

- A konzol Bizonylatok-listája, CSV-je, nav-számlálója, a partner-adatlap és az idővonal kizárólag az
  `accounting_document` táblát olvassa (élesen 0 sor). A fizetés-út a régi `invoice` táblába ír (a 0031 ott
  hagyta). A három éles rendszer-számla (CITO-2026-5/6/7) sehol nem jelent meg. Élesen `legal_entity` sincs.
- Riasztás csak hibára volt (megrekedt rendelés, sikertelen számla, webhook-hiba, próba-őr); siker néma.

**Tulaj-döntés (2026-11-03):** mindkettő kell.

### Döntés

**A) Tükör, nem UNION.** Minden `invoice` sor egy `source='system'` sort kap az `accounting_document`-ben
(`invoice_id` kulccsal, egyedi index → idempotens). Indok: a bizonylat-olvasó **sok** (lista + KPI-sáv + korosítás
+ fizetési szokás + CSV + partner-lista összegei + partner-KPI + idővonal + nav + pénzügyi hub); UNION-nál mindegyikbe
be kellene húzni a második forrást, és egy kimaradna. A tükörrel mind magától látja. Az ÁAM-plafon (`getAamYearNet`)
a `source='system'` sorokat már eleve kizárta erre a tükörre készülve; a devizás számláló is kizárja (javítva) —
**nincs dupla számolás**, a plafon továbbra is az `invoice` táblából számol.

- `issued` → élő (`active`) kimenő számla, fizetve; a PDF az `invoice.pdf_base64`-ből töltődik le (nem másoljuk).
- `storno` → listázva, „sztornózva” jelöléssel, `draft` állapotban: **nem pénz** (a pénz-összegzések a
  `draft`-ot kihagyják, a darabszám látja).
- `failed` → fizetésenként legfeljebb EGY látható sor: a legutolsó kísérlet, szám nélkül, „számla nem készült”
  jelöléssel, amíg nincs kiállított számla; kiállítás után a sikertelen tükör `void` (rejtett).
- A partner a vevő `partner` sora (a tenanton át). A jogi entitás a `MAIN` kódú; ha nincs, a `LEGAL_ENTITY_*`
  konfigból jön létre (ugyanaz, amit a konzol „egy kattintásos” gombja tenne).
- Az élő út minden számla-kísérlet után tükröz (`issueInvoiceFor`, a zár alatt); a hiba nem buktatja a fizetést,
  hangosan naplóz. A meglévőkre: `scripts/invoice-mirror-backfill.mts --go` (idempotens) — **élesítéskor futtatni kell.**
- A lista szűrhető forrásra (rendszer-számla / kézi-importált), a CSV „Forrás” oszlopot kapott.

**B) Riasztás minden sikeres fizetésről** (`src/console/paymentAlert.ts`). Az `issueInvoiceFor` „payment”
triggerén (minden pénzmozgásos ág ide fut: webhook, zárolás-lehívás, token-terhelés) EGY levél + EGY SMS a
meglévő ház-riasztás csatornán (`alertHouse` → `alert_email`/`alert_phone`; az SMS csak éles hoston, csendes órában
a reggeli összesítőbe vár). Tartalom: oldal + vevő, fizetés típusa, összeg, időszak, számlaszám (vagy hogy NEM
készült el és miért), kért domain + állapota, konzol lead- és partner-link. Az első rendelés: **„ÚJ VEVŐ”**.
- **Egyszer:** a `payment_alert` sor a zár — aki beszúrja, az küld; az ismételt callback itt akad meg.
  A számla-újrapróba (auto-retry / konzol) nem új fizetés: néma.
- **Megújítás napi összesítőben:** minden előfizető havonta megújul; N vevőnél ez N SMS havonta, csomókban a
  fordulónapokon — rutin-pénz, amivel a tulajnak nincs teendője. Ezért a megújítások egy levélben + egy SMS-ben
  mennek naponta, 18:00 (Budapest) után, az óránkénti tickből (`offer-followup.mts`). A 18:00 utáni megújítás a
  másnapiba kerül. A megújítás **sikertelen** számlájáról a meglévő számla-hiba riasztás azonnal szól.

### Elvetett alternatíva

- UNION a lekérdezésekben: kevesebb írás, de 8+ olvasó-helyet kellene módosítani, és a következő új olvasó
  megint vak lenne.
- A PDF bemásolása a bizonylat-tárba: dupla tárolás, a Számlázz.hu a forrás; a letöltő-út a DB-ből szolgál.
- Megújításonként azonnali riasztás: a vevőszámmal arányos SMS-zaj.

**Visszafordíthatóság:** 🔄 — a tükörsorok `source='system'`-mel törölhetők, a riasztás egy hívás.

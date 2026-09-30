## ADR-0283 — A bukott számla riaszt és újrakibocsátható (2026-09-30)

**Dátum:** 2026-09-30 · **Státusz:** elfogadva (deploy-készenléti SUB, koordinátor: „Deploy-koordinátor”;
brief: `~/rc-briefs/invoice-failure-retry.md`) · **Kapcsolódó:** ADR-0276 (a ház riasztási csatornája,
`alertHouse`), ADR-0129 és `feedback_gate_must_not_refuse_the_paying_customer` (a fizető vevő nem maradhat
a mi oldalunk állapota miatt a megvett dolog nélkül), 0007 (az `invoice` tábla: egy sor kísérletenként,
legfeljebb egy `issued` fizetésenként).

**Kontextus — mérve élesen 2026-09-30 07:32 UTC.** A 100 Ft-os éles próbavásárlás (`payment`
`acadc176…`, 97 HUF, paid) átment, a számla viszont elbukott: `invoice` `d1f07194…` status=failed,
„Számlázz error 378: A bizonylat kibocsátáshoz össze kell kötnöd fiókodat a NAV Online Számla
rendszerével.” Ez a Számlázz-fiók beállítása (a tulaj intézi), de a KÓD-hiba a miénk volt: az
`issueInvoiceFor` a bukásnál egy `failed` sort + `console.error`-t hagyott — **riasztás, újrapróba és
kézi újrakibocsátás nem volt**. A vevő fizetett, számlát nem kapott, a ház nem tudott róla, és ha a
fiókot rendbe tesszük, ezt a számlát SEMMI nem adja ki utólag.

**Döntés.**
1. **Riasztás a meglévő csatornán** (ADR-0276, `alertInvoiceFailure` a `houseAlert.ts`-ben): payment id +
   a vevő-oldali `CIT-…` hivatkozás, összeg, vevő, a számlázó hibaszövege, a konzol-link, a teendő. Az
   ELSŐ bukás és az automatikus keret KIMERÜLÉSE riaszt (egyszer, azon a kísérleten, amelyik elfogyasztja —
   akár a napi tick, akár egy kézi újrakiadás volt az), a köztes napi bukás nem (három azonos levél
   megtanítja az olvasót átugrani őket). A keret utáni kézi próba nem riaszt — az operátor ott olvassa a
   választ, ahol kérte (a tudásbázis-őr lelete: e nélkül a kézzel elfogyasztott keret némán zárult volna).
   A nyilatkozat nélküli (0029 előtti) rendelés is riaszt, „kézzel kell kiállítani” teendővel.
2. **Egy kiadási út:** minden próbálkozás (fizetés-ág, napi tick, konzol, CLI) az `issueInvoiceFor`-on
   megy át, ami most `InvoiceOutcome`-ot ad vissza. A kísérlet-szám = a fizetés `failed` sorainak száma
   (0007 már soronként rögzít) — nincs új oszlop, nincs elsodródó számláló.
3. **Duplikáció ellen két fék:**
   - **Advisory lock fizetésenként** (`pg_advisory_lock`, dedikált kapcsolaton): a webhook, a tick (másik
     folyamat) és a kézi újrakiadás ugyanarra a fizetésre sorba áll, a második már a kész `issued` sort látja.
     Mérve: zár nélkül a három párhuzamos kérés 3 szolgáltató-hívást ÉS egy hamis `failed` sort adott
     (`invoice_issued_uniq` ütközés) — az őr ezt pirosnak méri.
   - **Szolgáltató-oldali idempotencia:** a Számlázz-kérés `szamlaKulsoAzon = citoviso-payment-<payment.id>`
     (+ `rendelesSzam = CIT-XXXXXXXX`). **Mérve a Számlázz demo fiókján 2026-09-30:** ugyanazzal a külső
     azonosítóval másodszor beküldve NEM készül új bizonylat, a válasz az ELSŐ számát adja (TST-2026-819
     kétszer); a lekérdezés (`xmlszamlaxml`) a külső azonosítóra és a rendelésszámra is megtalálja. Így
     egy elveszett válasz (a számla kész, a válasz nem ért vissza) utáni újrapróba sem ad ki másodikat.
     A mock számlázó ugyanígy viselkedik.
4. **Automatikus újrapróba** a napi számlázási tickben (`citoviso-billing`, 07:00, `retryFailedInvoices`):
   csak `paid` fizetés, nincs `issued` sor, van számlázási nyilatkozat; az előző kísérlet ≥ 20 órás;
   legfeljebb `INVOICE_AUTO_RETRY_LIMIT` = 3 újrapróba (összesen 4 kísérlet). Egy fizetés kivétele nem
   állítja meg a többit, de a futás pirosan zárul (az `OnFailure=` riaszt, ADR-0276).
5. **Kézi újrakibocsátás:** `npx tsx scripts/invoice-retry.mts <payment.id | CIT-XXXXXXXX>` (csak `paid`
   fizetésre, `retryInvoice`). A konzol-gomb („Számla újra ▸” a lead-lap „Csomag és fizetés” fülén, a bukott
   számlájú fizetés sorában) megírva, ui-shottal és végigkattintva ellenőrizve, de a §2b felület-kapu
   (tulajdonosi jóváhagyás) előtt NEM landolt: patch-ként vár (`~/rc-briefs/reports/deploy-keszenlet/szamlaretry-ui.patch`). A kézi próba is `failed` sort ír, tehát
   az automatikus keretből is fogy — szándékosan: a sorok száma a valóság (és a KB ezt ki is mondja).

**Őr:** `scripts/invoice-retry-check.mts` (pre-commit, a számlázási fájlok változásakor) — mock számlázó
Számlázz-szemantikával, saját fixtúra, a tick a saját fizetés-id-kra szűkítve (a közös dev DB más sorait
nem próbálja újra). Bukás → riasztás + failed; azonnali tick nem hív (negatív kontroll); napi újrapróbák,
csak az utolsó riaszt; kézi újrakiadás → egy `issued`, a második hívás nem ér el a szolgáltatóig; verseny → egy hívás; elveszett
válasz → ugyanaz a bizonylat; nyilatkozat nélküli / függő fizetés → nincs próbálkozás; az XML az XSD
szerinti helyen viszi a két új mezőt. Mutációs próba: a zár vagy a külső azonosító kivétele pirosra viszi.

**Következmény.** A `d1f07194…` számla a deploy után MAGÁTÓL is kimegy a következő reggeli tickben, ha a
tulaj addig összekötötte a Számlázz-fiókot a NAV-val; azonnal: a CLI. Ha 3 napig nem
köti össze, a 4. kísérlet után „újrapróbák elfogytak” levél jön, és onnantól csak a CLI adja ki.

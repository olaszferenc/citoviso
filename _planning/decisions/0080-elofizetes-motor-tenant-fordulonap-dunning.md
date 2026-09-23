## ADR-0080 — Előfizetés-motor: tenant-fordulónap, dunning-lépcső, freeze, SMS-csatorna

**Dátum:** 2026-08-28 · **Státusz:** ELFOGADVA (tulajdonosi döntés, 3 kérdéses kör) ·
**Kapcsolódó:** ADR-0033 (upsell-orderek), ADR-0063 (egyszeri díjas billing-típus),
ADR-0013 (árazás), 05-MODULES (modul-árak).

**Probléma (mérve, nem tippelve):** a „havidíj" ma csak árcédula. Minden fizetés egyszeri
(`order_intent`+`payment` egy-lövéses); a `runBillingCycle` (Slice 3 csontváz) ORDER-szintű
ciklusokat görget értesítés nélkül; modul-felvétel ciklus közben instant teljes díjat kérne,
ami nem szinkron a meglévő modulokkal; lemondás-fogalom NINCS; a `suspended` site-ot a
publikus szerver néma 404-gyel ejti (SEO-gyilkos). Nem három hiba — egy hiányzó réteg.

**① Tenantonként EGY fordulónap (anchor).** Az első fizetés napja = a tenant fordulónapja;
minden havidíjas modul ebbe a közös ciklusba olvad → havonta EGY terhelés, EGY számla,
tételekkel. Nincsenek modulonkénti ciklusok — a szinkron-probléma a gyökerénél szűnik meg.
Az egyszeri díjas modulok (ADR-0063, pl. multilang) kívül maradnak: azok nem újulnak.

**② Modul-felvétel ciklus közben: a KÖVETKEZŐ fordulótól fizet (B-opció).** A modul
bekapcsoláskor azonnal aktív; első díja a következő közös számlán jelenik meg — a törtidőszak
ajándék (max ~1 hónap). Indok: 690–990 Ft-os moduloknál egy arányosított (pl. 276 Ft-os)
AAM-számla adminisztrációja többe kerül, mint az összeg; sales-barát („kapcsold be, próbáld
ki"); nulla számlázási bonyodalom. A „felveszi, ingyen használja, forduló előtt lemondja"
kockázat ezen az árszinten elhanyagolható. Elvetve: A) proration (fillérszámlák),
C) instant teljes hónap saját fordulóval (a mai szinkron-káosz általánosítása).

**③ Lemondás (modul VAGY teljes előfizetés): a fordulónapon érvényesül.** Addig aktív marad
(ki van fizetve); részleges visszatérítés nincs (ÁSZF-be). A tenant-adminban: „Lemondva —
aktív eddig: <fordulónap>", addig egy gombbal visszakapcsolható. A ②+③ együtt kerek:
felvétel azonnal él, lemondás fordulón hat — a számla mindig a fordulón álló állapotot tükrözi.

**④ Fizetési út: Barion token auto-terhelés ELSŐDLEGES + díjbekérő fallback.** Az első
fizetéskor `InitiateRecurrence` → tárolt `RecurrenceId` → havi merchant-initiated terhelés a
vevő jelenléte nélkül (sandbox-validálás az első lépés — a fiók él, lásd
`reference_szamlazz_barion_test_accounts`). Akinél nincs token vagy a terhelés végleg elhasal:
díjbekérő (proforma) e-mail fizetőlinkkel — a link ugyanaz a Barion-checkout.

**⑤ Dunning-lépcső (nem-fizetésre):** T−3 előértesítő e-mail → T terhelés/díjbekérő →
T+3 sikertelen: emlékeztető + retry → T+7 utolsó figyelmeztetés (e-mail + SMS) →
**T+10 FREEZE** → T+30 felmondottnak tekintjük (archiválás; egyedi domainnél
transzfer-felajánlás, nem hagyjuk némán lejárni).

**⑥ Freeze ≠ eltűnés.** A fagyasztott site a vendégnek 503 + `Retry-After` „átmenetileg nem
elérhető" udvariassági lapot ad (a Google így NEM dobja ki az indexből — a tenant védelme;
a mai néma 404 tilos). A tenant-admin ÉL, benne „Díj rendezése" gomb; fizetés → azonnali
automatikus visszakapcsolás, kézi lépés nélkül.

**⑦ SMS-csatorna: a gépen élő GSM-modul (tulajdonosi döntés — „SMS is!").** A Debian
dev-gépen `gammu-smsd` fut (CH340 modem, `/dev/gsmmodem`, SQL-backend `minereal_sms`);
küldés = `gammu-smsd-inject` (csak az SQL-outboxba ír, a daemon küld). Citoviso-oldalon
adapter a payment-gateway mintájára: `SMS_PROVIDER=mock|gammu` — a mock-út mellé az éles
hívó út TÉTELESEN bekötve (feedback_mock_path_masks_live_path). Élesben (Hetzner VPS-en
nincs modem) a MineREAL `sms-relay` mintája: a prod sorba teszi, lokál relay küldi.
⚠️ A SIM közös a Minerallal — a Citoviso-SMS ugyanarról a számról megy ki; pilotra
elfogadva, később saját SIM/provider döntés lehet.

**Implementációs szeletek:** ① subscription-séma + anchor-backfill → ② megújulás-motor
(tenant-anchor, dunning, freeze/unfreeze, systemd timer) → ③ SMS-adapter → ④ tenant-admin
le/feliratkozás felület (⚠️ §2b terv-kapu!) → ⑤ Barion token.

**Kiegészítés (2026-08-29, sandbox-mérés):** a Barion token-fizetés **3DS-köteles** — az
első Start `InitiateRecurrence` önmagában `UpgradeTo3DS` hibát ad. A helyes alak: az indító
fizetésen `RecurrenceType: MerchantInitiatedPayment` (nem RecurringPayment — az összeg
ciklusonként VÁLTOZIK a modul-módosításokkal) + `ChallengePreference: ChallengeRequired`;
a kifizetett indító fizetés `GetPaymentState`-jéből a **TraceId** eltárolandó (0040:
`subscription.recurrence_trace_id`), és minden MIT-terhelésen visszajátszandó — nélküle a
kibocsátó elutasít. Az MIT Start modellje payer-absent is kéri a `GuestCheckOut`/
`RedirectUrl` mezőket. Mindkét kérés-alak a valós sandboxon igazolva; a kártyás happy-path
(checkout → token → sikeres MIT) a tulajdonosi teszt-kör része. A megújuló számla
vevő-blokkja a partner-törzsből öröklődik (0029: vevőt nem fabrikálunk — nyilatkozat
nélküli tenant megújulási számlája KÉZI kiállítás, hangos naplóval).

**Visszafordíthatóság:** 🔄 a lépcső-paraméterek (napok, csatornák) és a B-opció szabadon
hangolhatók; 🚪 részben egyirányú: az anchor-fogalom a payment/invoice rekordokban megjelenik,
és a kiküldött ÁSZF-ígéretek (lemondás fordulón, nincs visszatérítés) kifelé tett vállalások.

# 01 — SZÁMÍTÁSI MODELLEK (Citoviso ontológia)

> Az üzleti/pénzügyi számítások kanonikus képletei. Ha egy szám máshol máshogy jön ki, ITT a forrás.
>
> ⚠️ **KONKRÉT ÖSSZEG NEM ITT ÉL.** Az élő árak forrása a `pricing_config` tábla, olvasója a
> `pricingSnapshot()` / `getBaseMonthly()` / `getModulePrice()` (`src/pricing.ts`); a kódbeli
> konstansok (`src/domains.ts`, `src/modules.ts`) csak SEED-ek, futásidőben nem hívódnak.
> Ez a fájl a **KÉPLETEKET és a szabályok alakját** rögzíti — aki számot keres, a kódot mérje.
> (Indok: ha két dokumentum ugyanazt az összeget állítja, az egyik előbb-utóbb hazudni fog.)

## Unit economics (per tenant)
- **Marginális költség / ügyfél** ≈ néhány € : generálás (gépidő + AI-token, pár cent) + hosting (0,5–2 €/hó megosztott) + domain (~10 €/év, ha adunk).
- **Bruttó margin** @ ~100 €/év vagy €20–50/hó ≈ **90%+**.
- **Volumen-modell:** árbevétel ≈ `tenant_szám × éves_díj`. Cél-nagyságrend: pl. 2000 × 100 €/év = 200k €/év.

## Ügyfél-oldali megtérülés (a horog)
- **Jelenlegi költség:** booking-jutalék = `éves_foglalási_forgalom × 0,15–0,18`. Példa: 3–4M Ft forgalom → 450–700e Ft/év.
- **Megtakarítás:** `átcsábított_direkt_foglalás_arány (20–30%) × jutalék`. A saját oldal havidíja ehhez képest töredék → hónapos megtérülés.

## Árazási sávok (piaci referencia, 2026-07-04 — történeti horgony)
- Klasszikus kézi/ügynökség: €1000–3000 (EU) / $2000–5000 (US) egyszeri.
- Citoviso: €0–600 setup + €20–50/hó, VAGY ~100 €/év.
- Preferált: **havidíj** (8 €/hó jobban konvertál, mint 100 €/év egyben).
> ⚠️ Ez a szakasz a PIACI összehasonlítás horgonya, NEM a saját listaárunk. A fizethető listaár
> a `pricing_config`-ból jön (régió-kulcsú, `pricingConfirmed` flaggel; nem megerősített régió →
> „Egyedi ajánlat" fallback).

## Előfizetés- és modul-számítás (élő motor: `src/pricing.ts` + `src/payment/billing.ts`)
- **Éves előfizetés = `12 − annualFreeMonths` havidíj** (`getAnnualFreeMonths(region)`, ma 2
  ajándékhónap; `computeAnnual = computeMonthly × (12 − ajándék)`). Ugyanez a szorzó árazza a
  modulokat is.
- **A modul-árazás a FIÓK SZÁMLÁZÁSI ÜTEMÉBEN jelenik meg** (ADR-0125-kör): éves fiókon
  „+X Ft/hó = X·(12−ajándék) Ft/év" + végösszeg; havi fiókon az éves szám zaj lenne, ezért nem
  jelenik meg. A „számlázott modul" definíciója EGYETLEN függvény (`isBilledModule`,
  `src/tenant/modules.ts`) — a képernyő és a számla nem tud elcsúszni egymástól.
- **Fizetés-kapus modul (ADR-0113):** a fizetett modul CSAK az első díj beérkezése után él, és a
  kapu az **ÍRÁSON** ül (`applyModuleChange → requiresPayment`), nem a gomb letiltásán.
  Első díj **IDŐARÁNYOS**: `proratedFirstChargeMonths(period, periodEnd)` = a megkezdett hónapok
  a fordulónapig, éves plafon `12 − ajándék`.
  *Miért:* az ADR-0080 ② B-opciója HAVI ütemre volt méretezve; éves ütemen némán 12×-ezte a rést
  (éves fizetés → mandátum-visszavonás → modul-aktiválás = 12 hónap ingyen; a lemond-visszakapcsol
  hurok **örökre ingyen**). A tulaj élőben reprodukálta.
- **Ajánlat/kedvezmény (ADR-0088):** az ELSŐ díjra megy, a megújulás **LISTAÁRBÓL** számol
  (`billing.ts`); sosem halmozódik, mindig az egyetlen legnagyobb kedvezmény él.

## Előfizetés & dunning (steady-state, ADR-0080)
- **Tenantonként EGY előfizetés, EGY fordulónap** — anchor = az ELSŐ fizetés napja
  (`src/payment/subscription.ts`, `migrations/0039_subscription.sql`). Minden havidíjas modul
  közös ciklusban → havi **EGY** `renewal` order/számla (nincs fillérszámla modulonként).
- **Modul-billing két típus:** `monthly` (visszatérő) és `once` (egyszeri díj — első ilyen a
  Többnyelvű honlap modul, ADR-0063). Az `once` a `priceMonthly` mezőt alkalmankénti díjként
  használja.
- **B-opció:** modul-bekapcsolás azonnal él, első díj a KÖVETKEZŐ számlán
  (`awaiting_first_charge` védi a paid-sync-visszavonástól); lemondás a fordulóig aktív
  (`cancel_at_period_end`), `cancelled_at` sírkővel — különben a történelmi fizetett-unió
  FELTÁMASZTANÁ a lemondott modult. ⛔ Az explicit lemondás erősebb a történelmi fizetésnél; a
  „jogosan aktív, még nem fizetett" állapot explicit flag, nem hallgatólagos tudás.
- **Dunning-létra** (`LADDER`, `src/payment/billing.ts`; T = `current_period_end`):
  `T−3` előértesítés → `T` terhelés → `T+3` emlékeztető → `T+7` utolsó figyelmeztetés (e-mail+SMS)
  → **`T+10` freeze** (vendégnek 503+Retry-After, admin él — NEM 404/törlés) → `T+30` lezárás;
  fizetés = automata thaw. A tenant-adminnak MUTATOTT határidő ugyanaz az egy szám
  (`DUNNING_CANCEL_OFFSET_DAYS`) — a képernyő és a létra nem tud elcsúszni.
- **Terhelés:** token-először (Barion MIT, 3DS), bukás → hangos díjbekérő-fallback; már-fizetett
  ciklus nem terhelődik újra; elakadt pending MIT 24h után zárul.
- **Renewal-számla vevője** a partner-törzsből öröklődik; nyilatkozat nélkül hangos kézi-számla
  jelzés (vevőt nem fabrikálunk — [03-INVARIANTS] számlázási identitás).

## Saját domain — díj, jogosultság, elköteleződés (ADR-0109; felülírja ADR-0020-at és ADR-0093 ②-t)
- **Alap:** `<slug>.citoviso.com` aldomain „az árban" (nulla súrlódás, olcsó út).
- **A saját domain díja HAVI**, minden számlázási ciklus TÉTELE, amíg a nevet tartjuk:
  `domainFeeForCycle(cycleMonths) = customDomainMonthly × cycleMonths` — lineáris, nincs
  évforduló-ablak (`src/pricing.ts`; megújuláskor `domainFeeForRenewal`, `billing.ts`).
- **A jogosultság BELÉPÉSI FELTÉTEL, nem ingyen-kapu:** `isDomainEligible(listMonthlyTotal)` —
  a csomag-küszöb (`domainMinPackageMonthly`) alatt a saját cím nem olcsóbb, hanem **NINCS**.
  ⛔ **A küszöböt a LISTAÁR dönti el** — kedvezmény SOSEM számít bele (*időszakos engedmény nem
  vehet meg tartós jogosultságot*): a hívó `computeMonthly(...)`-t ad át, sosem az
  ajánlat-korrigált összeget.
- **Kedvezmény a domain-díjat SOSEM éri** — átfolyó registrar-költség, nem a mi szolgáltatásunk
  (ugyanígy az éves ajándékhónapok sem).
- **Beszerzési ár-plafon:** a registrar-vétel a `domainMaxPriceEur` (ma 15 €/év) alatt kell
  maradjon — efölött nem veszünk.
- **Minimum elköteleződés (hűségidő):** `getDomainMinCommitmentMonths()`, ma **12 hónap**
  (⚠️ az ADR-0020 eredeti **24** hónapját az ADR-0093 12-re lazította — a `src/domains.ts`
  fejléc-kommentje még a 24-et említi, a konstans és a futásidő 12).
- **Nincs ingyen-ág** → minden domain-rendelés **befagyasztja a csomag-padlót**
  (`order_intent.committed_min_monthly`), tehát a kötbér-alap sosem hiányzik. A modulváltás
  (`applyModuleChange`) ATOMIAN elutasítja a padló alá csökkentést.
- **A hűség letelte után se kötbér, se csomag-padló** — csak a havidíj fut tovább.
- A konfigurátor rendeléskor 3–5 szabad javaslatot ad (HU-first `.hu` → `.com`/`.eu`) valós idejű,
  kulcs-nélküli előzetes csekkel (DNS-over-HTTPS → RDAP; a verdikt őszintén „előzetes"). Hiteles
  csekk + regisztráció = registrar-API réteg.

## Domain-kötbér (korai kilépés elszámolása, ADR-0094)
- **Futó elköteleződés:** `activeDomainCommitment(tenantId)` — a hűségidő a domain-rendelés
  FIZETÉSÉTŐL fut `commitment_months` hónapig; több fizetett domain-rendelésnél a legkésőbb
  végződő nyer (`src/domains/domainCommitment.ts`).
- **Kötbér-alap (havi):** `floorMonthly ?? computeMonthly(renewableModuleIds)` — a rendeléskor
  befagyott csomag-padló, vagy annak hiányában a megújítható modulok aktuális havidíja.
- **Kötbér-összeg:** `remainingMonths × kötbér-alap` — MINDIG jár (nem opcionális). A
  `remainingMonths` felfelé kerekített egész hónap, a hűségidő alatt mindig ≥1.
- **Domain vételára** (`getDomainBuyoutPrice()`): hozzáadódik CSAK ha a tenant ELVISZI a domaint
  (a tenant dönt; kiléphet domain nélkül is).
- **Végösszeg** = kötbér-összeg + (viszi ? domain-vételár : 0). Egyetlen olvasó
  (`settlementQuote()`, `src/domains/domainSettlement.ts`) eteti a GET-lapot, a POST-ordert és a
  teszteket — a tenant sosem fizet mást, mint amit látott.
- **A domain a ZÁLOG:** átszállás csak maradéktalan rendezés után (önvégrehajtó behajtás +
  előfizetés-freeze). ⛔ A megtartási/kedvezmény-ajánlat NEM pótolja a hiányzó kötelmet.

## Adó / számlázás (HU-first pilot)
- **Eladó = magyar egyéni vállalkozó, AAM (alanyi adómentesség)** → a kimenő számla **áfamentes**:
  `vatKey="AAM"`, `vatRate=0` (nettó = bruttó). Számlázz.hu áfakulcs: `<afakulcs>AAM</afakulcs>`.
  NAV Online Számla adatszolgáltatás automatikus. Kód: `src/invoicing/invoice.ts`,
  `src/invoicing/szamlazz.ts`, a vevőnek mutatott ÁFA-jegyzet `VAT_NOTE_AAM` (`src/legal.ts`).
- **VAT PER SZÁMLA** (invoice-soronként, nem globális konstans): a küszöb-átlépés vagy KFT-vé
  alakulás csak a **jövőbeli** sorok `vat_key`/`vat_rate`-jét billenti → **nincs séma-migráció**.
  Kód-igazság: `migrations/0007_invoice.sql`, `src/db/schema.ts` (`InvoiceTable`).
- **AAM-küszöb ütemterv:** **2026 = 20 000 000 Ft** (a korábbi ~18M a 2025-ös érték, elavult) →
  22M (2027) → 24M (2028). A küszöb átlépése fölött már a határszámlát is áfásan (Áfa-tv. §188).
  > ⛔ **VERIFIKÁLATLAN — a három szám a desztillált memóriából jött, NEM a jogszabályból.** A
  > kódban egyetlen horgonya sincs (`grep`: 0 találat), tehát semmi nem tudja megcáfolni. Mielőtt
  > bárki DÖNTÉST épít rá (áfássá válás ütemezése, árazás), az Áfa-tv. §188 hatályos szövegéből
  > vagy a NAV tájékoztatójából kell igazolni. *Indok: a 2026-09-16-i megszűnt-adószám ügy —
  > a saját dokumentumunkból olvasni nem mérés; hatósági tényt a nyilvántartás mond ki.*
- **Globális billing (Paddle/Stripe MoR)** PARKOLVA a valós proof-ig — ne dönts irreverzibilist
  validáció előtt.

<!-- distill:begin 36d5bc3e65542b7a 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Adó / számlázás (HU-first pilot) — a szakasz végére
> **Forrás-memória:** `2026-09-21_szamlazz_uj_fiok.md` · `2026-09-22_coupon_visible.md` · `2026-09-22_barion_pixel_pos_szamlazas.md`
> **Review:** `_inbox/20260927T020001Z.md` (85. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

### A bizonylat-szolgáltató (Számlázz.hu) SZERKEZETI korlátai — nem választás kérdése
- **Az adószám TÖRZSSZÁMA (első 8 jegy) a fiókban SOHA nem módosítható** (az áfakód és a megyekód
  igen). Más törzsszám = más adóalany ⇒ **ÚJ számlázási fiók, kivétel nincs**; „alfiók" nem
  létezik — a helyes forma egy külön fiók UGYANAZZAL a belépéssel („Hozzám kötődő cégek").
  Előfizetés fiókonként külön, a számlasor 1-től indul. *Mért ára ennek: 2026-09-16-án az `.env`
  adószámát javítottuk, a FIÓK maga öt napig a megszűnt adószámon állt — egy éles fizetés a
  megszűnt vállalkozás nevére számlázott volna.*
- **A tesztüzem kapuja EGYIRÁNYÚ:** csak addig kapcsolható be, amíg a fiókban nincs kiállított
  számla ÉS nincs NAV Online Számla összekötés. Aki a felkínált NAV-összekötésre kattint előbb,
  **végleg elveszti a tesztüzemet abban a fiókban**. Élesre álláskor a szolgáltató TÖRLI az összes
  teszt bizonylatot. ⚠️ Tesztüzemben a számlaértesítő e-mail MINDIG a fiók kapcsolattartási
  címére megy, nem a vevőére — a fizetés-visszaigazoló folyamat tesztelésekor ez félrevezető, és
  NEM a mi kódunk hibája.
- **⛔⛔ KEDVEZMÉNY SOHA NEM LEHET KÜLÖN SZÁMLA-SOR.** A szolgáltató a tételeket ÖSSZEADJA, tehát
  egy −4 925 Ft-os sor a 14 775 Ft-os végösszeget **9 850-re** vinné: a „láthatóvá tételből"
  rosszul számlázás lenne. A kedvezmény a **tétel NEVÉBEN** (`… — {n}% kedvezménnyel`) és a
  **megjegyzésben** él (`invoiceComment`, `src/payment/service.ts:923`), és az őr minden esetben
  visszaméri a végösszeg-egyezést. *(Azt, hogy az API támogat-e kedvezmény-MEZŐT, a kódból nem
  lehet eldönteni — ki kell mondani, nem tippelni.)*
- **A kulcs OPÁLOS: a fiók szerepe (prod/teszt) a kódból MÉRHETETLEN.** Két érvényes kulcs
  ugyanazt a hitelesítés-választ adja („7: ismeretlen számlaszám"; a rossz kulcs 3-ast), és
  mellékhatás-mentes fiók-azonosító NINCS — egy próba-számla mindkét éles fiókban valódi
  bizonylatot szülne. 2026-09-22-én a prod/dev kulcs **fel volt cserélve**, és ezt csak a
  szolgáltató vezérlőpultjának képe mondta meg. Ezért a védelem **szerkezeti, nem fegyelmi**
  (`src/invoicing/keyGuard.ts`, boot-ponton dobó): az éles hoston TILTÓLISTA (teszt-módú
  ujjlenyomatok), az éles hoston KÍVÜL **ENGEDÉLYEZŐ lista** — ismeretlen Agent-kulccsal a
  `szamlazz` szolgáltató nem is konstruálható (dev három útja: `INVOICE_PROVIDER=mock` ·
  `SZAMLAZZ_DEMO=1` · a saját teszt-fiók kulcsa felvéve a `TEST_ACCOUNT_KEY_SHA256` listára).
  ⛔ A repóban SOHA nem kulcs, csak SHA-256 ujjlenyomat: az azonosít, de nem hatalmaz fel.
- **Kulcs-próba mellékhatás nélkül:** `fetchIssuedInvoicePdf("<nem létező számlaszám>")` — nem
  gyárt semmit, és a `szlahu_error_code` elválasztja a két esetet (**7** = a hitelesítés átment ·
  **3** = sikertelen bejelentkezés). ⛔ A 7-es önmagában semmit nem bizonyít: negatív kontroll
  (szándékosan rossz kulcs) nélkül a mérés üres.
<!-- distill:end -->


## Fizetési mechanika (pilot)
- **Gateway = Barion** (nincs belépő/havi díj, first-party Számlázz-integráció). ⚠️ A díj
  **változó** (bázis + választott modulok) → NEM sima kártya-recurring, hanem
  **MerchantInitiatedPayment (MIT)**, amit a Barion **külön jóváhagy** (átfutási idő).
- **Pilot stratégia (MIT-független indulás):** per-ciklus **egyszeri pay-link** → nem-fizet →
  deaktiválás (grace után `suspend`). Auto-terhelés (MIT) = 2. fázis. 🚪 Nehezen visszafordítható:
  a gateway + kártya-tokenek (nem migrálnak) → gateway-váltás előtt megfontolandó.
- **Idempotencia:** `payment.gateway_ref` (Barion PaymentId / mock: saját ref) + részleges unique
  (1 kiadott számla / fizetés). A számlázás best-effort (hiba → `failed` sor, nem töri az
  aktiválást). ⚠️ A VEVŐNEK mutatott hivatkozás a saját `payment.id`-ból képződik (`CIT-XXXXXXXX`),
  nem a gateway kezelőjéből.

<!-- distill:begin dd4d0d6fc3b957a0 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** (új szakasz a „Fizetési mechanika” után)
> **Forrás-memória:** 2026-10-09-ingyenes-proba-C2b-sms-eles.md · 2026-10-09-ingyenes-proba-C-lejarat-folytatas.md
> **Review:** `_inbox/20261011T020001Z.md` (126. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

## SMS-szelet számítás (költség + kézbesítés)
- **GSM-7** (csak a GSM-ábécé karakterei): 160 karakter / 1 szelet, összefűzve 153 / rész.
  **UCS-2** (bármely más karakter, pl. `ő`, `ű`): 70 / 1 szelet, 67 / rész. `szeletek = n ≤ egy ? 1 : ⌈n / rész⌉`.
  Forrás: `smsEncoding`, `src/sms/encoding.ts`. Egyetlen ékezetes betű az EGÉSZ üzenetet UCS-2-be viszi.
- ⚠️ 2026-10-09-ig a modem MINDEN SMS-t unicode-dal küldött, tehát ékezet nélkül is UCS-2-ben számolt — a kódolást
  a szövegből kell levezetni, nem fixen beállítani.
- A link mindig az UTOLSÓ szeletbe esik → több szeletnél a link elvesztése a legvalószínűbb hiba (ld. [03-INVARIANTS] §C „sent” = igazolt).
<!-- distill:end -->


<!-- distill:begin 758e9af8b72fa3f1 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Fizetési mechanika (pilot) — a szakasz végére
> **Forrás-memória:** `2026-09-24_barion_advanced_approved.md` · `2026-09-26_rendeles_fizetesi_link.md` · `2026-09-24_penztarca_sandbox_bizonyitek.md`
> **Review:** `_inbox/20260927T020001Z.md` (155. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

- **Gateway-díj (2026-09-24 óta jóváhagyva): Advanced Fix 1,19 % + 0,2 % ismétlődő felár =
  ⭐ 1,39 %.** Mivel ELŐFIZETÉST árulunk, a mérvadó szám az **1,39**, nem az 1,19 (korábban
  mindenhol 1,19-cel számoltunk). ⚠️ A díjcsomag a Full Pixel implementációján múlt: a Barion a
  Starter csomagban hagyta az elfogadóhelyet, amíg a KÖTELEZŐ `grantConsent` és
  `setEncryptedEmail` események nem voltak bekötve — a partner követelményét a PARTNER listájához
  kell kötni, tételesen (a mi saját eseménylistánk mérése ezt szerkezetileg nem látja).
  ⛔ A kódban nincs díjból levezetett számítás, tehát semmi nem tudja megcáfolni ezt a számot: aki
  árazási döntést épít rá, a szolgáltató felületéről igazolja.
- **A PAY-LINK NEM A GATEWAY NYERS LINKJE (ADR-0234).** A nyers átjáró-link ~30 perc után
  „Lejárt fizetési tranzakció", és a pending-újrahasznosítás UGYANAZT a halott linket adta vissza.
  Ezért MINDEN levél (rendelés-visszaigazoló, megújítás/felszólítás + SMS, domain-lezárás) a saját,
  **tartós belépőnket** viszi: `/pay/go/<payment-id>` (`src/payment/payEntry.ts`,
  `payEntryUrl.ts`) — a friss átjáró-tranzakciót a belépő állítja elő.
- **Kártya-csere vásárlás nélkül** (`kind='card_update'`): a dokumentált út egy valódi
  **Reservation** (`CARD_VERIFY_AMOUNT_HUF = 10` Ft, `src/payment/service.ts`) +
  `finishReservation(ref, 0)` = teljes visszatérítés; a token és a maszk a `GetPaymentState →
  FundingInformation.BankCard.{MaskedPan, BankCardType, ValidThruYear/Month}`-ból jön.
  ⛔ **`card_update`-ra SZÁMLA NEM készül**, és olyan átjárón, amely nem tud zárolást feloldani, a
  művelet MEGTAGADVA (különben valódi terhelés maradna a vevőn). Sandboxban végig igazolva
  (Reservation → Finish(0) → Succeeded → token + maszk → MIT Successful); ⚠️ az éles 3DS és a
  tárca-fedezet a sandbox teszt-kártyán NEM fut le — élesítés előtti előfeltétel.
<!-- distill:end -->


## Magyar adószám-ellenőrzőszám (HU tax-ID checksum)
- Az adószám első 8 jegye a törzsszám; a 8. jegy az ellenőrzőszám.
- Súlyok az 1–7. jegyre: **9, 7, 3, 1, 9, 7, 3**.
- `check = (10 − (Σ dᵢ·wᵢ mod 10)) mod 10`.
- A 9. jegy az **ÁFA-kód** (1–5 a definiált értékek), a 10–11. a megyekód; normalizált alak:
  `12345678-2-41`.
- Forrás: `src/billing/taxId.ts`; négy valós, publikált adószámon igazolva (KBOSS, MOL, OTP,
  Magyar Telekom).
- A közösségi (EU) adószámot ezen felül a VIES REST szolgálat validálja
  (`ec.europa.eu/.../ms/{CC}/vat/{n}`), ami a cég jogi nevét is visszaadja — ez tölti ki a
  számlázási identitást ([03-INVARIANTS] §K).

## Rejtett költség
- **Support** — skálázódik a tenant-számmal; önkiszolgáló admin nélkül megöli a margint. Modellben: `support_óra/hó × tenant` → tartsd ~0 közelében.

> TODO: LTV/churn, akvizíciós költség (outreach konverzió), infra-lépcsők (N tenant → szerver-szint).

<!-- distill:begin 73907689c79a28ae 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** új szakasz a „Rejtett költség" ELŐTT
> **Forrás-memória:** `2026-09-22_programajanlo_modul.md` · `2026-09-23_programajanlo_build.md`
> **Review:** `_inbox/20260927T020001Z.md` (124. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

## AI-költséges modul — a programajánló mint a marginális költség ellenpróbája (ADR-0214)
A fenti „marginális költség / ügyfél ≈ néhány €" a BEMUTATÓ-magra igaz. Egy **ismétlődő
adatgyűjtésre épülő modul** ezt megfordíthatja, és ezt mérni kell, nem levezetni:
- **A gyűjtés TELEPÜLÉS-kulcsos, nem tenantonkénti** — ez maga az amortizáció: 3 tenant köre
  96 helyett **42** települést jelent. A kör a tenant 30 km-es sugara, a lekérdezett halmaz a
  **≥1000 fős** települések + a tenant SAJÁT települése mérettől függetlenül (`MIN_POPULATION`,
  `src/events/settlements.ts`): 120-ból **41**, 78,5 % lakosság-lefedettség.
  ⚠️ **NEM mért feltevés**, hogy a lakosság-lefedettség előrejelzi az ESEMÉNY-lefedettséget — az
  `event_gather_run` hozamából korrigálandó.
- **Mért egységköltség:** Rozé Fogadó köre = 41 lekérdezés / 99 lap / 40 egyedi program /
  **$0,43 hét**. ⛔ **Magányos tenantnál ez ~650 Ft/hó, a modul listaára 490 Ft/hó** (`poi`,
  `src/modules.ts`) — vagyis egy régióban egyedül álló tenanton a modul **negatív margós**. Az ár
  a tulajé; a KÖLTSÉGET a `event_gather_run` (cost_usd / queries / pages / hozam) írja.
- **Az eszköz-választás mérve dőlt el, nem elvből:** Brave keresés ($5/1000) vs. modell-beépített
  web_search ($10/1000) — **2,55 vs. 5,65 Ft/program**, és **0 vs. 2 rossz dátum** ment ki. A
  költség 93 %-a abból jött, hogy a találatok beömlenek a kontextusba; a szűk keresztmetszet a
  **kötegméret**, nem a keresés (45 lap egy hívásban: 3 program; 5-ös kötegek: 24).
- **⛔ A „nulla-tokenes" strukturált út marginális:** a `schema.org/Event` JSON-LD a
  JEGYÉRTÉKESÍTÉSSEL korrelál, nem a helyi programmal — a `tixa.hu` 94 `Event` node-ot ad, a
  helyi programot hirdető oldalak (gotravel, csodalatosbalaton, welovebalaton, programturizmus)
  **nullát**; 20 Balaton-környéki önkormányzatból **2** futtat gépi naptárt, az egyik üres.
  Aki helyi programot hirdet, nem tesz ki strukturált markupot.
- **A séma a dátum MEGLÉTÉT kényszeríti ki, a HELYESSÉGÉT nem** → a kódszintű dátum-ablak kapu
  teherviselő, nem dísz (mérve egy teljes körön: `unknown_place` 58 · `expired` 23 ·
  `date_not_in_text` 2 · `duplicate` 2).
<!-- distill:end -->



<!-- distill:begin f906e6b15fe57077 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** (új szakasz) Foglalási ár: ellátás, gyerekár, IFA
> **Forrás-memória:** 2026-10-13_ellatas_es_felarak.md, 2026-10-13_elek_eles_leletek_javitasa.md, 2026-10-14_teszt3_javito_szal.md, 2026-10-14_elek_foglalo_vendeg.md
> **Review:** `_inbox/20261019T060001Z.md` (10. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

## Foglalási ár — ellátás, gyerekár, IFA (ADR-0378 / ADR-0384 / ADR-0388)
- **Végösszeg** = Σ éjszakánként (az éjszaka érvényes ára: szezonár, ha van, különben alapár)
  + ellátás-felár. **Ellátás-felár** = éj × (felnőtt × felnőtt-felár + gyermek × gyerekár);
  gyerekár nélküli tervnél minden vendég felnőtt-felárat fizet. Az EGY szabály `src/tenant/meals.ts`
  (`mealLines`), böngésző-ikre `cit-runtime.js` `mealLinesFor`. A kettőnek egyeznie kell
  (őr: `scripts/meals-check.mts`, böngésző = szerver).
  Példa (mérve, éles): 2 × 24 000 + 20 000 = 68 000; reggeli 3 éj × (2 × 3 000 + 1 × 1 500) = 22 500 → **90 500 Ft**.
- **IFA** = tétel × fizető vendég × éj. A **18 év alatti vendég mentes** (Htv. 31. § a)):
  `taxPayers(guests, children) = guests − clamp(children, 0, guests − 1)`, tehát a foglaló felnőtt
  mindig fizet. ⚠️ A gyermekként megadott vendég a tulaj ellátás-korhatára alatt van (legfeljebb 17).
  A korhatár FELETTI kiskorú (pl. 13–17 éves egy 12 éves korhatárnál) az összegben felnőttként
  szerepel, ezért a lap mondata ezt külön kimondja (`minorsTaxNote`). A mondat soha nem állít
  többet, mint amit a szám tesz.
- **A gyerekszámot MINDIG megkérdezzük** (ADR-0388). A számolt gyermek korhatára a tulaj
  gyerek-korhatára, ha a kérésre gyerekár vonatkozik, különben 17 („18 év alatt”, ez csak az
  IFA-ra hat) — `countedChildAge`. A létszám mindenhol „N fő, ebből K gyermek”.
- **Felső határ = a választott egység férőhelye** (ADR-0389, `overCapacity`/`capacityError`,
  `src/booking/requests.ts`). A szelvény megáll, a szerver elutasít.
<!-- distill:end -->

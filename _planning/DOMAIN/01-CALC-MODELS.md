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

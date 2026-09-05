# 2026-09-05/06 — Az Elek ALL-IN kör TELJES + tulaj-triázs javítás-köteg (ADR-0096)

## Mi történt

**Az ADR-0095 ALL-IN megbízás minden szakasza lefutott és kiértékelve — a teljes üzleti
hurok gépileg igazolt:** mock-generálás (FK-003b) → kiküldés élesben elek@-ra (FK-004) →
levél→link→mock→mérés (FK-004b) → önkiszolgáló VÁSÁRLÁS a mock-gateway-en, tenant-születéssel,
belépő- és számla-levéllel (FK-005a) → tenant-admin belépés a levélbeli jelszóval, Dokumentumok
+ Üzenetek (FK-001) → Modulok-fül (FK-002) → fizetés bukás-mátrix: elutasítás/vissza/újrapróba/
dupla-katt, 3 számla = 3 valós terhelés (FK-005b). Jelentések a `/test-log/<FK>/report` linkeken.

## A kör NAGY fogásai (mind javítva, landolva)

- **Mirabella-banner mock-HERO:** idegen domainű reklám-kreatív a vouch-olt adatlapról →
  §B.17 cross-site fotó-kapu (ADR-0096 ④, fixture-párral).
- **Kép-méregpirula:** letölthetetlen fotó plain-URL-ként az API-nak → az EGÉSZ brief-hívás
  400, néma generikus szöveg → ejtés-szabály (ADR-0096 ⑦).
- **Néma fizetés-elnyelés:** a mock-fizetőoldal gombja Barion-konfigú processzen a konfigurált
  parseren veszett el — „Sikeres fizetés" felület, pending payment → applyWebhookResult
  (parse-mentes út) + ismeretlen ref hangos hiba.
- **Valódi Barion sandboxig jutó teszt-vásárlás** → gépi PAYMENT_GATEWAY=mock ELEK_RUN alatt
  (ADR-0096 ①).
- **Teszt-lead valódi idegen telefonszámmal/e-maillel** (klón-forrásból) → seed telefon/
  contacts-semlegesítés; a fő-fás konzolon egy katt valódi MMS-t indított volna.
- **Elek vakon jóváhagyott őr-bukott mockot** → verdikt-kapu a kurációban (ADR-0096 ②).
- **Fulfillment-kapu élő tenantot blokkolt** (rég elutasított prospect-mock alapján) →
  hatókör kind=initial (ADR-0096 ⑤).

## Tulaj-triázs (2026-09-05/06) — MIND LEZÁRVA

Fizetés-őszinteség (dupla-katt „már rendezve"; egyszeri díj nem „/ hó"; hiba nem siker-zöld +
nyelv-kijelölés túlél; aktiválás-oldalon összeg) · üdvözlő-kupon LÁTHATÓ ár (ADR-0096 ⑥) ·
„Bővítés" szekció üres-állapota ALL-IN után · vevő-hangnem egységesen magázó (multilang-kártya,
hibasáv, belépő-levél, support-sor) · üzenet-sorokon időpont · „A(z)"→huArticle névelő ·
aláírás/support-cím env-ből olasz.ferenc@citoviso.com (lokál .env igazítva; PROD eleve jó) ·
link-panel mondja, melyik mockhoz készül · mailbox „Cit oviso" fejléc-fix · runner
raszter-szellem fix (settle a sticky-csere UTÁN). Igazolás: FK-001 3/0, FK-002 4/0,
FK-005b 5/0 zöld újrafutás + élő draft-nézet ellenőrzés.

**Lelet-cáfolatok:** az „az árban" chip + mindig-aktív gerinc-sor LÉTEZIK (kiértékelői tévedés);
a „Saját domain 6000 Ft/év" NEM maradvány (vevő-ár; a 15 €/év a mi plafonunk, 8000 Ft/hó felett
ingyen); B6: élesben `PUBLIC_SITE_URL=https://citoviso.com` → az aldomain-ígéret teljesül, a
nyers IP dev-jelenség.

## ⚠️⚠️ NYITOTT — TULAJ-FIGYELMEZTETÉS (minden sessionben szem előtt!)

1. **🔴 ONLINE FOGLALÁSI MODUL (booking) MŰKÖDÉS-TISZTÁZÁS — a tulaj szava (2026-09-06):
   „az online foglalási modul működését kell tisztázni, mert szerintem vannak benne lukak".
   Mielőtt booking-ot érintő munka indul, EZT kell tisztázni: spec-átvilágítás + Elek-kör
   (elérhetőség/ütközés/dupla-foglalás/visszaigazolás-lánc?).**
2. Régió-származtatás koordinátából — külön kör (jóváhagyva; 15 déli parti lead
   `balaton-north` alatt, a generálásba is befolyik).
3. ÁFA-kör (AAM-értékhatár figyelés + árkommunikáció) — a tulaj hívja le.
4. Hangnem-őr hatókör-bővítés a tenant-adminra (a magázó javítás kész, az őr még nem fogja).
5. „havi= 3900" QP-maradvány-gyanú a levél-szövegben — watch.
6. FK-006 időutazó-setup (dunning-állapotok) — az ALL-IN térkép utolsó eleme.

## Módosított/új fájlok (a session commitjai: 0d60fe3…be09019 + memória)

elek/: scenarios (FK-003b/004/004b/005a/001/002/005b + SCENARIO-FORMAT bővítések: várj[mp],
${ENV}, tedd?:, vissza), bin (runner sticky/lazy/settle/gateway-guard, mailbox MIME+unfold,
save-test-log, report-html) · src/: console (views, server: favicon, mock-pay, tab-fix-műtermék
igazolás), payment/service (applyWebhookResult, summary.amount, kapu-hatókör), server (public,
adminViews: kupon-ár, üres-állapot, magázás, fmtDateTime, favicon), outreach/draft (huArticle),
email/loginEmail (magázás), scraper photoQuality (cross-site) + photo-quality-check fixture,
generator/images (inline-drop), marketCheck (Étterem/Reggeli bucket), i18n catalog ·
kb: console-lead, console-leads, admin-modules · scripts/seed-elek-lead (mérce+vouch+telefon).

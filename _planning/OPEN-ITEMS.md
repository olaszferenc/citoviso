# NYITOTT TÉTELEK — teljes leltár

*Felmérve: 2026-09-09 · forrás: `PILOT-GO-LIVE-INVENTORY.md` + a `_planning/memory/` szeptemberi
session-jegyzeteinek „Nyitott" szakaszai + mérés a kódon/DB-n. Csak olvasás.*

> **Egy mondatban:** a gépi oldal lényegében kész és **59 committal / 7 migrációval előrébb jár,
> mint az éles** — a fizetős kör mégsem zárul, mert **3 külső fiók hiányzik**, és azok mind
> rád várnak. Minden más ez alatt sorakozik.

---

## ⛔ A) RÁD VÁR — e nélkül a fizetős kör NEM zárul

| # | Mi | Miért blokkol | Állapot |
|---|---|---|---|
| A1 | **Barion ÉLES bolt** | e nélkül nincs kártyás fizetés — a prod ma `PAYMENT_GATEWAY=mock` | ⛔ nyitva · **leghosszabb átfutás, ez a kritikus út** |
| A2 | **Számlázz.hu éles kulcs** | fizetés számla nélkül jogilag nem mehet; a prod ma a teszt-fiók kulcsát viszi | ⛔ nyitva |
| A3 | **Registrar: kredit + ToS** (Websupport, olaszferenc/3213041) | a fiók kreditje 0 Ft és a ToS nincs megerősítve → a domain-vétel **fail-closed**, nem vesz | ⛔ nyitva |
| ~~A4~~ | ~~Citoviso saját GBP~~ | — | ✅ **KÉSZ (2026-09-09)** → az ADR-0107 **60 napos órája elindult**, az API-jóváhagyás ~2026-11-08-tól kérhető |

**Ha csak egyet csinálsz:** az **A1**. A másik kettő napok, a Barion-jóváhagyás hetek lehet.

### A4b — időzített bombák a registrar-fiókon (rád + rám vegyesen)
- a megerősített `citoviso.hu` registrant-adata **kevert** (név: Olasz Ferenc, de azonosító =
  Mineral cégjegyzékszám, értesítési cím = `info@minerallog.hu`) → registry-ellenőrzésen fennakadhat
- `autoExtend=false` → **egy év múlva szó nélkül lejár**, az értesítő a Mineral-postafiókba megy
- a #211604 fiók-átadás 30 napos ablaka fut, senki nem figyeli
- a minerallog jelszó + API-kulcs cserélendő/visszavonandó *(ez tisztán rád vár)*

---

## 🚀 B) A NAGY ÉLESÍTÉS — kész, de a te kimondott engedélyedre vár

**Mérve ma:** az éles `dbbd5a7`-et futtat, az `origin/main` **59 committal**, **7 migrációval**
és **9 ADR-rel** jár előrébb. Ebben van minden, amit szeptemberben építettünk:

- ADR-0109 saját cím havi díjas · ADR-0110 tenant jogi lábazat · ADR-0111 piac-kapu ·
  ADR-0112 SMS meghívás · ADR-0113 fizetés-kapus modul · ADR-0114 egész szállás kizárása
- Forgalom fül + havi forgalmi levél · a mentés-nem-publikál javítás · a mai §C-kapu javítás

**A menete (egy ülés, gép csinálja):** KB-javítások → `kb-shot` → tudásbázis-őr *(számolj 3–5
körrel, minden körben valódi hibát talál)* → `kb-gate` token *(24h-ig él!)* → `deploy-prod.sh
<sha> --go` → ⚠️ **a `citoviso-traffic-mail.timer` kitétele** a másik három mellé → élesi
verifikáció 390px-en is.

> A B-blokk **nem függ az A-tól** — a kód kimehet a fiókok nélkül is. De amíg az A nyitva,
> a kint lévő rendszer **nem tud pénzt beszedni**, tehát a teljes kör mérőpróbája nem igaz.

---

## 💰 C) KONVERZIÓT ÉRINT — nem blokkol, de pénzt visz

| # | Mi | Mért tény |
|---|---|---|
| C1 | **Az aurora sablon kiveri a helyéről a vásárlási belépőt** | mérve: a prospect-konfigurátor indító gombja aurora mockon a lap legaljára esik (y≈14 000, a cinematicon helyesen fixed y=769) — **aurora-mock kiküldésekor a vevő nem találja a belépőt** |
| C2 | **A Forgalom választható nézete nincs lekódolva** | a terv jóváhagyva (Naponta / Hetente / Honnan és mivel / Csak a számok), a kód nem készült el |
| C3 | **A „következő számla" bontásából hiányzik a domain éves díja** | a `billing.ts` ráteszi a fordulónapos számlára → az évfordulós hónapban **többet terhelünk, mint amit a vevő olvas**. Ma nem érhető el (nincs élő tenant saját domainnel), legkorábban 1 év múlva sülne el. §2b terv-kaput igényel |
| ~~C4~~ | ~~landing „megtalálnak a térképen"~~ | ✅ **MA JAVÍTVA** — a Maps/GBP-ígéret kikerült (6 helyen), a keresős állítás maradt, mert azt tényleg szállítjuk (sitemap, robots, JSON-LD, canonical, og:) |

---

## 🔧 D) GÉPI ADÓSSÁG — halmozódik, egyik sem sürgős külön-külön

- **Migráció-sorszám-ütközésre MÉG MINDIG nincs őr.** Ma mérve: **két `0059`** vár élesítésre
  (`tenant_message_traffic` + `unit_whole_property`). Ez a **negyedik** eset (0051×2, 0052×2,
  0053×2, 0059×2). Most **ártalmatlan** — a `schema_migrations` a teljes fájlnevet jegyzi, a
  kettő független táblát érint, a sorrend determinisztikus —, de eddig minden alkalommal
  szerencse döntött, nem szabály.
- **A `module-config-check` 8 állítása elavult** (a `main`-en is piros, nem egy szál hibája).
- **Az országonkénti jogi csomag TARTALMA** hiányzik: a `legal.ts` egyetlen, magyar csomagot
  ismer. A piac-kapu (ADR-0111) csak a KÉRDÉST teszi fel — a második piac megnyitása előtt a
  szövegeknek ország szerint kell szétválniuk. Ugyanez a pénznem/árazás (`module_price` globális HUF).
- **A levél-kapunak nincs feladó-azonosítás szabálya** (az SMS-nek van) — ma nem éles rés, de
  a szimmetria hiányzik.
- **14 régi terv-kontraktus áll kép nélkül**, 9 jelöl feliratot hatókör nélkül.
- **Új gyerektábla + CASCADE = néma kimaradás a purge mentéséből** — erre sincs őr (a 09-08-i
  purge két táblát így hagyott ki).
- **A `pl` nyelvi csomag KB-fordítása 18/19** (egy entrynél integritás-sértés).
- **A nem-live tenant-pillanatképek a régi runtime-ot hordozzák** a következő rerenderig.
- **`_engine-proof` 242 MB** ül a fő fa `sites/` fájában (a mentésből tudatosan kimarad, de
  magától nem takarodik).

---

## 📋 E) FIGYELENDŐ / A TE DÖNTÉSEDRE VÁR

- **ÁFA-kör** (AAM-értékhatár figyelés + árkommunikáció) — a tulaj hívja le.
- **Dencs legacy booking+pricing sorok** (régi B-opciós, a 2027-es számlára várnak):
  **nullázzuk?** Enélkül az új, fizetés-kapus utat nem tudod végigtesztelni ugyanazon a tenanton.
- **STOP-válasz feldolgozása** SMS-re nincs (ADR-0083 óta); a hordozó-lábazat magyarul beégetett.
- **ADR-0088 ① kedvezmény-mondat:** teljes törlést kértél, ma a szürke lábjegyzetben ül —
  ADR-döntés kell hozzá.
- **`OUTREACH_SENDER_PHONE` / `LEGAL_ENTITY_PHONE`:** kerüljön-e telefonszám a levelekbe és az
  impresszumba?
- **Régió-származtatás koordinátából** — jóváhagyott, még el nem indított külön kör
  (15 déli parti lead ma `balaton-north` alatt ül, és ez a generálásba is befolyik).
- **FK-006 dunning-időutazó** — az Elek ALL-IN térkép utolsó eleme.
- **Google Fonts self-host** — megszüntetné a font-célú IP-továbbítást.

---

## Amit MA lezártunk (hogy ne kerüljön vissza a listára)

- §C megkeresés-kapu: hamis FLAG (token `xXx`, 1:1637) **és** hamis PASS (névtelen tömeg-levél
  PASS-t kapott, mert a név és a keretezés az URL slugjából teljesült) — mindkettő javítva,
  az őr mindkét csatornát méri, RED-kontrollal.
- Dev DB mentése: nulláról napi 4×, önellenőrző, ellenőrzőösszeggel (kiderült: a
  visszaállítás-próba **vak volt a csonkolásra** — az éles mentés is megkapta a javítást).
- Landing: a Maps/GBP-túlígéret kivéve.

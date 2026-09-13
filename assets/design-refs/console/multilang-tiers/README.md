# Kontraktus — Többnyelvű honlap: 29 nyelv, három sáv

**Jóváhagyva:** 2026-09-13, tulajdonosi döntés a §2b terv-körben (A/B/C változatból az **A**).
**Kiváltó:** tulajdonosi bejelentés — „nagyon kevés nyelvre lehet lefordítani a honlapot a
vásárolható modulok között. Legyen már ennél jóval több. Pl.: EU országok nyelvei."
<!-- ⚠️ A Hatókör EGY SORBAN maradjon: a contract-drift-check egyetlen sort olvas belőle,
     ezért a tördelés NÉMÁN leszűkítené a hatókört az első sorra (mérve 2026-09-13). -->
**Hatókör:** `src/i18n/lang.ts`, `src/i18n/mail.ts`, `src/ui/flags.ts`, `src/modules.ts`, `src/pricing.ts`, `src/tenant/multilangCard.ts`, `src/tenant/multilangOrder.ts`, `src/server/adminViews.ts`, `src/console/views.ts`, `src/console/server.ts`
**Kapcsolódó:** ADR-0128 (ez a döntés), ADR-0063 (a modul; §2 „fix 3 nyelv" FELÜLÍRVA),
ADR-0036 (nyelv = paraméter, `language_pack`), ADR-0113 (a kapu az íráson),
03-INVARIANTS §B.17 (tényhűség), §B (saját ikon-készlet, emoji tilos).

A `multilang-tiers.html` a jóváhagyott terv — **kattintható**, valós viselkedéssel. A „Mobil
390px / Asztali" váltó egy fájlban mutatja mindkét elrendezést. Ha a szállított felület ettől
eltér, **a terv a mérce, nem a kód.**

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

### 1. A választható kör 29 nyelv — egy forrásból

Az EU 24 hivatalos nyelve **+ szerb, ukrán, orosz, török, norvég**. A site elsődleges nyelve
(magyar oldalnál a `hu`) **célnyelvként nem választható**, ezért a picker 28 elemű.

- A lista **egyetlen forrásból** származik (`LANG_NAME`, `src/i18n/lang.ts`). A felirat, ami
  a számot mondja („Választható: 28 nyelv"), **szerkezetileg ebből a listából** számolódjon,
  ne kézzel beírt szám legyen (`feedback_label_must_derive_from_predicate`).
- ⛔ **A site-nyelvek listája NEM azonos az operátor-konzol nyelveinek listájával.** Ma
  ugyanaz a `supportedLangs()` táplálja a modul-választót és a konzol nyelvválasztóját
  (`console/views.ts` `langSwitcher`, `console/server.ts` `/operator/lang`); a bővítés után
  a konzol **szűk, saját listán** marad. Indok: minden új konzol-nyelv első kattintása egy
  2405 stringes AI-csomagot + KB-fordítást indítana, addig a felület hu-fallbackre esik.

### 2. Három sáv, kártyaként a lap tetején

| Sáv | Kapacitás | Egyszeri díj |
|---|---|---|
| **Alap** | legfeljebb 3 nyelv | 14 900 Ft |
| **Bővített** | legfeljebb 6 nyelv | 22 900 Ft |
| **Teljes** | **mind a 28 nyelv** | 30 000 Ft |

- Minden kártya kimondja a **nyelvenkénti egységárat** is (`4 967` / `3 817` / `1 071 Ft / nyelv`)
  — ez teszi összehasonlíthatóvá a sávokat.
- Az árak **operátor-szerkeszthetők** maradnak (a mai `module_price` mintájára), a fenti
  számok a kód-alapértelmezés. A felület SOSEM írhat ki beégetett árat: mindig a futásidejű
  árból dolgozik (`feedback_placeholder_becomes_the_price`).
- Asztalon a három kártya egy sorban, mobilon egymás alatt.

### 3. Előbb sáv, utána nyelv — és a sapka LÁTHATÓ

A kiválasztott sáv adja a picker sapkáját.

- Ha betelt, a többi csempe **láthatóan kikapcsol** (halványítva, `disabled`), nem némán
  figyelmen kívül marad. A mérés szerint ez 25 csempe az Alap sávban.
- A sapka-sor kimondja az állapotot: **„Még {n} nyelvet választhat UGYANEZÉRT az árért."**,
  illetve betelten: **„Betelt a csomag — nagyobb sávra váltva választhat többet."**
- **Sávot LEFELÉ váltva a fölös jelölés lekerül**, és ezt az összegző darabszáma azonnal
  mutatja. ⛔ Néma csonkítás tilos.

### 4. A Teljes sávban nincs mit választani

A picker helyére a **28 nyelv olvasható felsorolása** lép (zászló + magyar név), és a
sapka-sor kimondja: „A teljes csomagban nincs mit választani — mind a 28 nyelv elkészül."
A felület nem kérdez olyat, aminek nincs tétje.

### 5. Az összegző: a legnagyobb szám az, amit fizet

`<Sáv> csomag · N nyelv · egyszeri díj` + alatta **nagyban a fizetendő összeg**. A gomb
megismétli az árat: „Fizetés és generálás (14 900 Ft)".
Kupon esetén a mai kártya szabálya él tovább: az áthúzott listaár **és** a ténylegesen
fizetendő is látszik (ADR-0088 §6) — az összegzőben a fizetendő a nagy szám.

### 6. ⛔ A mobil ár-sáv a kártyán KÍVÜL él

**Mérve:** a `.adm-card` `overflow:hidden`, ezért AZ lesz a `position:sticky` elem
scroll-konténere — a kártyán belül a ragadó sáv **néma no-op** (1:1 görög a lappal).
A teljes-lapos screenshot ezt **zöldnek mutatja**, mert a sticky elemet a végleges helyére
festi; csak a végigkattintás fogta meg.

- Mobilon (`@container (max-width:430px)`) a kártyán belüli összegző elrejtőzik, és a
  kártya testvéreként álló **tapadó sáv** viszi ugyanazt.
- A két példányt **egy forrás** tölti (egy `render()`, `setAll()`) — két megjelenítés,
  nem két igazság (`feedback_one_rule_two_copies`).

### 7. A lista régiók szerint tagolt

Szomszédok · Közép-Európa · Nyugat-Európa · Dél-Európa · Észak-Európa · Kelet-Európa.
A csempe: **zászló + magyar név**, alatta az **endonim** (`Slovenčina`, `Ελληνικά`).
390px-en az endonim elrejtőzik, a rács 2 hasábos; asztalon `auto-fill` 168px-től.

### 8. Zászló: inline SVG mind a 29-re, emoji SOHA

A `src/ui/flags.ts` egyszerűsítési elve érvényes (20×14 px-en felismerési jel, nem címer).
⛔ **A `flagSvg()` ma ismeretlen kódra ÜRES stringet ad** — 19 új zászló nélkül a bővítés
zászló nélküli, csupasz neveket eredményezne a **vendég-oldali** nyelvváltón is. A jóváhagyott
tervben mind a 29 megvan; ezek mennek át a kódba.

---

## Nyitott, a terven KÍVÜL (külön szál)

- ⚠️ **Nem-latin írás:** görög, bolgár, orosz, ukrán, szerb. A sablonok Google Fontsai
  (Fraunces, DM Serif Display, Space Grotesk) jórészt latin-only → ezeken a nyelveken a lap
  rendszer-fontra esik vissza. A modul ettől még eladható, de a tipográfia nem az, amit
  terveztünk. Mérendő és javítandó.
- ⚠️ **Vendég-adatból ajánlás (a C változat ötlete):** a Places API visszaadja a vélemény
  nyelvét (`languageCode`, `scraper/sources/googleMaps.ts`), de a `PlaceReview` **eldobja** —
  nem tároljuk. Amíg nem tároljuk, a felület nem állíthatja, hogy „mértük" (§B.17).

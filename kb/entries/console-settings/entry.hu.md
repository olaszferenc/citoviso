---
id: console-settings
title: Beállítások — operátor-fiók, riasztások és jelszócsere
audience: operator
category: system
anchors: console.settings
updated: 2026-09-12
---

A **„Beállítások”** képernyőn látod a saját operátor-fiókod adatait, itt állítod be az
üzemi riasztások címzettjeit, és itt cserélsz jelszót. A konzol nyilvános
hosztingon is él (nem a hálózat véd, hanem a belépés) — az erős jelszó ezért nem formalitás.

![Képernyőkép: a beállítások képernyő telefonon](assets/hu/screen.png)

## A fiók-adatok

A **„Fiók”** panel a nevedet, a felhasználónevedet és a szerepkörödet mutatja. Ezek itt nem
szerkeszthetők — új operátort vagy szerepkör-módosítást a rendszergazda vesz fel.

## Üzemi riasztások — ide szól a rendszer

Itt adod meg, **hova szóljon a rendszer, ha baj van**. Ugyanez a két címzett kapja az
összes üzemi riasztást:

- az **AAM-keret** (alanyi adómentesség, 18 M Ft/év) 80%-a és 100%-a — évente és
  küszöbönként egyszer;
- a **törött MMS+SMS pár** (a leadnél kép maradt link és leiratkozás nélkül);
- a **.hu Nyilvántartó megerősítő linkje**;
- a **kifizetett, de többszöri automatikus próbálkozás után sem elkészült
  modul-generálás** — ilyenkor a vevő fizetett, a termék pedig nincs meg;
- a **megrekedt rendelés** — a vevő végigment a konfigurátoron és megrendelt, de fizetési
  linket nem tudtunk kiadni neki (például mert a mockját a kurátor elutasította, vagy a
  fizetési szolgáltató hibázott). A rendelés rögzült, a pénz nem.

### Mit tegyél megrekedt rendelésnél?

A levél megírja a lead nevét, az összeget, a vevő e-mail címét, a rendelés azonosítóját és
az elutasítás okát. A vevő közben azt a tájékoztatást kapta a képernyőn, hogy **egy
kollégánk felveszi vele a kapcsolatot** — ez a levél az a kolléga, tehát a labda nálad van.

A levélben szereplő elutasítási ok dönti el, mi a teendő. (Ha ott `unknown` áll, az
rendszerint lezárt piacot jelent: a vevő országára nincs jóváhagyott jogi csomag.)

**Ha a gomb látszik — `gateway_error` és a legtöbb egyéb ok.** Nyisd meg a lead lapját,
menj a **„Csomag és fizetés”** fülre, és a rendelés sorában koppints a **„Fizetési kérés
küldése ▸”** gombra. Ez a MÁR beküldött rendelésre adja ki a linket, újrarendelés nélkül.
⚠️ A felület erre nem ír vissza semmit: az eredményt onnan látod, hogy a rendelés sorában
megjelenik egy **fizetés-sor** (`fizetés: pending`) a link-kel.

**Ha a gomb NEM látszik.** Két oka lehet, és egyiket sem a konzolon kell megoldani:

- **A rendelés alatt már van függőben lévő fizetés-sor.** A gomb ilyenkor szándékosan
  eltűnik (nehogy két linket adjunk ki ugyanarra). Ha az a sor egy korábbi, sikertelen
  próbálkozásból maradt ott, a rendezéshez **fejlesztői beavatkozás kell** — jelezd.
- **A rendelés már ki van fizetve** — ilyenkor nincs is dolgod.

**Ha a mockot elutasították (`mock_rejected`).** Ez az egyetlen ok, amit szándékosan NEM
old fel semmi: az elutasítás a te kimondott nemed a mock tartalmára, és egy elutasított
mockot nem élesítünk. A felületen ezért nincs „mégis jóváhagyom” gomb rajta, és az sem
segít, ha új mockot generálsz: a rendelés ahhoz az artifacthoz van kötve, amit a vevő
látott, és ez a kötés utólag nem íródik át. Ilyenkor a helyes lépés: **keresd meg a vevőt**
(a levélben ott a címe), és ha üzletileg rendben van, kérd meg, hogy a friss, jóváhagyott
mock linkjén adja le újra a rendelést.

> 🔧 **Ismert korlát (2026-09-13).** A megrekedt rendelés helyreállítása ma két ponton
> hiányos: a függőben ragadt fizetés-sor eltünteti az egyetlen gombot, és az elutasított
> mockhoz kötött rendelés nem irányítható át egy új mockra. Mindkettő ismert, a javítás
> külön feladat — addig a fenti kerülő utak élnek.

Az **„Üzemi riasztások — ide szól a rendszer”** panelben:

1. **„SMS-szám”** — a riasztó SMS címzettje. Üresen hagyva a gép-szintű alapértelmezett
   szám érvényes (ha van ilyen beállítva — a mező halvány szövege mutatja); azt is a
   rendszergazda kezeli.
2. **„E-mail címek”** — a riasztó levél címzettje. **Több cím is megadható, vesszővel
   elválasztva** (pl. a céges és a magán fiókod is). Üresen hagyva az e-mail csatorna
   kikapcsolva.
3. Koppints a **„Riasztási címzettek mentése”** gombra. Siker esetén zöld visszajelzést
   kapsz; hibás telefonszámnál vagy e-mail címnél a panel **megnevezi, melyik cím** nem
   jó, és ilyenkor a mentés NEM történik meg — nehogy azt hidd, hogy mind a három címre
   megy a riasztás, miközben csak kettőre (a telefonszámot 06-os alakban is beírhatod, a
   rendszer +36-osra alakítja).

## Honnan tudom, hogy tényleg megérkezik a riasztás?

A mentés önmagában nem bizonyíték: attól, hogy a mezőben ott a cím, még nem biztos, hogy a
levél át is megy (elgépelés, spam-szűrő, lejárt postafiók). Van rá egy **próba**, ami valódi
SMS-t és levelet küld a beállított címzetteknek:

```
npx tsx scripts/alert-drill.mts        # szárazon: kiírja, kinek menne
npx tsx scripts/alert-drill.mts --go   # ÉLES: tényleg küld
```

A próba felállít egy eldobható, `PRÓBA-RIASZTÁS (nem valódi ügyfél)` nevű tenantot,
végigfuttatja rajta a feladás-sorozatot, kiváltja az igazi riasztást, majd mindent
visszatakarít. AI-költséget nem termel. A tenant neve szándékosan kimondja, hogy próba —
egy riasztás, ami valódi ügyfélnek látszik, rosszabb, mint a hiány.

## Jelszó módosítása

A **„Jelszó módosítása”** panelben:

1. **„Jelenlegi jelszó”** — a mostani jelszavad (enélkül nem enged tovább; így egy őrizetlenül
   hagyott gépen sem tud más jelszót cserélni).
2. **„Új jelszó (min. 8 karakter)”** — az új jelszó. Hosszú és megjegyezhető a jó: három-négy
   összefűzött szó erősebb, mint egy rövid, kriksz-kraksz jelszó.
3. **„Új jelszó még egyszer”** — elgépelés ellen.
4. Koppints a **„Jelszó mentése”** gombra. Siker esetén zöld visszajelzést kapsz; hibánál a
   panel megmondja, mi nem stimmelt (pl. a két új jelszó nem egyezik).

A csere azonnal él, a következő belépésnél már az új jelszó kell. Kijelentkezni a fejléc
„Kilépés” linkjével tudsz.

## Elfelejtett jelszó

Belépett állapotban itt cserélsz; ha kizártad magad, a belépő-oldal „Elfelejtett jelszó?"
útmutatója szerint a rendszergazda tud új jelszót beállítani.

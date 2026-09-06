---
id: console-lead
title: Lead-lap — a munkafolyamat: adat, mock, kuráció, megkeresés, konverzió
audience: operator
anchors: console.lead
updated: 2026-09-06
---

A lead-lap a napi munka szíve: itt fut végig egy szereplő a teljes láncon —
adat-ellenőrzés → mock-generálás → kurátori döntés → megkeresés → konverzió.

![Képernyőkép: a lead-lap telefonon](assets/hu/screen.png)

## A fejléc — mielőtt bármit csinálsz

A név melletti badge a honlap-kvalifikáció; a tény-sávban ország, város, régió, cím, a talált
honlap (kattintható), a **„Match-konfidencia”** (mennyire biztos, hogy a begyűjtött adatok tényleg
erről az üzletről szólnak — alacsony értéknél ELŐBB ellenőrizz, csak utána generálj), és a
legutóbbi mock állapota.

## Begyűjtött adatok

A **„Begyűjtött adatok — szerkeszthető”** panelben pótolhatod és javíthatod, amit a scrape hozott;
a mentett érték a következő mock-generáláskor már érvényes. Azt, hogy melyik mező honnan jött
(forrás + konfidencia, kattintható forrás-linkkel), az **Audit** fülön a **„Provenance (A4)”**
lenyíló táblázat mutatja. Ha az adat hiányos vagy gyanús, az **„Adatok újragyűjtése”** gomb
friss webes keresést futtat erre az egy leadre.

## Mock-generálás

A generáló panelben a **„Kinézet-típus”** kártyákon kiválasztod az elrendezést (a kurátor dönt),
majd a gombbal indítod. A „generálás folyamatban…” jelzés alatt az oldal magától frissül
(~1–2 perc). Az elkészült mock az „előnézet ▸” linken nyílik.

## Kuráció — ember dönt

Minden mockon két gomb: **„Jóváhagyás”** és **„Elutasítás”**. Kiküldeni CSAK jóváhagyott mockot
lehet — ez kőbe vésett szabály, a rendszer nem enged vak auto-sendet. Elutasításnál a mock a lap
alján az „Elutasított mockok” csoportba kerül, és bármikor generálhatsz újat.

## Megkeresés

A **„Megkeresés — követett link”** panel prospect-linket készít a jóváhagyott mockhoz. Az
**„E-mail / SMS megnyitása — küldés ▸”** gomb az Outreach-piszkozat KÉPERNYŐRE visz — ott fut le
a §C-jogszerűségi kapu, ott választasz csatornát, és onnan küldi ki a levelet maga a rendszer
(részletes útmutató: a Súgóban az „Outreach-piszkozat" téma). Ha kézzel, a saját leveleződből
küldtél, a **„Kiküldve — mérés indul”** gombbal jelzed — innentől méri a rendszer a megnyitást
és az aktivitást (Tevékenység-gomb).

## Ha a soron „leiratkozott” áll

A leiratkozott prospect sorában piros címke jelzi a leiratkozást a dátumával, és a küldés-gomb
eltűnik. Alatta egy dobozban látod a leiratkozás-naplót: mikor, ki, és — visszavonásnál — mire
hivatkozva.

⚠️ **Egy leiratkozás több sort is némává tehet.** A tiltás nem a linkhez tartozik, hanem a
SZEMÉLYHEZ: ha ugyanaz az e-mail-cím vagy telefonszám bárhol máshol leiratkozott, a rendszer
oda sem küld. Ezért fordulhat elő, hogy egyetlen kattintás után több leadnél is elakad a küldés
— ilyenkor azt a sort kell megkeresni, ahol a piros címke áll.

### A leiratkozás visszavonása

A doboz **„Leiratkozás visszavonása ▸”** sorára koppintva nyílik ki az űrlap. Írd be az
indoklást, majd **„Visszavonás”**. Az indoklás kötelező — üresen vagy pár betűvel a rendszer
nem engedi el.

⛔ **Ezt csak akkor teheted meg, ha a címzett MAGA kérte** (telefonon, e-mailben, személyesen).
A leiratkozás jogilag a címzetté, nem a miénk. Amit beírsz, a naplóba kerül a felhasználóneveddel
együtt, és ott is marad — ez a bizonyíték arra, hogy volt jogalapod. Ha nincs ilyen kérés,
hagyd a leiratkozást érvényben.

Visszavonás után a piros címke eltűnik, a küldés-gomb visszajön, a napló pedig megmarad a soron.

## Konverzió

Ha a tulaj megrendelt, a jóváhagyott mock alatti űrlapon a **„Konvertálás privát előnézetbe ▸”**
gomb indítja az élesítést — a modulok a tulaj konfigurátor-választásából jönnek, nem kézből.

## Diszkvalifikálás

Ha a szereplő biztosan nem célpont, a lap alján a **„Diszkvalifikálás”** panelben indokkal
kivezetheted — megmarad, az újra-scrape sem hozza vissza, és bármikor visszavonható.

---
id: console-partner-page
title: Partner-lap — egy vevő vagy szállító adatlapja
audience: operator
category: finance
anchors: console.partner
updated: 2026-11-03
---

A partner nevére kattintva (a **„Partnerek”** listából) nyílik a partner-lap: egy vevő vagy
szállító minden adata egy helyen — kicsoda, mit fizet, mi a domainje, mi vár rá, és mi történt
vele. A vevő marketing-oldala (mock, megkeresés) a lead-lapon marad; az **„Áttekintés”** fül
„Kapcsolatok” kártyáján a lead neve oda visz át.

![Képernyőkép: a partner-lap telefonon](assets/hu/screen.png)

## A fejléc

A számlázási név alatt a cím és az, hogy mióta partnerünk. A jelvények: vevő és/vagy szállító,
az előfizetés állapota, az oldal állapota és a saját domain állapota (amelyik van).

A csempék vevőnél: **„havi díj (listaár)”** (a bekapcsolt modulokból), **„következő
terhelés”** (dátum, az összeg és a mentett kártya — ugyanaz az összeg, amit a vevő a saját
adminjában lát; az első fizetés megkeresési kedvezménye nem újul meg), **„kintlévőség”** és
**„aktív modul”**. Szállítónál: **„éves költség”** és **„tartozásunk”**. Az összegek devizánként
külön állnak.

## Az **„Áttekintés”** fül

Felül a **„Figyelendő”** lista — csak az, ami figyelmet kér: a saját domain a .hu Nyilvántartó
megerősítésére vár vagy beállítás alatt van; a domain lejárata még becsült (a napi szinkron még
nem olvasta le a regisztrátortól); elmaradt fizetés, befagyasztás, lemondás; a mentett kártya
lejár a következő terhelés előtt; a partneren nincs telefonszám, de a leadben van. Ez utóbbinál
az **„Átveszem a partnerre”** link megnyitja a szerkesztőt a számmal kitöltve — semmi nem
íródik, amíg nem nyomja meg a **„Mentés”** gombot.

Alatta kártyák: **Előfizetés**, **Domain**, **Kapcsolatok** (tenant, lead, oldal, a tulaj
belépési neve és utolsó jelszavas belépése) és **Számlázási adatok**. A **„Részletek”** link a
megfelelő fülre visz. Legalul a bizonylat-összesítő és a havi bontás.

## Az **„Adatok és kapcsolattartók”** fül — itt szerkeszt

A **„Szerkesztés”** gomb nyitja az űrlapot: számlázási (jogi) név, ország, irányítószám, város,
utca, adószám, közösségi adószám, céges e-mail, telefon, belső megjegyzés, és a
kapcsolattartók (szerep, név, e-mail, telefon, „elsődleges”). A **„Kapcsolattartó
hozzáadása”** új sort ad, a sor **„törlés”** gombja elveszi.

- **Ellenőrzés gépelés közben:** a magyar adószámnál az ellenőrzőszámot is nézi („Az adószám
  első 8 jegye nem érvényes — valószínűleg elgépelés.”), a telefont egységes alakra hozza
  (+36 30 123 4567), a hibát a mező alatt mondja meg. Szerepenként egy elsődleges lehet, és
  ha van számlázási kapcsolattartó, kell egy elsődleges számlázási e-mail — oda megy a számla.
- **Ha a céges e-mailt átírja,** megkérdezi: **„A számla-címzett (Számlázás, elsődleges) is
  erre változzon”** — alapból igen.
- **Mire hat a mentés:** a következő számla, díjbekérő és megújítás ezt használja. Nem
  változik a már kiállított számla, a rendeléskori nyilatkozat, a lead neve és címe, és a tulaj
  belépési e-mailje. Ha a vevő egy újabb rendelésnél új számlázási adatot ad meg, az felülírja.

Mentés után a fül címe mellett **„Mentve”** áll, az időponttal. A **„Mégse”** elveti a változást (ha
volt, előbb rákérdez).

## Az **„Előfizetés”** fül — csak vevőnél

Modulok száma, havi díj (listaár), a folyó időszak, a következő terhelés (dátum, összeg,
automatikusan kártyáról vagy díjbekérővel), a mentett kártya (márka, utolsó 4 jegy, lejárat),
az állapot (aktív / elmaradt fizetés / befagyasztva / lemondva), az aktív modulok listája és a
**„Fizetések”** tábla (időpont, összeg, időszak, fizetési kapu, állapot).

## A **„Domain”** fül

A saját domain lépésenként (megrendelve → megvéve → Nyilvántartó megerősítés / DNS →
tanúsítvány → élő), a regisztrátor-azonosító, a megrendelés és az elkészülés ideje, a
**lejárat** („a regisztrátortól” vagy „becsült”), az automatikus megújítás állása, a
regisztrátor üzenete, és a platform-cím (….citoviso.com), amin az oldal addig is él.

## A **„Számlák”** fül (szállítónál: **„Bizonylatok”**)

A partner minden számlája és bizonylata egy listában, a sztornó negatív összeggel ugyanabban a
sorban. Szűrés a **„Típus: mind”** lenyílóval (pl. „Vevői számla”, „Szállítói számla”) és a
**„Fizetve: mind”** lenyílóval, valamint a forrás szerint (**„minden forrás”** /
**„rendszer-számla”** / **„kézi / importált”**) — kombinálhatók. A fizetésből automatikusan
kiállított számlák is itt vannak, a bizonylatszám alatt jelvénnyel: **„rendszer”** (rendben),
**„sztornózva”** vagy **„számla nem készült”** — az utóbbi kettő halványan listázódik, de nem pénz,
nem számít bele az összegekbe (részletek a Bizonylatok súgójában). A **„Korosítás (nyitott)”** tábla a
kiegyenlítetlen tételeket bontja lejárat szerint: Nem lejárt · 1–30 · 31–60 · 61–90 · 90+ nap.
A sor végi **„Számlakép ▸”** link a tárolt bizonylat-képet nyitja meg (ha van; rendszer-számlánál
a számlázótól kapott PDF-et); az **„Excel-export (CSV) ▾”** a szűrt listát tölti le Excelben
megnyitható fájlként.

## Az **„Aktivitás”** fül

A tulaj tevékenysége az adminjában és az oldal látogatottsága — fejlesztés alatt.

## Az **„Előzmények”** fül

Egyetlen időrendi idővonal a partner minden eseményéből, a legfrissebb elöl: a lead
megtalálása, a mock, a megkeresés és amit a címzett a mockon csinált, a megrendelések, a
fizetések (a sikertelen is), a számlák, az élesítés, a modul-bekapcsolások.

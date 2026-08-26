---
id: console-documents
title: Bizonylatok — minden számla egy kereshető táblában
audience: operator
anchors: console.documents
updated: 2026-08-25
---

A **„Bizonylatok”** menüpont a cég ÖSSZES bizonylatát mutatja egyetlen táblában — kimenő és
bejövő nincs külön szekcióra szedve: az irány csak szűrő, és nem külön oszlop (a **„Vevői számla”**
/ **„Szállítói számla”** típus úgyis megmondja, be- vagy kimenő-e). Így egy kereséssel megtalál
bármit, akárhonnan jött.

![Képernyőkép: a Bizonylatok lista telefonon](assets/hu/screen.png)

## A felső sáv — hol áll a pénz

A táblázat fölött négy szám, pénznemenként külön bontva (soha nem összeadva): mennyi **jár nekem**
(a még ki nem egyenlített vevői számlák), mennyit **fizetek** (a nyitott szállítói számlák), mennyi
a **lejárt**, és a **nettó pozíció** (a kettő különbsége). Ha több devizában is van tétel, a fő
összeg alatt kisebb sorban jelennek meg a többiek (pl. EUR, USD).

## Keresés és szűrés — az oszlopok alatt

A szűrők közvetlenül a táblázat sötét fejlécében ülnek, oszloponként: a **„Szám…”** mezőbe a
bizonylatszám, a **„Partner…”** mezőbe a név töredéke; a Típus lenyílója a fajtára szűr; a Kelte és
a **„Fiz. határidő”** alatt egy-egy tól–ig dátumpár (két naptár-mező: mettől meddig); a **„Pénznem”**
és az Állapot (fizetve / nyitott) szintén lenyíló. A szűrés a szerveren fut, tehát akkor is a teljes
adatbázisból keres, ha az több ezer sor. A lenyílók és a dátumok választásra azonnal szűrnek, a
szöveg-mezők gépelés után maguktól; minden aktív szűrő egy kis címkeként (chip) is megjelenik a
táblázat tetején, egyenként törölhető ✕-szel, vagy mind egyszerre a **„Szűrők törlése”** gombbal.
A letöltés mindig a szűrt listát adja (**„Excel-export (CSV) ▾”**).

## Lapozás — és amit fontos tudni róla

Egy oldalon 50 bizonylat fér el; a táblázat alján lapozó jelenik meg (**„Előző”** / oldalszámok /
**„Következő”**), mellette a tartomány: pl. „101–150 / 214 tétel”. Ha csak egy oldalnyi találat
van, a lapozó nem is látszik.

Két dolog szándékosan NEM az oldalra vonatkozik, hanem mindig a teljes szűrt listára: a felső sáv
négy száma (tehát a kintlévőség nem az 50 soré, hanem az összesé), és az Excel-export, ami akkor
is minden találatot letölt, ha épp a 3. oldalt nézi. Szűréskor a lista mindig visszaugrik az első
oldalra — így nem marad egy már nem létező oldalon.

## Mit mutat a tábla?

Bizonylatszám · Partner (a nevére kattintva a partner-lapra ugrik) · Típus · Kelte ·
**„Fiz. határidő”** · **„Esedékesség”** (ebből számolt emberi olvasat: „3 nap múlva” vagy
„9 napja lejárt”) · Nettó · Bruttó · **„Pénznem”** · Állapot · **„Számlakép ▸”** (a tárolt
bizonylat-kép, ha van). A sztornó negatív összeggel, halványan jelenik meg ugyanabban a listában.

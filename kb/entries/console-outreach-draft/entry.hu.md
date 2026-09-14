---
id: console-outreach-draft
title: Megkeresés-piszkozat — a jogszerűségi kapu, a küldés és a mérés
audience: operator
category: lead-path
anchors: console.outreach_draft
updated: 2026-09-13
---

Az **„Megkeresés-piszkozat”** képernyőn dől el, hogy egy megkeresés kimehet-e, és innen megy is ki —
ez a hideg megkeresés jogi kapuja és küldő-felülete egyben. A lead-lap Megkeresés-paneljéből
érkezel ide; ugyanez az útmutató szolgálja a Tevékenység-képernyőt is (lent).

![Képernyőkép: az outreach-piszkozat telefonon](assets/hu/screen.png)

## „Mehet ki most?” — a legfelső sor válaszol rá

A lap legfelső sora **azt** mondja meg, amit tudni akarsz: **„E-mail: most kiküldhető — a
küldő-út minden kapuja zöld”**, vagy **„E-mail: most NEM küldhető”**, és ilyenkor a
sor végén ott az OK is (például hogy ennek a prospectnek már kiküldtük az e-mailt, vagy hogy
a mock még kurátori jóváhagyásra vár). Ez a sor ugyanazt futtatja le, amit a küldés-gomb —
tehát amit itt olvasol, azt fogja a gomb is tenni.

## A jogszerűségi kapu — a jogi ítélet

Alatta a verdikt-pill: **„Jogszerűségi kapu: PASS”** vagy
**„Jogszerűségi kapu: FLAG — ez tiltja a küldést”**. ⚠️ A PASS azt jelenti, hogy a levél
JOGILAG rendben van — **nem** azt, hogy ki is mehet: a küldésnek több feltétele van (elhasznált
csatorna, jóváhagyatlan mock, leiratkozás). Ezért van fent külön a „mehet ki most?” sor.

FLAG esetén a piros lista megmondja az okokat — amíg ezek
nem rendeződnek, a levél SEMMILYEN csatornán nem küldhető ki (hideg megkeresés
csak jogszerűen mehet — leiratkozási link, elérhető feladó, a hirdető cégazonosítása, valós személyre
szabás).

Ha a feladó azonosítása a hibás, külön piros doboz sorolja fel **mezőnként**, mit kell
javítani („A feladó azonosítása nem szállítható”): melyik beállítás, mi az értéke most, és mi
a baj vele. Ezek az értékek a levél aljára nyomtatódnak, ezért a levél addig nem mehet ki.

⚠️ A **„⚠ Figyelmeztetés (nem blokkol)”** kezdetű sor NEM állítja meg a küldést — ahogy a
felirata mondja. Tájékoztat (például arról, hogy a levél linkjei nem a saját domainünkre
mutatnak), de a döntést a felső sor hozza.

Minden ok-sor NAGYBETŰS előtaggal kezdődik, ami megmondja, MIRŐL szól (LEIRATKOZÁS, FELADÓ, HIRDETŐ, SZEMÉLYRE SZABÁS, ÁR-HIRDETÉS, JOGALAP, ADATKEZELÉS, LINK, PIAC, FÉLREVEZETÉS, KERETEZÉS) — így a piros listát végig lehet futni anélkül, hogy minden mondatot elolvasnál.

A leggyakoribb FLAG-okok és mit kell tenni:

| Amit kiír | Mi a teendő |
|---|---|
| „LEIRATKOZÁS: a link a címzett számára elérhetetlen" | a `PUBLIC_BASE_URL` beállítás nem nyilvános HTTPS-cím — rendszergazdai javítás |
| „FELADÓ: az identitás kitöltetlen" | `OUTREACH_SENDER_*` beállítások hiányoznak |
| „HIRDETŐ: hiányzik / kitöltetlen a cégazonosítás" | a `LEGAL_ENTITY_*` beállítások (cégnév, székhely, nyilvántartási és adószám) — ugyanaz, amiből az impresszum is dolgozik. Ezt kitalálni TILOS: hideg levél a hirdető megnevezése nélkül nem mehet ki |
| „SZEMÉLYRE SZABÁS: a levél nem hivatkozik a lead nevére" | a lead neve hiányzik vagy hibás — a lead-lapon javítsd |
| „ÁR-HIRDETÉS: a levél árat hirdet, de az árazás még nincs véglegesítve" | Konzol ▸ Árazás, és pipáld be az **„Az árak véglegesek, élesíthetők”** kapcsolót |

## A levél tartalma

A **„Tárgy”** mező alatt két nézet: **„Így néz ki a levél a címzett postafiókjában (HTML-előnézet)”**
— ezt látod, amit ő látni fog —, és **„Levél szövege (text-változat — kézi küldéshez másolható)”**
a **„szöveg másolása”** gombbal.

⚠️ **Ha a levél MÁR KIMENT**, ugyanez a doboz átvált: **„Ez a levél már kiment — a másolás a
MÁSODIK példányt jelentené a címzettnek”**, a felirata **„A KIKÜLDÖTT levél szövege”** lesz, a
gomb pedig rákérdez, mielőtt másol. A szöveg szándékosan OLVASHATÓ marad — jogod van látni, mi
ment ki —, csak a felület nem tesz úgy, mintha a kézi küldés még hátra lenne.

⚠️ **Az előnézet a TELJES levelet mutatja, görgetés nélkül** — az aláírással, az apróbetűvel,
a leiratkozás-linkkel és a jogalap-lábazattal együtt. Ezt olvasd végig: a levél alja az, amitől
a hideg megkeresés jogszerű, és a küldés nem vonható vissza. (Ha a levél mégis külön lapon
kell: **„előnézet külön lapon ▸”**.)

**Hová mutatnak a levél linkjei?** A verdikt-pill alatt ott áll: „A levél linkjei ide mutatnak:
…". Ha ez PIROS, akkor a levél nem a saját domainünkre linkel — a címzett szemében ez
phishing-alak, és a leiratkozás is idegen gépre visz. Fejlesztő-gépen ez normális; ÉLESBEN
küldés előtt szólj, mert a `PUBLIC_BASE_URL` beállítás rossz.

## Küldés — csatornát választasz

A **„Küldési csatorna — válaszd, hogyan menjen ki (a két csatorna külön-külön egyszer küldhető):”**
blokk két kártyája:

1. **E-mail** — ha nincs címzett-cím, előbb írd be és **„Cím mentése”**. Utána a
   **„Küldés e-mailben —”** gomb (a címmel a feliratában) megerősítés után a RENDSZERBŐL küldi ki
   a HTML-levelet — nem a saját leveleződ nyílik meg. A kapu-ellenőrzések küldéskor a szerveren
   újra lefutnak. Kézi út is van: a text-változatot bemásolod a leveleződbe, és küldés után a
   lead-lapon a **„Megjelölöm kiküldöttként — mérés indul”** gombbal jelzed.
   ⚠️ **Miután a levél kiment, a cím-mező eltűnik**, és a kártya csak kiírja, hova ment: a cím
   utólagos átírása ezen már nem változtatna, ezen a csatornán pedig nincs újraküldés.
2. **„Mobil-megkeresés”** — a telefonszámos leadeknek: egy MMS (kép) + SMS (link) páros. A
   **„Páros indítása”** gomb (a számmal a feliratában) megerősítés után VALÓDI küldést indít —
   nem vonható vissza —, és a kártya élő idővonalon mutatja, hol tart. Ugyanaz a jogszerűségi kapu
   vonatkozik rá; a felület előre kiírja, ha a szám a hideg-küldési szabályok miatt nem
   küldhető, vagy a páros már elfogyott.
   ⚠️ **Ha nincs telefonszám**, a gomb halvány és nem nyomható („Páros indítása (nincs szám)”),
   a kártya pedig megmondja a kiutat is: a számot a lead adatlapján, a **„Begyűjtött adatok —
   szerkeszthető”** panelen tudod megadni, és van odavivő link is. Ugyanígy halvány a gomb
   akkor is, ha a kimenő MMS képe nem áll elő („nincs kép”).

Ha MINDKÉT csatorna küldhető állapotban van (van cím ÉS szám, és még egyik sem ment ki),
a kártyák felett megjelenik az **„Indítás MINDKÉT csatornán — e-mail + MMS+SMS páros”** gomb —
egy kattintással kimegy a levél és a mobil-páros együtt. Ha bármelyik feltétel hiányzik, ez a
gomb nem látszik: ilyenkor a kártyákról külön-külön küldesz.

Mindkét csatorna EGYSZER küldhető — a rendszer véd az ismételt zaklatás ellen.

⚠️ **Az „egyszer" a CÍMRE szól, nem a linkre.** Ha ugyanahhoz a leadhez két követett link
készül (pl. új mock miatt), a második NEM küld újabb levelet ugyanarra az e-mail címre:
a rendszer azt írja ki, hogy erre a címre már ment hideg megkeresés. Ez szándékos — a
címzett akkor is egy ember, ha nálunk két sorban szerepel.

## Tevékenység — mit mért a link

A kiküldött, követett link méréseit a Tevékenység-képernyő mutatja (a Megkeresés-panel
gombjáról nyílik): látogatásonként az események, görgetés és olvasási idő; felül a státusz-pill
és a **„vissza a leadhez”** / **„a látott oldal ▸”** linkek. Amíg nincs megnyitás:
**„Még nem nyitotta meg a linket — nincs mérési adat.”** — ez nem hiba, csak még nem történt semmi.

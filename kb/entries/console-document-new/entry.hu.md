---
id: console-document-new
title: Új bizonylat rögzítése — a bejövő számla útja a rendszerbe
audience: operator
anchors: console.document_new
updated: 2026-08-23
---

A **„Bizonylatok”** lista jobb felső sarkában az **„+ Új bizonylat rögzítése”** linkkel nyílik a
felviteli űrlap. Jellemzően BEJÖVŐ (szállítói) számlát rögzítünk itt — tárhely, domain, AI-díj —,
a saját kimenő számláink ugyanis a fizetési útból maguktól születnek.

## Kitöltés

- **Számlatípus** — EGY választás mondja meg, mi ez a bizonylat: **„Szállítói számla”**
  (alapértelmezés), **„Vevői számla”**, sztornó, díjbekérő, jóváíró, helyesbítő. Nincs külön
  irány-mező — a típus hordozza.
- **Partner** — a listából választható; ha a szállító még nincs a törzsben, előbb az
  **„Új partner rögzítése ▸”** linkkel kell felvenni.
- **Könyvelőcég** — melyik cégünk könyvébe kerül a tétel. Ha még egyetlen jogi entitás sincs,
  az űrlap helyett egy gomb jelenik meg: **„Entitás létrehozása a konfigurációból”** — ez a
  környezetben rögzített cégadatokból egy kattintással megcsinálja.
- **Bizonylatszám** — pontosan az, ami a kapott számlán áll (ez alapján keresi vissza később).
- **Nettó / Bruttó** — ha a nettót üresen hagyja, a bruttóval egyezőnek vesszük (alanyi
  adómentes tétel); az áfát a kettő különbségeként tároljuk. Sztornónál negatív összeget írjon.
- **fizetve** — ha már ki van egyenlítve, pipálja be és adja meg a dátumot; enélkül a tétel a
  kintlévőség/tartozás listákban jelenik meg a határidő szerint korosítva.
- **Számlakép** — a kapott PDF vagy fotó (max 8 MB) csatolható; utána a listákban a
  **„Számlakép ▸”** gombbal bármikor megnyitható.

A **„Bizonylat mentése”** gomb után a lista nyílik meg, a most rögzített tételre szűrve — azonnal
látszik a partner lapján is.

# Elérhetőség — cím, térkép-tű, telefon, e-mail (JÓVÁHAGYOTT TERV „B”, 2026-09-26)

A tulaj kérése (2026-09-26, a Térkép modul képernyőjén): „itt lehessen a szállás címét
pontosítani ha kell! És az elérhetőségeket hol lehet szerkeszteni? … lehessen térképen
google maps-en leszúrni a szállás helyét”. Két változatból a tulaj a **B**-t választotta
(„Saját menüpont”), a térképes részt a kattintható vázlaton kipróbálva: „ok jó így”.

A `plan.html` a kattintható vázlat. A Google-kulcsot kivettük belőle (`BROWSER_KEY`), ezért a
térkép a befagyasztott példányban nem tölt be; a képek a működő állapotot mutatják.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Önálló „Elérhetőség” menüpont** az „Az oldalam” csoportban, a Fotók után — modultól
   függetlenül, mert a cím és a telefon a Térkép modul nélkül is a honlapon van (fejléc,
   kapcsolat rész, Google-nak szóló adatok).
2. **„A szállás helye” kártya**: „Cím” mező + „Megkeresem a térképen” gomb (címkeresés) +
   Google-térkép **húzható tűvel**; koppintásra is áthelyezhető, Műhold nézet elérhető.
   Állapotsor: a mentett helyen / a cím alapján (ellenőrizze) / kézzel pontosítva (mentésre
   vár) + koordináták; „Vissza a mentett helyre”.
3. **„Telefon és e-mail” kártya**: a telefon az SMS-küldő szabályával normalizálódik és
   „+36 30 123 4567” alakban kerül a honlapra (a mező alatt élőben látszik); rossz telefon /
   e-mail azonnal hibát ír. Mindkettő nyilvános — kimondjuk, hogy az értesítések a Fiók
   kommunikációs e-mailjére mennek.
4. **Egy mentés-gomb** („Mentés és frissítés”) + mellette, mi nincs még elmentve.
   Hibás mezővel **semmi** nem mentődik (mindent vagy semmit).
5. **A Térkép modul képernyője** ugyanazt a hely-kártyát viseli, UGYANAZZAL az adattal; ott
   egy mentés a helyet és a megközelítés-mezőket együtt menti. A telefon/e-mail csak az
   Elérhetőségben szerkeszthető (link oda).
6. Mobilon (390 px) a térkép 300 px magas, a gomb a cím alá kerül; a térkép két ujjal
   mozog, hogy az oldal görgetése ne akadjon bele.

## Megvalósítás és őr

- Adat: `src/tenant/contact.ts` (szabály), `src/tenant/editor.ts` `saveTenantContact()` —
  a `site.edited_site_data` `contact` + `geo` felülírása, ugyanaz a csatorna, mint a Szövegeké.
- Nézet: `src/server/contactViews.ts`; útvonal: `POST /admin/elerhetoseg`, a Térkép képernyő
  a `POST /admin/module-config`-ot használja.
- Böngésző-kulcs: `GOOGLE_MAPS_BROWSER_KEY` (HTTP-referrer korlátozott kulcs; a szerver-kulcs
  sosem kerül a lapra). Kulcs nélkül a lap működik, csak térkép nélkül.
- Őr: `scripts/contact-edit-check.mts`.

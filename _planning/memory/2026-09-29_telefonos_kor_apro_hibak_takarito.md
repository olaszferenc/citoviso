# 2026-09-29: a telefonos kör apró hibái (takarító SUB-szál): nyolc tétel

A SUB-szál a `cit95d78eb3` fában futott, koordinátora a `citded06a5f`. Brief: `~/rc-briefs/telefonos-kor-apro-hibak.md`.
Források: `2026-09-28_kep_itelet_telefonos_kor.md`, `2026-09-28_egy_szallasos_telefonos_kor_myrna_haus.md`
és a Myrna-kör `ITELET.md`-je. A 7. és a 8. tételt a koordinátor utólag adta hozzá, tulajdonosi jóváhagyással.

Előtte/utána képek (390 és asztali, gitignore-olt, de maradandó): `elek/runs/takarito-2026-09-29/`.

## Tételek: mi volt, mi lett

1. **Admin egység-sorrend** (DÖNTÉS, a tulaj: „legyen A)”): a nem kiadó „egész szállás” a tulaj négy listájában
   a VÉGÉRE kerül (Szobák rács, szoba-felugró, Árak kártyák, Online foglalás naptár-fül). Az egyben is kiadó egész
   elöl marad, csak-egyben módban pedig mindenképp elöl. → ADR-XXXX, `adminUnitOrder()` (`unitVisibility.ts`),
   őr: `scripts/admin-unit-order-check.mts`. A negatív kontroll az „egyben is” állapot (ugyanaz a próba ELÖL-t mér).
   Piros kontroll kézzel: a rendezést kikapcsolva 4 bukás.
2. **Kontraszt:** az Online foglalás (és minden modul) sötét fejlécében a cím és az ár-pirula sötét betűvel állt
   sötétkék alapon. Az ok: a globális `h1–h4` szín és az `.adm-price__*` saját színe erősebb volt a fejléc
   fehérjénél. Javítás: `.mhead` alatt `color:inherit`. Ennek eredménye: fehér a #0e2a47-en (~14:1), a pirulán
   ~8,7:1. A kép-ítélet másik két kontraszt-lelete (a kifakult vendég-fejléc és a sötét dokk) élő lapon mérve a
   runner mellékhatása volt: a tapadó elemeket statikusra teszi. Élesen mindkettő rendben van
   (`hdr-*` képek a vázlatban), ezért nem javítottam.
3. **Lemondó lap:** a gombfelirat balra-fent tapadt. Az ok: az inline `display:inline-block` felülírta a
   `.citui-btn` `inline-flex` középre igazítását. Három helyen kivettem (lemondó lap, a vendég-lapok közös
   „vissza” gombja, egy admin „Csomag bővítése” gomb). A `.citui-btn` mostantól `text-align:center`, így a
   telefonon két sorba törő felirat is középen marad. Új elem: **„A szállásadó elérhetősége”** koppintható
   `tel:`/`mailto:` gombokkal, a megerősítő ÉS a „lemondva” lapon is. Forrása ugyanaz a `hostContact()`, amiből
   a foglalási levelek kártyája dolgozik. Hiányzó adatnál nincs sor.
4. **Árajánlat-mód pipái:** a „A szállásadó személyesen igazolja vissza” árajánlatnál nem igaz, ezért a
   `setAskMode` átírja erre: „Az ajánlat elfogadásáról Ön dönt”. A „Fizetés a helyszínen” marad, mert igaz:
   az elfogadott ajánlat ugyanazt a visszaigazoló levelet kapja, amely szerint a fizetés a helyszínen történik.
5. **Online foglalás, bemutató szobák naptára:** fület csak a foglalható egység kap (`bookableUnits`). A
   kimaradtakat egy mondat megnevezi: „…: a házzal együtt foglalható, ezért nincs külön naptára.”, illetve
   „…: nem kiadó egyben, ezért nincs naptára.”. A képernyő az első foglalható egységen nyílik, és egy régi
   `&e=` link is azt nyitja. A „Mit ad ki?” szerkesztő továbbra is minden egységet mutat.
6. **A vendég-naptár nem a kért hónapban nyílt:** a hiba telefonon jelentkezett. Az ok: a 2026-09-24-es
   `snapCalTo` a „már látszik” ablakot két hónapnak vette, a telefon viszont csak egyet mutat, mert a CSS
   559 px alatt rejti a másodikat. Mérve a Myrna-lapon (az inline runtime cseréjével): előtte október beírása
   után szeptember látszott, 0 kijelölt nappal; utána október, 2 kijelölt nappal. Ugyanez a hiba telefonon az
   utolsó hónapot is elérhetetlenné tette, mert a `maxBase` `horizon-2` volt. Most a képernyőhöz igazodik.
7. **„Kiküldött ajánlatok” lista:** pótoltam a jóváhagyott terv „X Ft / éj” alsorát (a tulaj: „2. OK”), a
   táblázatban és a kártyán is. Forrása az ajánlat befagyasztott sora. Ha a tartózkodás több áron ível át,
   tartományt mutat („26 000 – 32 000 Ft / éj”), fős árazásnál „/ fő / éj”. A kontraktus README-je (§9) és a
   KB frissítve. Őr: a `booking-offer-check` S⑤ minden sorban megköveteli; piros kontroll: 2 bukás.
8. **A tulaj árajánlat-kérő levele** még a felülírt ADR-0215 ①.3-at mondta: „az ár bekerül az árlistájába, így
   a következő vendég már látja”. Az új szöveg: „Az ár alapból csak erre a kérésre szól: az árlistájába csak
   akkor kerül, ha az ajánlat-lapon bejelöli.” (ADR-0267). Őr: `booking-offer-check` ②.

## Nyitott / nem az enyém

- A lemondó lapon a piros gomb szövege a böngésző alapértelmezett fekete színe (5,37:1, átmegy), token nélkül.
  Nem javítottam, mert nem volt lelet.
- A tulaj-naptár (Foglalások fül) jelmagyarázatának halvány színei a foglaláskezelés-szálhoz (`citfa2ec7fa`) tartoznak.

## Módosított fájlok

`src/tenant/unitVisibility.ts` · `src/tenant/units.ts` · `src/server/public.ts` · `src/server/moduleConfigViews.ts` ·
`src/server/adminViews.ts` · `src/server/bookingViews.ts` · `src/booking/requests.ts` · `assets/runtime/cit-runtime.js` ·
`public/assets/ui/citui.css` · `src/i18n/catalog.json` · `scripts/admin-unit-order-check.mts` (új) ·
`scripts/booking-offer-check.mts` · `hooks/pre-commit` · `kb/entries/admin-modules-booking/entry.hu.md` ·
`kb/entries/admin-bookings/entry.hu.md` · `assets/design-refs/tenant-admin/booking-offer-scope/README.md` ·
`_planning/decisions/XXXX-admin-egyseg-sorrend-a-nem-kiado-egesz-a-vegen.md` (új)

# Tenant-admin újratervezés — „Linear” nyelv, egy akcent, világos/sötét — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-24, tulajdonosi választás három körben: (1) a mai admin átrendezése
ELVETVE („nem újragondolás”); (2) négy gyökeresen új nyelvből a **2.1 „Linear”** lett az alap;
(3) a Linear + cián akcent + előfizetés-kártya + nyitókép-mutató + világos/sötét váltó két
változatából az **„A” — fehér oldalsáv** (a „B” brand-navy oldalsáv elvetve).
**Kapcsolódó:** ADR-XXXX (ez a döntés), ADR-0021 ① (dizájn-mag: a megvalósítás `--citui-*`
tokenekből dolgozik, a mock nyers hexei CSAK a mockban élnek), ADR-0034/0035 (oldalsáv-menü),
ADR-0044 (fotó-sorrend, nyitókép), ADR-0045 §J (súgó-horgonyok), ADR-0198 (feltöltés
elutasítása névvel), ADR-0220 (súgó-kép frissesség = deploy-kapu).
**Hatókör:** `public/assets/ui/citui-admin.css` · `public/assets/ui/citui.css` · `src/server/adminViews.ts` · `src/ui/icons.ts`
(citui-admin.css: teljes csere; citui.css: sötét-téma tokenek; adminViews: shell, navItems,
overview, photosCard, UPLOAD_SCRIPT; icons: nap/hold, rács/lista, fogantyú, feltöltés, kamera;
+ a súgó-képek újralövése, ami nem fájl-hatókör).
⚠️ **Státusz: befagyasztva, MÉG NEM SZÁLLÍTVA.** A kötő feliratok ezért itt még sima „…”
jelöléssel állnak; a megvalósításkor kapják a **„…”** jelölést, amit a `contract-drift-check`
a kódon számon kér.

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez mérjük
(mobil 390 + asztali 1180, világos ÉS sötét). A `gen2.mjs`/`gen3.mjs` a mock generátora (a
`_drafts/` alá írt, eldobható HTML-eket állította elő) — a terv újragenerálható belőle.

## Miért létezik

A tulaj szava (2026-09-24, képpel): „nem szofisztikált a navigáció, sem a kinézete… sehol nem
tud visszalépni… ez nem képgaléria… a fájlok kiválasztása gomb 1995”. Mérve: a mobil alsó sáv
11 gombot tömött két sorba (186 px), egyetlen lapon sem volt vissza-út, a Fotók fül csempénként
5 űrlapot és egy nyers `<input type=file>`-t mutatott.

## Amit a terv KÖT

1. **Nyelv.** Szín **csak jelentésre**: EGY akcent (a logó ciánja) az elsődleges gombon, az aktív
   menüponton, a jelvényen, a szikra-diagramon, a nyitókép-jelölőn és a linken; zöld/borostyán/
   piros csak állapotra; minden más szürke/fekete. 13 px-es sűrű tipográfia, hajszálvékony
   vonalak, **kártya-árnyék nincs**, sugár 6–8 px. Ikonok a vékony (1,6–1,7) vonalas készletből
   — a mai ciánpöttyös készlet az adminban KIVEZETVE (a konzol maradhat).
2. **Oldalsáv (asztali):** fehér-szürke, fejlécében az oldal neve + `slug · Élő`; **csoportok**
   (Az oldalam · Vendégek · Üzlet · Fiók); a menüpont mellett **számláló** (Fotók 16 · Modulok 7)
   vagy **jelvény** (Üzenetek 2); **ikonsávvá csukható** (56 px, a választás megmarad). Alul az
   **előfizetés-kártya** (④) és a fiók-sor a téma-váltóval.
3. **Fejléc (minden lap):** ← vissza (az Áttekintésen rejtve) + **útvonal** (`Boróka ház › Fotók`),
   jobbra kereső-mező (⌘K — a terv csak a helyét köti, a keresés maga nem része), téma-váltó,
   „Oldal” (megtekintés) és a lap **elsődleges gombja** (Fotók: Feltöltés). A böngésző Vissza
   gombja is a helyes lapra visz (history).
4. **Előfizetés-kártya** (a sávban; mobilon az Áttekintés alján): csomag neve, „megújul <dátum>
   · N modul aktív · K. hónap a 12-ből”, 12 szegmenses sáv (a folyó hónapig kitöltve), „Modulok
   kezelése” gomb. ⛔ VALÓS adatból (`subscription.billing_period`, `current_period_end`,
   anchor) — a mock 1/12-e a 2026-09-24-i indulás.
5. **Áttekintés:** cím + egy mondat; **3 widget** (Állapot + cím · Látogatók 7 nap egyedi,
   robot nélkül + szikra-diagram · Üzenetek, a 3 legutóbbi, olvasatlan pöttyel); alatta a
   **nyitókép-mutató**: a `photos[0]` képe, bal fent „Bemutató nyitókép” / „Saját nyitókép”
   címke, jobb fent „N kép”, alul a szállás neve + állapot-mondat + „Cserélje sajátra”
   (bemutató esetén, a Fotókra visz) vagy „Fotók kezelése” + „Nagyítás”; alatta a **Teendők**
   lista (nyitott: szaggatott kör + „Élesítés előtt” chip; kész: zöld pötty + áthúzva; jobbra
   a fül neve), fejlécében „N nyitott” és „N modul · K számlázott”. ⛔ Foglalási kérés NINCS
   a widgetek között, amíg 0 (a mock-ban sem szerepel — az első körben kitalált „1 új kérés”
   HIBA volt).
6. **Fotók:** cím + „N kép · az első a nyitókép · húzással rendezhető”; bemutató/saját sáv
   (borostyán/zöld); **vékony húzza-ide sáv** (szöveg + korlátok + „Fotók választása”, mobilon
   „Fényképezés” is, `capture=environment`); **Rács / Lista** váltó; rács 6 oszlop (mobil 3),
   négyzetes csempék, sorszám, nyitókép-címke, a műveletek (★ nyitókép, ‹ ›, törlés) **hoverre
   a csempén**; lista: fogantyú, bélyegkép, aláírás-mező a sorban, „Nyitókép / Legyen nyitókép”,
   forrás-chip, ‹ ›, törlés. Kattintás → **nagyítás** (nyilak, billentyű, aláírás-mező, „Legyen
   ez a nyitókép”, törlés). **Kijelölés** mód (csak saját fotónál) → alsó ragadó sáv „N kijelölve
   · Mégse · Törlés” + megerősítő párbeszéd. Húzás bárhova a lapra → teljes-lapos „Engedje el”.
   ⛔ Nincs `<input type=file>` a lapon látható formában.
7. **Feltöltés szabályai = `/admin/photos` (ADR-0198):** JPEG/PNG/WEBP · ≤ 6 MB · max. 12 egy
   körben · 24 a könyvtárban · az első feltöltés **LECSERÉLI** a bemutató képeket
   (`addTenantPhotos`) · elutasítás fájlonként NÉVVEL és okkal a haladás-listában · a
   bemutató kép **nem törölhető** (a törlés-gombok nem jelennek meg; a próbálkozás piros
   toast: „A bemutató képeket nem kell törölnie — az első saját feltöltés lecseréli őket.”).
   Sorrend: húzás + ‹ › + ★ → `POST /admin/photos/order`; aláírás: `onchange` → „Mentve” pöttyel
   (`/admin/photos/caption`, max 160). Több egységnél a „Melyik egységhez?” a nagyításban/
   listában kap helyet (a mock nem mutatja, mert a Boróka ház egy egység — a megvalósítás
   NEM hagyhatja el, ADR-0044/d).
8. **Világos / sötét mód:** váltó a fejlécben (asztali), a fiók-sorban és a mobil menü
   „Megjelenés” sorában; a választás **megmarad** (`localStorage`, később fiók-beállítás);
   sötétben MINDEN felület (kártya, sáv, nagyítás, párbeszéd, fiók-menü, toast) a saját sötét
   tokenjeit kapja — nincs „fehér lyuk”. Tokenek: `--citui-*` sötét készlet a `citui.css`-ben,
   `[data-citui-theme=dark]` scope-pal (ADR-0021 ①, a scope már létezik).
9. **Mobil (390):** felső sáv (menü · ← · útvonal · Oldal · elsődleges gomb), **alsó sáv 4 fő
   pont + Menü** (Áttekintés · Fotók · Foglalások · Üzenetek · Menü), a Menü **bal oldali
   fiók** csoportokkal, téma-sorral és Kilépéssel. ⛔ A 11-gombos, kétsoros alsó sáv KIVEZETVE.
10. **A többi fül** (Szövegek, Modulok, Foglalások, Webcím, Forgalom, Dokumentumok, Üzenetek,
    Fiók, Súgó) a tartalmát megtartja; csak a keretet (2–3, 8–9) kapja. A meglévő `.adm-*`
    komponenseik az új tokenekre és tipográfiára állnak át, saját tervezői kör nélkül —
    kivéve, ahol a sötét mód „fehér lyukat” hagyna: azt javítani KELL.

## Őr (a megvalósításhoz)

`scripts/admin-linear-check.mts` (készül a kóddal): mindkét méret × mindkét téma; a 3
widget + nyitókép-mutató + teendő-lista jelen; vissza-gomb rejtve az Áttekintésen, látható
máshol; a Fotók lapon nincs látható `input[type=file]`; a bemutató állapotban NINCS törlés-gomb;
a rács/lista váltó működik; a téma-váltó megmarad újratöltés után; sötét módban nincs elem
`#fff` háttérrel a tartalmi részen (a „fehér lyuk” ellenőrzés); a mobil alsó sávban pontosan
5 elem; a súgó-képek (ADR-0220) frissek. Piros kontroll: a vissza-gomb kivétele, a fájlmező
láthatóvá tétele, egy `#fff` háttér a sötét módban → mind bukjon.

# Facebook-modul — lehetőség, felállás, tartalom-koncepció (2026-11-04, CIT cit208299e0)

> Státusz: **JAVASLAT, döntés nincs.** Kód nem készült. A tulaj kérdései (2026-11-04):
> lehet-e Facebook-oldalt automatán létrehozni és kezelni a tenantnek; ha már van oldala,
> ott a szállásadó vegyen fel kezelőnek; a kezelés és posztolás NE a tulaj felhasználójával
> menjen; milyen tartalom, milyen ciklus, milyen eszköz, mennyi keret.

## 1. Ami biztos (Meta-szabályok, webkeresés 2026-11-04)

| Kérdés | Válasz | Forrás |
|---|---|---|
| Személyes profil gépi létrehozása | ❌ Tilos (valós személy, 1 fiók/fő; gépi fiókkészítés = álfiók, letiltják) | Meta ÁSZF |
| Oldal létrehozása API-val | ❌ Csak Meta-allowlistes app vagy tesztfelhasználó | Graph API `/{user}/accounts` referencia |
| Oldal létrehozása kézzel / böngészőben valós fiókból | ✅ Megy; a böngésző-automatizálás az ÁSZF 3.2.3 ellen van → lassan, kis darabszámban | Meta ÁSZF 3.2.3 |
| Posztolás oldalra (kép, szöveg, link) | ✅ Graph API, `pages_manage_posts` (+ `pages_read_engagement`, `pages_show_list`), oldal-token | Pages API |
| Reels oldalra | ✅ `/{page-id}/video_reels`, **max. 30 API-s Reels / oldal / 24 óra** | Reels Publishing API |
| Más tulajdonában lévő oldal kezelése | ✅ Advanced Access → App Review (írásos indoklás + képernyővideó) + üzleti ellenőrzés | Meta App Review |
| Kezelés a tulaj felhasználója nélkül | ✅ Valószínűleg: Business-portfólió **rendszerfelhasználó** (system user) tokenje, akihez az oldalak hozzá vannak rendelve — **a pilotban igazolandó** | Meta Business — nem igazolt |

## 2. Felállás (a tulaj elképzelése szerint)

1. **Citoviso Business-portfólió** (Meta Business Suite). Létrehozni EGY valós személy fiókja kell — ez egyszeri.
2. **Új oldal (nincs még):** a portfólióban hozzuk létre a szállás oldalát; a szállásadó által megadott
   Facebook-felhasználót plusz adminnak vesszük fel (meghívás — elfogadni neki kell, opcionális).
3. **Meglévő oldal:** a szállásadó a saját oldalán felveszi a Citoviso portfóliót partnerként / kezelőnek
   (egyetlen teendője). Második oldalt nem nyitunk.
4. **Napi kezelés és posztolás:** a portfólió rendszerfelhasználója + saját Meta-app (Graph API). Ehhez nem kell
   senki személyes fiókja, és a digitális kolléga sem lép be Facebookra.
5. ⚠️ **A digitális kollégának saját Facebook-fiókot NEM csinálunk** — az álfiók, letiltják, és vele vész minden
   hozzárendelés. Ahol böngészős kattintás kell (oldal-létrehozás), az egy valós személy fiókjával megy.
6. **Lemondáskor:** az oldalt átadjuk a szállásadónak (ő marad admin, mi kilépünk) — ÁSZF-be.

**Tulaj-lépések (csak ő teheti meg, céges adatok):** Business-portfólió létrehozása · üzleti ellenőrzés
(cégadatok) · Meta fejlesztői app létrehozása · App Review beadása (a szöveget és a videót mi készítjük).

## 3. Tartalom — mi működik

Sorrend a várható hatás szerint (a szállásadónak a foglalás számít, nem a lájk):

1. **Szabad időpont — „last minute”** (a legerősebb). Forrás: a saját foglalási naptárunk + a portál-iCal
   (ADR-0361), tehát valós adat. Kiváltó: 21 napon belül ≥2 éjszakás szabad rés. Link a SAJÁT foglalóoldalra
   → a portál-jutalék kiváltása (ADR-0416). Hetente max. 1, hogy ne legyen kétségbeesett hangulata.
2. **Rövid videó (Reels), 15–30 mp** — a szállás saját fotóiból diavetítés (lassú zoom/úsztatás, felirat,
   zene). Az oldal-posztok közül jellemzően a Reels jut el a legtöbb emberhez organikusan (iparági
   tapasztalat, nem garancia). Hetente 1.
3. **Program-javaslat a környékről** — helyi rendezvény, szüret, adventi vásár, túraútvonal, fürdő.
   Forrás: a település/rendezvény nyilvános oldala, amit a kolléga Chrome-ban megnéz. ⛔ Csak forrásolt tény
   (dátum, hely) — §B.17 tényhűség; a kitalált rendezvény rosszabb a semminél.
4. **Hely és hangulat** — a szállás egy-egy képe, évszakhoz kötött mondattal (őszi terasz, kandalló).
5. **Évszak / ünnep** — Márton-nap, Valentin, hosszú hétvégék — mindig egy szabad időponttal vagy
   ajánlattal összekötve, különben üres.

⛔ **Kerülendő:** vendégvélemény névvel idézve (hozzájárulás nélkül); poszt helyi Facebook-csoportokba
(gépi csoport-posztolás = spam, fiók-korlátozás); kitalált kedvezmény, amit a szállásadó nem adott.

**Ciklus (javaslat):** heti 3 elem — 1 Reels + 1 program/hangulat + 1 szabad időpont (ha van rés; ha nincs,
hangulat-kép). A naptárat a kolléga egy héttel előre tölti, a közzététel időzítve megy.

**„Pörgetés”:** organikusan a Facebook kevés emberhez juttat el egy oldal-posztot. Ami ingyen segít:
rendszeresség, Reels, a honlap és a Google Térkép-profil összekötése az oldallal, és hogy a szállásadó a
vendégeinek (visszaigazoló levélben) megadja az oldal linkjét. Fizetett kiemelés = a szállásadó pénze,
külön, opcionális modul lehet később — most NEM javaslom.

**Mérés:** minden linkben UTM-jel → a saját foglalóoldalon látszik, hány foglalás jött a Facebookról;
havi egysoros jelentés a tenant-adminban.

## 4. Eszközök és költség (csak előfizetés + kód + helyi gép)

| Lépés | Eszköz | Költség |
|---|---|---|
| Szöveg + képválasztás + program-kutatás | digitális kolléga (saját RC-session, Chrome) | előfizetés-keret |
| Reels-videó a fotókból | `ffmpeg` szkript (kód), Debianon CPU-n is megy | $0 |
| Zene a videóhoz | jogtiszta, kereskedelmi licencű könyvtár (licenc a repóban) | egyszeri / $0 |
| Szabad időpont felismerése | kód a foglalási naptárból | $0 |
| Közzététel, időzítés | kód: Graph API + systemd timer | $0 |

**Keret-becslés (NEM mért — a pilotban mérni kell `pipemeter.py`-jal):** ha a kolléga egy tenant heti 3
posztját egy ülésben írja, a meglévő adatból (képek, naptár) + 1–2 Chrome-oldal a programhoz, akkor
tenantonként hetente ~$1–3 API-egyenérték várható (≈ 2–6 cent valós pénzben, 1 API-$ ≈ 2 cent).
100 tenantnál ez heti ~$100–300, a heti keret (~$2 275) ~4–13%-a. Ez a pipeline-munkatársak mellett
(heti ~$1 586) **már szűkös**, ezért a pilot fő mérése a tenantonkénti keret-fogyás.
Opus marad (kisebb modell rossz minőséget adott — tulaj, 11-03).

## 5. Döntési pontok (tulaj)

1. Indulhat-e a pilot a Citoviso SAJÁT oldalán (teszt: rendszerfelhasználó, posztolás, Reels)?
2. Ki az a valós személy, akinek a fiókjával a portfólió és az új oldalak létrejönnek?
3. A posztok a szállásadó jóváhagyása nélkül mennek-e ki (a tenant-adminban látja és leállíthatja)?
4. A modul ára — a pilot keret-mérése után.

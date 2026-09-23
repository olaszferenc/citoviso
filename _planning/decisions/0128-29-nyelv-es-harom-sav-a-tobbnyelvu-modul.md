## ADR-0128 — 29 nyelv és három sáv: a Többnyelvű modul kinőtte a „fix 3 nyelv"-et (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva (tulajdonosi döntés) · **Kapcsolódó:**
ADR-0063 (a modul — **§2 FELÜLÍRVA**), ADR-0036 (nyelv = paraméter, `language_pack`),
ADR-0088 §6 (kupon), ADR-0113 ⑤ (a kapu az íráson), ADR-0119 ⑥ (felfüggesztett site),
03-INVARIANTS §B (saját ikon-készlet) és §B.17 (tényhűség).

**Kontraktus:** `assets/design-refs/console/multilang-tiers/` (HTML + README + két kép).

**Kontextus.** Tulajdonosi bejelentés: „nagyon kevés nyelvre lehet lefordítani a honlapot a
vásárolható modulok között. Legyen már ennél jóval több. Pl.: EU országok nyelvei." A premissza
**mérve igaz volt**: a `LANG_NAME` (`src/i18n/lang.ts`) 10 nyelvet ismert, amiből a site saját
nyelvét levonva **9** volt a választható célkészlet — az EU 24 hivatalos nyelvéből **14 hiányzott**.

**A mérés két rejtett függést talált**, amit a puszta lista-bővítés némán elrontott volna:

1. **A `flagSvg()` ismeretlen kódra ÜRES stringet ad** (`src/ui/flags.ts`). 19 új zászló nélkül
   az új nyelvek a **vendég-oldali** nyelvváltón zászló nélküli, csupasz névként jelentek volna meg.
2. **Ugyanaz a `supportedLangs()` táplálta az operátor-konzol nyelvválasztóját** is
   (`console/views.ts` `langSwitcher`, `console/server.ts` `/operator/lang`). A bővítés az
   operátornak 28 konzol-nyelvet kínált volna; minden első kattintás egy **2405 stringes**
   AI-csomagot + KB-fordítást indít, addig a felület hu-fallbackre esik.

**Költség-oldal (a döntés megalapozásához):** a nyelvi csomag **nyelvenként EGYSZER** készül és
minden tenant osztozik rajta; a 19 új nyelv egyszeri provisioningja nagyságrendileg **$20–25**.
Az árazás tehát **üzleti döntés, nem költség-kérdés**.

**Döntés.**

1. **A választható kör 29 nyelv** (a site saját nyelvét levonva 28 célnyelv): az EU **24
   hivatalos** nyelve **+ szerb, ukrán, orosz, török, norvég** (nem EU, de valós vendégkör).
   Forrás továbbra is egyetlen térkép, a `LANG_NAME`.
2. **⛔ Az ADR-0063 §2 „fix 3 nyelv, egy csomagár" FELÜLÍRVA. Három sáv lép a helyére**
   (tulaj-döntés, egyszeri díj mindhárom):

   | Sáv | Kapacitás | Egyszeri díj | Egységár |
   |---|---|---|---|
   | Alap | legfeljebb 3 nyelv | 14 900 Ft | 4 967 Ft / nyelv |
   | Bővített | legfeljebb 6 nyelv | 22 900 Ft | 3 817 Ft / nyelv |
   | Teljes | **mind a 28** | 30 000 Ft | 1 071 Ft / nyelv |

   Az ADR-0063 §3 (a generálás minden alkalommal fizetett esemény), §4 (tartalom-hash →
   elavulás), §5 (az elavult fordítás tovább SZOLGÁL) és §6 (nyelvenkénti statikus
   pillanatkép) **változatlanul él** — csak az ár és a darabszám sávosodik.
   ⚠️ A tulaj tudatosan tömörítette a sávokat (a Teljes a Bővítettnél csak +7 100 Ft):
   a szándék a **maximális terjedés**, hogy a legtöbb tenant a teljes csomagot vegye.
3. **A két nyelvlista szétválik.** `siteLangs()` = az eladható 29; `consoleLangs()` = a szűk
   kör, amin az operátor-konzol tényleg meg van írva. Egy nyelv csak akkor kerülhet a
   konzol-listára, ha a csomagja kész — különben a kezelő olyan nyelvre válthatna, amin a
   felület hu-fallback.
4. **A sapka LÁTHATÓ, a csonkítás KIMONDOTT.** A sávon túli csempe láthatóan kikapcsol (nem
   némán figyelmen kívül marad); sávot lefelé váltva a fölös jelölés lekerül, és az összegző
   darabszáma azonnal mutatja. A Teljes sávban a picker helyére a 28 nyelv felsorolása lép.
5. **A mobil ár-sáv a modul-kártyán KÍVÜL él.** Mérve: a `.adm-card` `overflow:hidden` lesz a
   `position:sticky` scroll-konténere, ezért a kártyán belüli ragadó sáv néma no-op — és ezt a
   **teljes-lapos screenshot zöldnek mutatja**, mert a sticky elemet a végleges helyére festi.
   A két példányt (asztali + mobil) egy `render()` tölti: két megjelenítés, nem két igazság.

**Nyitva marad (külön szál, NEM része ennek a döntésnek).**

- **Nem-latin írás:** görög, bolgár, orosz, ukrán, szerb. A sablonok Google Fontsai (Fraunces,
  DM Serif Display, Space Grotesk) jórészt latin-only → a lap rendszer-fontra esik vissza.
- **Vendég-adatból ajánlás:** a Places API visszaadja a vélemény nyelvét (`languageCode`), de a
  `PlaceReview` eldobja. Amíg nem tároljuk, a felület nem állíthatja, hogy „mértük" (§B.17).

**Visszafordíthatóság:** 🔄 a nyelvlista és a sáv-szabály kód-szintű; adat-migráció csak a
sáv-árak `module_price` sorait érinti. A már kifizetett, 3 nyelvű generálások érintetlenek —
a meglévő `multilang` ár-sor **az Alap sáv ára marad**, tehát a régi rendelések ára nem mozdul.

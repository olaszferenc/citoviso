# A belső konzol kerete — a tenant-admin „Linear” nyelvén — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-25, tulajdonosi választás két körben: (1) A · „Tükör” (a tenant-admin
oldalsáv-mintája) a B · „Modul-sáv” helyett; (2) módosítással: **a modul-sor maga is
kattintható** → a modul SAJÁT irányítópultja nyílik, és a fa alatta kinyílik; (3) „**struktúrát
építs** — lesz még számos alrész meg főrész is”: a navigáció EGY bővíthető fa, nem beégetett menü.
**Kapcsolódó:** ADR-XXXX (ez a döntés), ADR-0224 (a tenant-admin Linear nyelve — a mag),
ADR-0021 ① (dizájn-mag), ADR-0045 §J (súgó-horgonyok), ADR-0067 ③ (kérés-szintű nyelv),
ADR-0188 (lead-lista), Elek FK-003 (a jelvény és a lista, amit nyit, ugyanazt mondja).
**Hatókör:** `src/console/nav.ts` · `src/console/navCounts.ts` · `src/console/i18nCtx.ts` · `src/console/views.ts` · `src/console/server.ts` · `public/assets/ui/citui-console.css` · `public/assets/ui/citui-console-table.css` · `src/ui/icons.ts`
(nav.ts: ÚJ, a fa; navCounts.ts: ÚJ, a számlálók; i18nCtx: a számlálók a kérés-kontextusban; views.ts: keret,
kezdőlap, modul-irányítópult; a HTTP-belépési fájl: `/hub/<id>` + a számlálók betöltése; citui-console.css: keret +
kezdőlap-blokk, hero és modul-kártya kivezetve; a table-css: háttér-token; icons: vékony `home`, `leads`.)

`plan.html` a mock (A/B · mobil/asztali · világos/sötét váltóval; `verify-mock.mjs` a
kattintás-próbája: 29/29). A `plan-*.png` a jóváhagyott állapot képei. **Ez a README a kötő
szöveg, a mock a kép** — a kész felületet ehhez mérjük; az őr: `scripts/console-linear-check.mts`.

## Miért létezik

A tulaj (2026-09-25): „Ami a tenant admin oldalon van design az legyen az alap a saját belsős
admin felületen is.” Mérve a régi konzol: navy fejléc + gradiens hero + navy ikon-négyzetes
modul-kártyák; a hero chipjei olvashatatlanok voltak (sötét cián sötét-navyn — a „kvalifikált
lead / adatgyűjtés áll” gyakorlatilag nem látszott). A tenant-admin ezzel szemben a Linear
nyelvet beszéli (ADR-0224).

## Amit a terv KÖT

1. **Nyelv = ADR-0224 nyelve.** Egy akcent (a logó ciánja) az aktív soron, a jelvényen, a
   linken; zöld/borostyán/piros csak állapotra; hajszálvonal, kártya-árnyék nincs, 13 px,
   sugár 6–10 px, egy betűcsalád (Inter). A keret ikonjai a vékony készletből (`icAdmin`); a
   képernyők a ciánpöttyös `ic()`-t tartják. **Világos/sötét** a `--citui-bg/panel/side/field/hover`
   tokenekből — a `background: var(--citui-white)` a konzol két stíluslapjában `--citui-panel`-re
   állt (világosban azonos, sötétben a panel színe).
2. **A navigáció EGY FA (`nav.ts`),** és minden felület ebből származik: oldalsáv, útvonal, ⌘K,
   telefon-fiók, alsó sáv, modul-irányítópult. **Csomópont = modul (`group`) vagy funkció (`leaf`).**
   Modul: `id · label · icon · role · href (/hub/<id>) · children`. Funkció: `id · label · short?
   · href · match?` (a `match` útvonal-előtagok, amik alatta világítanak — pl. `/lead/` a
   Lead-sor alatt). **A mélység nem korlátozott** (modulban modul lehet). Új alrész/főrész =
   egy sor a fában, nem új kód. A számlálók NEM a fában élnek: `navCounts.ts` egy olcsó,
   15 mp-ig gyorsítótárazott olvasással tölti a kérés-kontextusba, és a jelek (`navCountsOf`)
   render-időben, az olvasó nyelvén készülnek — az oldalsáv, a modul-lista és a widget ugyanazt
   a számot mutatja.
3. **Oldalsáv (asztali, 232 px, ikonsávvá csukható 56 px-re, a választás megmarad):**
   **„Irányítópult”** · a modul-sorok (**CRM** · **„Pénzügy”** · **„Riport”** · **„Rendszer”**) ·
   **„Súgó”**. **A modul-sor kattintható** → a modul irányítópultja; **a nyíl csak hajtogat**,
   nem navigál. **Alapból minden modul csukva;** az aktív lap modulja nyitva, a többi csukva
   (mint a tenant-admin Modulok-almenüje). A funkció-sorok fa-vonallal, mellettük **számláló**
   (Lead-sor · Jóváhagyott mockok · Bizonylat keresése · Partnerek) vagy **jelvény** (Árazás:
   „13/14 eladó”). Az oldalsávban a rövid felirat (`short`) áll, ha a teljes nem fér.
4. **Fejléc (minden lap):** ← (**az Irányítópulton rejtve**, máshol **egy szinttel feljebb**
   mutat: funkcióról a modul-irányítópultra, modulról a kezdőlapra; a böngésző Vissza is jó) ·
   **útvonal** (`Konzol › CRM › Lead-sor`; a lead saját lapján `… › Lead-sor › {név}`; a fán
   kívüli lap `Konzol › {cím}`) · **⌘K funkció-kereső** (a régi „16 funkció” kereső ide költözött:
   a fa leveleiből épül, gépelésre szűr, ↑↓ Enter navigál, Esc zár, **„Nincs ilyen funkció”**,
   ha nincs találat) · téma-váltó · a konzol nyelve · **„Súgó”**.
5. **Irányítópult (kezdőlap):** cím + „Szia, {név}! …”; **egy widget modulonként** (CRM: felmért
   szereplő · kvalifikált · jóváhagyott mock · eladó modul; Pénzügy: nyitott bizonylat · bizonylat
   · partner · AAM-limit; Megkeresések: kiküldött · megkezdett rendelés · tölcsér); alatta a
   **„Figyelmet kér”** lista — a régi hero-chipek predikátumai sorokként, célponttal
   (tesztfelület elmaradása · AAM 80%-tól · lejárt számla · nyitott bizonylat · nem eladó modul ·
   kvalifikált lead · adatgyűjtés fut/áll). ⛔ Nincs többé hero, modul-kártya, „Modul megnyitása ▸”.
6. **Modul-irányítópult (`/hub/<id>`):** a modul címe + szerep-mondata; **a modul widgetje**;
   a modul SAJÁT „Figyelmet kér” sorai (ha nincs, nincs üres doboz); **„Funkciók”** lista a
   gyerekekkel (számlálóval/jelvénnyel, ▸). Ismeretlen id → 404. Ugyanabból az adatból renderel,
   mint a kezdőlap, ezért a két lap száma nem térhet el.
7. **Mobil (390):** felső sáv (Menü · ← · útvonal · téma); **alsó sáv: Irányítópult + az első
   három modul + „Menü” — pontosan 5**; a **Menü bal fiók** ugyanazt a hajtogató fát viszi,
   plusz **„Megjelenés”** (**„Sötét mód”** / **„Világos mód”**), **„Nyelv”**, **„Kilépés”**.
   Sötétben MINDEN keret-felület a saját tokenjét kapja — „fehér lyuk” tilos.
8. **A többi ~40 képernyő a tartalmát megtartja** (ADR-0224 ⑩ mintájára): csak a keretet, a
   tokeneket és a tipográfiát kapja (`.panel`: panel-háttér, 10 px, árnyék nélkül, a címe a
   szövegbetűvel). Saját tervezői kört nem kapnak — kivéve, ahol a sötét mód fehér lyukat
   hagyna: azt javítani KELL.

9. **Széles táblák 1280-on:** a lead-lista terve (ADR-0188) a „befér 1280-on” ígéretet a keret nélküli
   konzolra mérte. A keret mellett az ígéret **csukott (ikonsáv) oldalsávval** áll; nyitottal a tábla
   **oldalra görgethető, ragadó Név-oszloppal**. A `lead-filter-label-check` és a `lead-list-plan-check`
   ezt méri. A dátum-cella nem tördelhet („2026-09-/04” tilos).

## Őr (`scripts/console-linear-check.mts`)

Hermetikus (a nézetek fixture-rel, kérés-kontextusban, fájlba; nincs DB/HTTP), mindkét méret:
a fa (`activeTrail`: `/lead/abc` → CRM › Lead-sor; `/hub/crm` → CRM; ismeretlen modul → null);
Irányítópult: ← rejtve, minden modul csukva, 3 widget, 5 figyelmeztető sor, nincs hero/kártya,
a Súgó a `.con-nav`-ban (a help-collapse-check horgonya); asztalin: 232→56 px sáv, megmarad;
⌘K „partner” → 2 találat, az első `/partners`, „xyzq” → nincs találat; `/hub/crm`: útvonal
`Konzol CRM`, ← `/`, csak a CRM nyitva 7 alponttal, 1 widget + 3 sor + 7 funkció a sáv
számaival; a nyíl hajtogat és nem navigál; Lead-sor: útvonal + ← `/hub/crm` + aktív levél; a
lead lapja is a Lead-sor alatt; téma: váltó → sötét, megmarad, 0 fehér lyuk két lapon;
mobil: 5 alsó elem, nincs oldalsáv, fiók nyílik/Esc zár; 0 JS-hiba. **Piros kontroll
(`--self-test`, 5):** a ← kivétele · minden fa nyitva · `#fff` a sötét módban · 4 alsó elem ·
csonkolt ⌘K-lista — mind bukjon.

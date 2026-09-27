# 2026-09-27 — A mobil-kör három nyitott tétele: fekvő főcím a 19 sablonon · nem törő összeg · az Elek-park lánca

**Brief:** `~/rc-briefs/mobil-nyitottak-brief.md` (szülő: `cite8fb512d`). Tulaj szó szerint: „a nyitottakat még javítsd" —
a 2026-09-26-i mandátum áll (saját ergonómiai belátás, utólagos ítélet). **ADR-XXXX** (fekvő főcím). Nem élesítve
(a nagy deployjal megy).

## ① Fekvő telefon (844×390): a főcím egésze az első képernyőn — MIND a 19 sablonon mérve

- **A mérés szélesebb volt, mint a bejelentés:** nem csak a dark-luxury (+37 px), hanem 19-ből **10 sablon** főcíme lógott
  a hajtás alá (artdeco +175…260, brutalism +127, dopamine +58…133, transit +60, fullbleed +29…57, watercolor +34,
  horizontal +9), kettő **6 px-re** ért véget felette (cinematic, parallax — „még éppen átment" = halott szándék), és
  az arch-frames / wordmark-grow hero-neve (nem h1, a jóváhagyott vázlat szerint) a 460/420 px-es hero-minimum miatt a
  képernyő aljára esett. Portré 390-en 0, asztalon 9 túllógás (asztal NEM tárgy — a brief szerint pixelre azonos marad).
- **Javítás a motorban, 12 sablon:** fekvő blokk `@media(max-height:500px) and (min-width:<telefon-töréspont+1>px)`, a
  főcím `clamp(26–28px, 8–9vh, 36–40px)` (a MAGASSÁGHOZ kötve), szélesebb mérték, kisebb hero-levegő. Ahol a másolat
  alul-horgonyzott egy overlay masthead alatt (fullbleed, horizontal, parallax), a masthead a folyamba lép (a
  dark-luxury/cinematic mintája) — ⛔ az első parallax-kör pont ezt hozta elő: a főcím a „FOGLALÁS" pirula ALÁ csúszott,
  a kontaktlapon látszott, a mérés nem (a takarva-szabály a h1 első sorát nézi, ott a chip nem volt). Kép után javítva.
- ⛔ **Sorrend-csapda:** a cinematic fekvő blokkja a base `.cn-cine h1` szabály ELŐTT állt → azonos specificitáson a base
  nyert, a mérés 54 px-et mutatott változatlanul. A blokk a base szabály UTÁN áll. ⛔ **Név-csapda:** a „parallax" mock
  a `parallax.ts` SABLON, nem az `immersive-parallax` archetípus — az archetípus-szerkesztést visszavontam (nem mért).
- **Eredmény (57 friss render fekvőn):** a h1-es sablonokon 0 túllógás, a főcím vége 90–236 px-szel a hajtás felett;
  tilted tagline-ja a sáv fölött kényelmesen (a 76 px-es név 13vh-ra kötve). Arch-frames: név + lead-sor az első
  képernyőn; wordmark-grow −15 → −90 px. Card-sidebar mozaik-mastheadje tervezett (a név a ragadó fejlécben).
- **Új őr-szabály:** `guest-mobile-check` ②főcím-hajtás (ERGONÓMIA): az első képernyőn KEZDŐDŐ, de a hajtás alatt VÉGZŐDŐ
  h1. Önteszt `selftest-h1-under-fold` (editorial név 80vh-val lejjebb + 120 px → piros, 45 px-es ráhagyással). Kapu-mód
  390 + fekvő: 0 HIBA (a fixture-n a wordmark-grow-t fogta meg fekvőn, +45 px → javítva).
- **Portré + asztal pixelre azonos:** 57 mock × {390, 1280} hajtás-kép az origin/main motorjából (ideiglenes worktree)
  renderelt alapvonalhoz képest, animáció kikapcsolva — lásd „Mérések".

## ② „…(minta-ár) 72 000 Ft" — az összeg nem törik el a pénznem előtt

- ⛔ **A brief NBSP-t kért a formázóban — ez ADR-0162 ⑤-be ütközik** (tulajdonosi döntés 2026-09-14: az elválasztó SIMA
  szóköz minden nyelven; az NBSP 28 literált tört, a GSM-7-ből kiesik; „a sortörés-védelem stíluslap-ügy"). Ezért NEM a
  sztringet, hanem az ELEMET védtem: `moneyHtml()` a `cit-runtime.js`-ben (egy hely, minden összeg, amit a widget HTML-be
  ír — 9 hívóhely) → `<span class="cit-amt">`, `.cit-amt{white-space:nowrap}` a `cit-modules.css`-ben. A telefonos 2. lépés
  sávja az összeg-sort MARKUPKÉNT tükrözi (`innerHTML`, nem `textContent`), a tükör félkövér/méret-öröksége semlegesítve
  (a sáv magassága 24 px, mint előtte). A `textContent` változatlan → a „látható "72 000 Ft"" fogyasztók (FK-007/008,
  `mock-booking-sample-check`, `booking-price-clarity-check`) nem érintettek; `money-format-check` ⑤ drift: 0.
- **Bizonyítás:** a sáv sorát szűkítve (300→220 px) ELŐTTE 260/240 px-nél a „72 000 Ft" 2 téglalapra tört (a „Ft" új
  sorban), UTÁNA minden szélességen 1 téglalap; 390-en a sáv 1 sor (24 px), asztalon a kártya összeg-sora változatlan.

## ③ Az Elek-park lánca — három rétegű lelet, mind mérve

1. **FK-004 „Megkeresés" kattintás:** NEM ergonómiai lelet, hanem runner-hiba. A `has-text` részszövegre illeszt, a
   `.first()` DOM-sorrendet vesz: a konzol BEHAJTOTT nav-sora („Megkeresés-tölcsér", Riport-csoport, display:none) a
   DOM-ban a látható lead-fül ELŐTT áll → timeout egy ép felületen (mérve: 5 találat, a 3. a látható fül). Javítás
   `labelLocator()`: látható PONTOS felirat → látható részszöveg → a régi. A forgatókönyv nem változott (megjegyzés).
2. **Az ELEK-prospect e-mail alapján:** IGAZOLVA — a legfrissebb elek@ sor a Laguna Panzióé (38 idegen link a FK-009
   seedből), a „visszaállítás" 39 sort írt, a „követett link megvan" tény idegen linkkel is igaz volt. Új
   `src/elek/park.ts`: `ELEK_LEAD_NAME` (a seed is innen), `elekProspectOf(rows, leadId)` — **a cím BIZTONSÁGI tulajdonság,
   az azonosság a lead**. A run-all minden prospect-kérdése lead_id-n át; `elek-precondition-check` ④ réteg negatív
   kontrollal (újabb idegen elek@ sor → nem az; forrás-őr: `.where("contact_email"` a futóban → piros, szabotázzsal igazolva).
3. **FK-008b a MELEG parkon nem mérhető:** a követett link „Ez az oldal már az Öné" (a park korábbi FK-005a-ja megvette),
   a minta-űrlapok nincsenek a lapon → 1 piros + 6 blokkolt, a futó „minden előfeltétel megvan"-t mondott. Új
   `forbids` a láncban (FK-008b ⟂ `ownedLead`, UGYANAZ a predikátum, mint a lapé: `ownedSiteForProspectToken`), a futó
   az első park-írás ELŐTT mondja ki: „a park már túl van rajta … hideg park kell (purge, csak tulajdonosi döntéssel)".
   ⛔ A közös parkot NEM hűtöttem vissza (~11 szál mér rajta) — a FK-008b tartalmi lépéseit a `mock-booking-sample-check`
   (valódi runtime, 390+1280) és az FK-010 fedi; a hideg-parki FK-008b tulajdonosi döntés.
4. **FK-004 küldés-kapu (ADR-0160):** a küldő gomb ZÁRVA, amíg a levél vége nem volt a képernyőn; a runner kattintása csak a
   gombot görgeti be → timeout. Új `görgess` ige a runnerben + a forgatókönyvben az EMBER útja („végigolvasom → a sáv
   nyit"); a „kiküldöd mégis?" ablak a park mockján tényleg felugrik (dizájn-őr lelet) → `tedd?: kattints "Kiküldöm mégis"`.

## Mérések
- `guest-mobile-check` kapu-mód `--vp=390,land` (30 sablon+archetípus): **0 HIBA**; `--selftest`: tiszta lap 0 HIBA, **9 ültetett
  hiba mind piros** (új: `selftest-h1-under-fold`). 57 friss render fekvőn: a h1-es sablonokon 0 túllógás.
- Portré 390 + asztal 1280, 57 mock × 2 = 114 hajtás-kép az origin/main motorjából renderelt alapvonalhoz (animáció ki): a
  **110/114 bájtra azonos**; 4 képen 22–79 px eltérés, mind gombfelirat/szöveg élsimítási zaja (a kivágások szemre azonosak,
  újramérve 0 ↔ 42 px ugyanazon a lapon), a fekvő blokkok pedig 390×844-en nem is illeszkednek (`max-height:500px`) —
  renderelési zaj, nem a CSS-é.
- `money-format-check` 33/33 zöld (⑤ drift 0); `mock-booking-sample-check` zöld + önteszt 3/3 piros; `lead-mobile-check --gate
  --selftest` zöld; `mobile-sticky-check` 30/30; `elek-label-drift-check` 328 állítás zöld; `elek-precondition-check` zöld
  (④ réteg: forrás-szabotázs → piros igazolva); `design-token-lint`, `i18n-lint` zöld.
- **FK-004 a javított runnerrel: pass=8 fail=0 manual=5** (a levél TÉNYLEG kiment elek@-ra: Elek postafiókjában #377, tárgy
  „ELEK-TESZT Vendégház – honlap-terv", benne a /p/elek-teszt-vendeghaz/3SfZ… link + leiratkozó). Előtte: 5/2/3 (a 3. lépés
  timeout), a runner-javítás után 5/4 (a küldés-kapu zárva), a `görgess` + `tedd?:` után 8/0.
- **FK-008b:** a futó az első park-írás ELŐTT mondja ki, hogy a park meleg (`ownedLead`), exit 1 — a kör hideg parkot kér.

- ⚠️ **Hónap-végi piros a landolás kapuiban (27-e):** `booking-price-clarity-check` és `booking-outcome-truth-check` az 5.
  szabad napra kattintott, a nyitott hónapban 3 maradt → timeout (a `booking-screen-check` 09-25-i csapdája, a két testvér-őrben
  javítatlanul). Javítás: ha a nyitott hónap nem ad 5 szabad napot, a naptár saját léptetőjével a következőre lép. ⛔ IKER-JAVÍTÁS:
  a `booking-price-clarity-check`-et egy testvér-szál UGYANÍGY javította és előbb landolta (`3573c56e`, ugyanaznap) — a landolási
  rebase-konfliktusnál az övét vettem át (3 hónapig lapoz), az enyémből az `outcome-truth` maradt (azt ő nem érintette).
  Egyedül futtatva mindkettő zöld.

## Módosított / új fájlok
- Motor: `src/engine/templates/{darkLuxury,cinematic,tiltedGallery,fullbleed,horizontal,artdeco,brutalism,dopamine,transit,watercolor,parallax,archFrames,wordmarkGrow}.ts`
- Runtime: `assets/runtime/cit-runtime.js` (`moneyHtml`, 9 hívóhely, a sáv tükre), `assets/runtime/cit-modules.css` (`.cit-amt`, a sáv öröksége)
- Őr: `scripts/guest-mobile-check.mts` (②főcím-hajtás + önteszt), `scripts/elek-precondition-check.mts` (④ réteg + meleg park),
  `scripts/booking-outcome-truth-check.mts` (hónap-végi lapozás; a price-clarity a testvér-szálé)
- Elek: **új** `src/elek/park.ts`, `src/elek/preconditions.ts` (`forbids`, `ownedLead`, `obsolete`), `elek/bin/run-all.mts`,
  `elek/bin/runner.mts` (`labelLocator`, `görgess`), `elek/scenarios/FK-004-outreach-send.md`, `scripts/seed-elek-lead.mts`
- `_planning/decisions/XXXX-fekvo-telefonon-a-focim-egesze-az-elso-kepernyon.md`, ez a jegyzet, `MEMORY.md` (külön commit)
- Fő fa: az ELEK-TESZT mock a munkafából újrarenderelve (symlink → fő fa) a FK-futáshoz; a 3 lead 57 mockja a land UTÁN a fő fából.

## Nyitva / a tulajnak
- FK-008b hideg parkon: a közös park visszahűtése (`scripts/purge-test-data.mts`) tulajdonosi döntés.
- Card-sidebar fekvőn: a mozaik tölti az első képernyőt, a név a ragadó fejlécben — tervezett, de ha zavar, külön kör.
- A tulaj utólagos ítélete a képeken (dark-luxury fekvő előtte/utána, 19 sablon kontaktlapja, a 2. lépés sávja).

# B8 — Foglalás: a sor mondja meg, mi történt; a vendég lássa a választ (2026-09-14)

**Szál:** B8 (Elek FK-007 + FK-006b foglalás-köre, 17 bejelentett lelet) ·
**Munkafa:** `~/wt/foglalaskor` · **Élesítés NINCS** (a §0.3 szerint külön engedély kell).

## Mit mértem, mielőtt bármit javítottam

A brief fájl:sor hivatkozásait nem hittem el: a tulaj-fület a **valódi nézet-függvényből**
(`bookingsSection`) rendereltem fixture-rel, a vendég-lapot a **valódi motorból**
(`bookingSlot` + `moduleSections` + az igazi `cit-runtime.js`), és a mai állapotot 390/1280-on
lefényképeztem, majd a DOM-ból számokat olvastam. 17-ből 16 lelet igazolódott, egy nem, és
kettőnél a MECHANIZMUS más volt, mint a bejelentés.

- **A várólista sorrendje:** 46 / 34 / **21** / 28 óra — vagyis a 21 órás kérés a harmadik, és a
  legkevesebb idővel rendelkező NEM elöl áll. A rendezés `dateFrom`, majd `createdAt`.
- **A csempe-panel** ugyanazt a négy embert ismétli, kevesebb adattal (nincs e-mail, telefon,
  üzenet, ár).
- **Sorrend a DOM-ban:** rács 353–954 → nap-panel 965–1098 → jelmagyarázat 1109–1158 → csempék 1187.
- **A „Lejárt (48 óra)" jelvény a legkevésbé feltűnő** (fg #60748b / bg #eef7fa a rózsaszín mellett)
  — és közben a **48 BE VOLT ÉGETVE**, miközben a modul ablaka állítható (`autoDeclineHours`).
  Ezt a brief nem is említette: a felirat egy nem létező szabályt idézhetett.
- **A vendég-naptár jelmagyarázata:** 11,84 px, kontraszt **3,99** (AA-küszöb 4,5), a „szabad"
  minta fehér a fehéren, 1 px-es világos kerettel.
- **Az „Összesen" egyetlen szám** magyarázat nélkül; az ár ALAPJA („Egység") csak a beadás UTÁNI
  nyugtán jelenik meg.
- **A ~180 px üres sáv** valójában **100 px szekció-térköz** az ÉLES generált lapon (mindkét
  méreten): a foglalás az EGYETLEN modul-szekció, ami cím nélkül indul, tehát ott a fejléc helye üres.

## ⛔⛔ A legfontosabb: a rövid teszt-lap ZÖLDRE mérte a hibát

„Beadás után nincs odagörgetés a nyugtához" — az első mérésem szerint a nyugta **látszott**
(top = 179 px). Csakhogy a teszt-lapom a kártya alatt véget ért: a dokumentum megrövidült, a
böngésző **visszarántotta a görgetést**, és a nyugta véletlenül a képernyőre esett. Footert téve
alá (mint minden valódi honlapon) ugyanaz a kód **−678 px**-et adott 390-en és −35-öt 1280-on: a
vendég a küldés után a következő szekciót látja, se visszajelzést, se hibát.

**Tanulság:** ha egy hiba a KÖRNYEZETTŐL függ, a teszt-környezet hiánya a hibát TÜNTETI EL, nem
felnagyítja. Az őr ezért maga építi a footert, és geometriával ítél.

## ⛔⛔ A hírlevél-modul nem működik — és 490 Ft/hó

Az űrlap (`moduleSections.ts:428`) a **`/api/hirlevel`** címre POST-ol. A nyilvános kiszolgálón
**nincs ilyen útvonal**, és feliratkozó-tábla sincs. A futásidő csak a `data-cit-demo` űrlapokat
fogja el — élő bérlői oldalon a vendég beírja a címét, megnyomja a gombot, és elhagyja az oldalt.
A brief jogi tétele (hiányzó hozzájárulás + adatvédelmi link) igaz, **de a pipa egy halott úton
csak jogi dísz lenne** — ezért NEM tettem rá. Tulajdonosi döntés kell: megépítjük vagy levesszük.

## Amit javítottam (apró, terv-kör nélkül)

`src/server/bookingViews.ts` · `src/server/public.ts` · `assets/runtime/cit-runtime.js` ·
`scripts/shot-booking-form.mts`

1. A lejárat-jelvény a **modul saját ablakát** idézi (ablak nélkül nem állít órát).
2. A lemondás **megnevezi az alanyt** (`decided_by`-ból: Ön / a vendég / a rendszer; `null`-nál
   marad a semleges alak — a téves név rosszabb a hiányzónál).
3. Az **automatikus** elutasítás nem „döntés", hanem „automatikusan".
4. A lemondás **visszavisz** a nyitott naptárba, a tulaj egységére és hónapjára (a form viszi a
   nézetet, a szerver karakter-fehérlistával fűzi vissza).
5. A nyugta beadás után a **képernyőre görög** (élő és demó ágon is, `prefers-reduced-motion`-t
   tisztelve, fókusszal együtt).
6. A felfüggesztett lapon az e-mail és a telefon **aláhúzva** — eddig a címsorral azonos hatás.
7. `huDay` → a közös `src/text/day.ts` (ADR-0144 ② ide nem ért el), nyelvvel együtt.
8. `scripts/shot-booking-form.mts` **halott volt** (strict-mode locator a jogi mondat óta) — él,
   16/16 zöld.

**Őr:** `scripts/booking-outcome-truth-check.mts` — A) sor-igazság (7+3 állítás, 48/24/0 órás
ablakkal), B) a visszaút (és hogy nem vakon az ELSŐ egységet írja), C) nyugta-láthatóság
böngészőben, footerrel, 390 és 1280 px-en. **Piros önteszt:** a görgetés-hívást kivéve mindkét
méret pirosra megy (−651 / −63 px), az A/B szakasz közben zöld marad — ettől SPECIFIKUS a piros.
**Önkontroll:** ha a mért hívás eltűnik a futásidőből, az önteszt hangosan bukik, nem „bizonyítja"
csendben, hogy az őr vak. `hooks/pre-commit`-be kötve a négy érintett fájlra.

## §2b terv-kapu — MEGÁLLTAM

Négy kattintható mock (`assets/design-refs/_drafts/b8-{tulaj,vendeg}-{A,B}.html`), mind a két
méretben, valós adat-mintával és VALÓDI viselkedéssel (validáció, szűrés, fedés-választó,
ár-számítás). Részletek: `TERV-KESZ.md` a munkafa gyökerében.

⚠️ **A méret-váltó telefonon nem működött.** A `@container` helyes, de 390 px-es képernyőn nem tud
1080-at mutatni: az „Asztali" gomb NEM CSINÁLT SEMMIT, vagyis a tulaj a döntés felét nem látta
volna. Megoldás: a lap 1080/1120 px-en marad, és `zoom`-mal kicsinyítjük — a konténer-lekérdezés
az asztali elrendezést látja, a szem a telefont. Mérve mindkét méreten.

## Hibák, amiket ÉN követtem el közben (és mit tanultam)

- A magyar záró idézőjel helyett gépelt `"` a JS-sztringben **az egész scriptet megölte**
  (SyntaxError) — a lap némán üres maradt, és a screenshot ezt „stílus-problémának" mutatta.
- Egy sablon-sztringbe írt **backtick** (`` `scrollIntoView` ``) szétvágta a `page.evaluate`
  kódját: transform-hiba, az őr el sem indult.
- A `python str.replace("  drawCal();")` **a négy szóközzel behúzott** példányra is illeszkedett,
  és a beszúrt blokk a hónap-lapozó kezelőjébe került. A kattintós teszt ettől ZÖLD maradt (a
  driver amúgy is megnyitja a panelt) — **az álló KÉP buktatta le**.
- Két külön `page.evaluate` a verdikthez és az indoklásához: a görgetés a kettő KÖZÖTT állt meg,
  így a bukás-üzenet `top:0`-t írt egy „nem látszik" verdikt mellé. **Egy mérés, egy ítélet.**
- Az al-pixel: a `scrollIntoView` **−0,4 px**-en áll meg, ami vizuálisan a lap teteje. A szigorú
  „nem-negatív" próba ebből villogó pirosat csinált volna egy helyes lapon — 2 px tűrés kell.

## ⛔⛔ A LANDOLÁS TÖRÖLTE A MOCKJAIMAT (a kör MINDEN szálát érinti)

A `scripts/land.sh` a záráskor `rm -rf assets/design-refs/_drafts` (ADR-0077, §2b 6.). Nálam ez
**a jóváhagyás ELŐTT** futott le: a négy mock eltűnt, és a `TERV-KESZ.md` halott útvonalakra
mutatott. Az ADR indoklása — „a vázlatok EGY paranccsal determinisztikusan újragenerálhatók" —
**kézzel írt §2b mockra nem igaz**; és ebben a körben a tulaj a landolás UTÁN dönt, egy
orchestrátor-sessionből.

**Mérve azonnal:** 8 szálnak van `TERV-KESZ.md`-je, és rajtam kívül mindegyiknél még ott a
`_drafts/` (9–293 fájl) — **mert még nem landoltak**. Amint landolnak, ugyanígy elvesztik.

Újraépítettem a `b8-terv/` mappába (a land nem söpri), a CSS-hivatkozás `../public/...`-ra
javítva, és a kattintás-próbát is újrafuttattam: **32/32 zöld, 0 JS-hiba**. A próba is ott él
(`b8-terv/mock-drive.mts`), hogy a bizonyíték a mock MELLETT maradjon.

**Javaslat (tulaj-döntés):** vagy a `land.sh` hagyja ki a `_drafts/`-ot, amíg a fa gyökerében van
`TERV-KESZ.md`, vagy a §2b mondja ki, hogy a jóváhagyásra VÁRÓ vázlat nem a `_drafts/`-ba megy.

## Nyitva

① A 2. pont (hírlevél) tulajdonosi döntése · ② a `TERV-KESZ.md` 9 kérdése · ③ a natív `confirm()`
a lemondáson **az A6 szálnál** van (nem nyúltam hozzá) · ④ a „⚠️ BIZONYTALAN" naptár-szín lelet
**mérve NEM lelet**: a kijelölés zöld (rgb 47,169,107), a cián csak `:hover`, a múlt opacity 0,35.

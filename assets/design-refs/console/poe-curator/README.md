# Poe — Forrás-csomag nézet + Generálás kurátori szöveggel — jóváhagyott terv (2026-10-05)

Tulajdonosi döntés: **2026-10-05 ~11:45**, a koordinátoron át:
1. A két nézet szerkezete: JÓVÁHAGYVA.
2. Az űrlap helye: MINDKETTŐ — a lead-lap „Mock és generálás” panelében ÉS saját lapként is.
   Egy komponens, két belépő (nem két kód).
3. Vendég-hang csillag-szűrés: IGEN (≥4★ — landolt: `src/generator/guestVoice.ts`).
4. A földrajzi „medence” nem „Medence” szolgáltatás (landolt: `src/generator/marketCheck.ts`).

Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat. A szöveget a
kurátor (Poe, a digitális munkatárs) írja a Forrás-csomagból; a gép a fotókat és a kinézetet adja.

**Hatókör:** `src/console/curatorViews.ts` · `src/console/views.ts`

Kötő feliratok (a kódban szó szerint így):
- A lead-lap füle: **„Forrás-csomag”** · blokkok: **„Kitöltendő mezők sablononként”**, a szobák
  jelölése **„a szövegíró NEM látja”**, az elavult Google-vélemény mellett **„a generálás frissíti”**.
- Az űrlap: **„Generálás kurátori szöveggel”** · gombok: **„+ Új kiemelés”**, **„+ Új tény”**,
  **„Generálás ezzel a szöveggel”**.
- A haladás-sáv a kurátori futás szöveg-szakaszában: **„kurátori szöveg ellenőrzése — AI nem ír”**.
- A mock-kártya pirulája a `copyManual.by` nevét viseli („Poe írta” — összerakott mondat, nem literál).

Eltérés a mocktól (tudatos): a „Neo jegye” oldalkártya helyett a saját lap `?t=a,b` paramétere
előjelöli Neo sablonjait (max 2; a jegy fájlja a konzolon kívül él); a vélemény-szűrő gombsor
(Mind/★1–2/★4–5) helyett a kiszűrt vélemény áthúzva, okkal áll (a lista legfeljebb 10 elem).

Referenciák (VALÓS adat: Mandula vendégház, Badacsonytomaj, dev-lead `ac901b05`):
- `forras.html` — ① Forrás-csomag nézet. „Állapot” kapcsolók: elavult Google-vélemény, ismeretlen régió.
- `urlap.html` — ② „Generálás kurátori szöveggel” űrlap. „Állapot”: napi AI-keret elfogyott, üres
  űrlap, minta-kitöltés. Mindkettőben „Mobil 390px / Asztali” váltó (`@container`).
- `data.js` + `img/g1..g4.webp` — a mock adata (a Mandula csomagja, a fotók helyi másolata).
- Képek: `forras-{mobile,desktop}.png`, `urlap-{mobile,desktop}.png`, `urlap-eredmeny-{mobile,desktop}.png`.
- `pw-check.mjs` — 58 lépés, két méretben (futtatás:
  `CP=<chromium> node assets/design-refs/console/poe-curator/pw-check.mjs`).

A mockban az őr-ítélet SZIMULÁLT (szólista + számjegy). A megvalósításban a valódi őrök futnak.
A mock JS-e a valódi szabályokat tükrözi (`normalizeCopy`, `isDecorFiller`, `validateSellingPoints`,
`parseHex`, `COPY_LIMITS`); a megvalósítás a VALÓDI függvényeket hívja a szerveren, nem a másolatot.

---

## Mit KÖT a terv

### ① Forrás-csomag (a lead-lap új füle)

- PONTOSAN azt mutatja, amit a generálás a szövegírónak ad (`briefInput`), ugyanabban a
  sorrendben. Ennek egyetlen forrása a `src/generator/writerSources.ts` — a motor ÉS a nézet ezt
  hívja; a nézet nem másolja a szabályokat.
- Blokkok: Azonosság és hely · Valós számok · Igazolt szolgáltatások (`decisionWeightDesc`
  sorrendben, a leírásból kiemelt tétel jelölve) · Portál-leírások (≤1500 kar./db, a tulaj saját
  bemutatkozása ELSŐ) · Vendég-hang · A modell által látott 4 fotó · Kitöltendő mezők sablononként ·
  Szobák (a szövegíró NEM látja) · A csomag nyersen.
- A vendég-hang a kiszűrt véleményeket is mutatja, a szűrés okával (★ alatti, rövid, duplikátum,
  a 10-es kereten túli); a ★-szűrt áthúzva.
- **Csak olvas.** A lap megnyitása semmit nem hív (Places, AI). Ha a tárolt Google-vélemény
  30 napnál régebbi, nem kéri le újra, hanem kimondja: „a generálás frissíti”.
- Lustán töltődik (a fül nyitásakor), mert a fotó-feloldás élőség-mérést végez.

### ② Generálás kurátori szöveggel (űrlap — panelben ÉS saját lapon, egy komponens)

- EGY szövegkészlet, 1–2 sablon (Neo jegyéből); mindkettő ugyanazt a szöveget kapja.
- Mezők: főcím (kötelező) · dőlt kiemelés (a főcím szó szerinti része) · alcím · bemutatkozás ·
  1–6 kiemelés („+ Új kiemelés”) · tények idézettel („+ Új tény”, opcionális) · akcentszín
  (`#rrggbb`, opcionális). Mezőnként áll, melyik sablonon látszik; ami nem, annál „nem látszik”.
- Élő validáció a SZERVER valódi `validateCuratorCopy`-jával (nem kliens-másolattal): kötelező mezők,
  `COPY_LIMITS` hossz-korlát, normalizálás (szóköz-összevonás, cím legfeljebb 2 sor), a dőlt kiemelés
  a főcímben, a berendezés-leírás kiemelés kiesik, az idézet szó szerint a forrásban (különben a tény
  kiesik, a generálás nem áll meg), az akcentszín formátuma. Hiba → a gomb tiltott.
- A generálás AI-szövegírót NEM hív: a fotók és a render fut, a három őr EGYSZER ítél.
- Haladás a meglévő generálás-sávval (GEN_STAGES). A napi AI-keret elfogyásakor a gomb tiltott,
  a felirat kimondja.
- Az eredmény-kártyán „Poe írta” pirula (`copyOrigin=curator`, `copyManual.by`), az őr-ítélettel.

---

## Szerver-oldal

- `src/generator/writerSources.ts` — a szövegíró forrás-csomagja, tiszta függvény (motor + nézet).
- `POST /lead/:id/curated-check` — JSON-ból `{ ok, errors, warnings, copy }`; a lead csomagja a korpusz.
- `POST /lead/:id/generate-curated` — JSON: `{ templates[], copy }`; ugyanaz a fire-and-forget
  gépezet, mint a `/generate` (plafon-tiltás futás ELŐTT, haladás, eredmény).
- `GET /lead/:id/source-pack.json` — a Forrás-csomag adata; Places-t nem hív.

# A mock szövegének kézi átírása — jóváhagyott terv (A + B, 2026-10-04)

Tulajdonosi döntés: **2026-10-04**, a koordinátoron át, diktálva: „Szöveg: Isis. Előnézet és mező.
A többi javaslat szerint oké.”

A tulaj kérése: „a mockoknál lehessen manuálisan újraírni a szöveget”. Két változatot látott asztali
ÉS mobil képen, kattintható HTML-lel, és **MINDKETTŐT** választotta. A két változat ugyanazt az adatot
írja, egyetlen mentési úton. Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem
stílus-javaslat.

> ⚠️ A `**„…”**` alak ebben a fájlban **felületi feliratot** jelöl. A `contract-drift-check` pontosan
> azokat keresi vissza a hatókör fájljaiban.

**Hatókör:** `src/console/copyEditViews.ts` · `src/console/views.ts`

Referenciák:
- `plan.html` — kattintható, VALÓS adattal (Bánó Porta Köveskál). Van benne A/B váltó, „Mobil
  390px / Asztali” váltó és „befagyott mock” állapot-kapcsoló.
- `b-preview.html` — a B változat: a valódi generált mock a szerkesztő sávval.
- Képek: `A-asztali.png`, `A-asztali-mentve.png`, `A-mobil-mentve.png`, `B-asztali-mentve.png`,
  `B-mobil-mentve.png`, `B-mobil-reszletek.png`.

A mockban a kapu-eredmény SZIMULÁLT (szólista + számjegy). A megvalósításban a valódi őrök futnak.

---

## Miért van

Ma a lead-lapon a mock szövege csak olvasható. Az egyetlen beavatkozás az AI-újraírás („Szöveg
újragenerálása”, utasítással), ami az EGÉSZ szöveget újraírja. Egy elírást, egy rossz szót, egy túl
hosszú alcímet a kurátor nem tud kijavítani anélkül, hogy minden mást is újraíratna.

---

## Mit KÖT a terv

### ① A — mezős űrlap a mock-kártyán

A kártya kinyitott részén áll a **„A mock szövege — kézi átírás”** blokk. Benne MINDEN szerkeszthető
mező, csoportosítva:
- **Nyitó rész:** főcím, dőlt kiemelés a főcímben, alcím, felső sor.
- **Bemutatkozás.**
- **Kiemelések:** soronként, törölhetők; az **„+ Új kiemelés”** gombbal bővíthető.
- **Szakasz-címek:** felső sor + cím szakaszonként.

Szabályok:
- Mezőnként áll, HOL jelenik meg. Amit az adott sablon nem rajzol ki, annál ez áll:
  **„ezen a sablonon NEM látszik”**. A mező ettől még szerkeszthető, mert más sablonon látszhat.
- A blokk kinyitásakor a kártya a teljes sort kapja: egy harmad-szélességű kártyába nem fér űrlap.

### ② B — helyben szerkesztés az előnézeten

A kártya **„szöveg szerkesztése ▸”** linkje a kurátori előnézetet nyitja. Ez a mock a felül álló
sávval; a sáv kapcsolója: **„Szöveg szerkesztése”**.

A `/mock/<id>` link VÁLTOZATLAN marad. Azt a lead is megkaphatja, ezért arra szerkesztő sáv SOHA nem
kerül.

Bekapcsolva:
- A szerkeszthető szövegek szaggatott keretet kapnak.
- Kattintásra helyben írhatók: Enter = kész, Esc = elveti.
- A főcímben kijelöléssel + „Dőlt” gombbal állítható a kiemelés.

Csak az írható így át, ami az adott sablonon LÁTSZIK. A többit a sáv megnevezi, és az A blokkba
irányít.

A **származtatott** szöveg külön szabályt kap. Ha a sablon a bemutatkozónak csak az első mondatát
mutatja, az átírás CSAK azt a mondatot cseréli, a bekezdés többi része megmarad. Ezt a szerkesztő ki
is mondja.

### ③ Mobilon az alsó sáv EGY sor

Az első körben a mentés utáni alsó sáv a 390 px-es képernyő ~45%-át fedte (tulajdonosi kifogás).
A sáv ezért egy sorba fér:
- összegzés,
- egy őr-jelvény,
- **„Részletek”**,
- „Mentés”.

A lista, az őrök indoklása és a visszaállító gombok lenyitva jelennek meg. Mérve: 50 px (6%) a 844 px
magas mobil nézetben. Asztalin a részletek nyitva állnak.

### ④ „Kézzel átírva” jelölés — mezőnként és a kártyán

- A mentett, az AI-eredetitől eltérő mező **„kézzel átírva”** jelölést kap.
- A kártya fejlécén ugyanez a darabszámmal áll.
- Az eltérő mező alatt látszik az eredeti AI-szöveg.

### ⑤ Visszaállítás három szinten

- Mezőnként: **„Eredeti visszaállítása”**.
- Egyben: **„Minden mező vissza az eredetire”**, megerősítéssel.
- A még nem mentett változtatásokra: **„Elvetem a változásokat”**. Ez a legutóbb MENTETT állapotra
  áll vissza, nem az AI-eredetire.

### ⑥ Validáció (a VALÓDI korlátok: `src/engine/copyFields.ts` → `COPY_LIMITS`)

- **Korlátok (D5, egy közös konstans):** főcím 140, dőlt kiemelés 60, felső sor 60, alcím 160,
  bemutatkozás 600, szakasz-cím 90, egy kiemelés 80, legfeljebb 6 kiemelés.
- **Kötelező mezők:** a főcím, az alcím és a bemutatkozás üresen nem menthető. Legalább egy kiemelés
  kell; az üres kiemelés-sor kimarad.
- **Dőlt kiemelés:** ha nincs szó szerint benne a főcímben, figyelmeztetés jelenik meg, és a főcím
  dőlt rész nélkül rajzolódik ki. Ez ugyanaz a szabály, mint az `accented()`-é.
- **Hiba esetén** a mentés tiltott.
- **Csak a változott mezőt méri a korlát.** Egy hosszabb AI-eredeti nem blokkolja egy másik mező
  mentését.

### ⑦ Mentés = csak a szöveg cserél, és az őrök újra ítélnek (D2)

A mentés csak a szöveget cseréli: kinézet, fotók és elrendezés marad. Mentéskor újra lefut:
- a tényhűség-kapu,
- a marketing-őr,
- a vendég-kritikus (magyar oldalon).

A vendég-kritikus itt CSAK ítél, a kézi szöveget SOHA nem írja át.

Az eredmény a kártyán és a sávban látszik. A „fennakadt” mock nem küldhető ki, csak a meglévő
nyugtázással. A korábbi nyugtázás (`verdictAck`) a szöveg-cserével ÉRVÉNYÉT VESZTI: új szöveg = új
lelet.

### ⑧ Befagyott mock

Ha a mockra már kiajánló link készült, a mezők csak olvashatók, és a szerkesztő sáv kapcsolója
letiltva áll. Ez ugyanaz a szabály, mint az AI-újraírásnál (§I).

### ⑨ Az AI-újraírás a kézi mezőt NEM írja felül (D3)

Az AI-újraírás a kézzel átírt mezőket rögzítve hagyja, és csak a többit írja újra.

Teljes újragenerálásnál (új mock) a kézi szöveg NEM vándorol át (D4).

---

## Adat

- **Tárolás:** `mock_artifact.inputs.copyManual = { "<mezőkulcs>": { value, orig, source: "curator", by, at } }`.
- **A kirajzolt szöveg:** az érték a `recipe` / `siteData` mezőibe is beíródik, így élesítéskor a kézi
  szöveg magától élesre megy.
- **Visszaállítás:** a kulcs törlése + az `orig` visszaírása.
- **Sablon-horgok:** minden sablon minden kirajzolt szöveg-mezőn `data-cit-copy="<kulcs>"` horgot visel.
  - Kiemelésnél `data-cit-copy-i`.
  - Származtatott nézetnél `data-cit-copy-part="first-sentence"`.
  - Őr: `scripts/copy-hook-check.mts`.

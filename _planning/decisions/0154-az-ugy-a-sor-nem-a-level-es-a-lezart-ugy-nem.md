## ADR-0154 — Az ÜGY a sor, nem a levél; és a lezárt ügy nem riaszt (2026-09-14)

**Kontextus.** Az Elek FK-001 2026-09-13-i futása a tenant-admin Üzenetek fülén három,
egymást erősítő leletet adott — és mindhárom ugyanarra vezetett vissza: **a lista a
LEVELEKET számolta, nem az ÜGYEKET.**

- **E1** — a 71 soros lista **69%-a túlhaladott** dunning-értesítő volt, ugyanannak az EGY
  előfizetés-ügynek a lépései, 9 körben ismételve. A lap **8817 px**, ≈9 képernyő.
- **E2** — a bal menü **71**-et riasztott, és abból **49** olyan sor volt, amit a rendszer
  MAGA nyilvánított elavultnak. Teendőnek mutattuk azt, amit mi magunk zártunk le.
- **E3** — 19 számla-értesítő előnézete **betűre azonos** volt („Kedves Elek Teszt!"),
  mert a szabály „a törzs első nem-üres sora" volt, a törzs pedig megszólítással kezdődik.

**⛔ Ez FELÜLÍRJA az ADR-0127 ① döntését** („a szálba csukás nem épül meg"). Az a döntés a
**foglalás-szálakra** mért adatból született: ott a csukás 35 sorból egyet nyert volna,
miközben 34 KÜLÖN foglalást rejtett volna el. **Az az érvelés áll, és ez a döntés nem is
bántja a foglalás-szálakat** — amit felülír, az a következtetés kiterjesztése a
dunning-létrára, amiről az Elek AZÓTA mérte meg, hogy önmagában 50 sor EGYETLEN ügyről.
§2b kapu, tulajdonosi döntés 2026-09-14 („C — Ügyek, nem levelek"), három működő vázlatból.

**Döntés.**

1. **AZ ÜGY A SOR.** Egy állapot-szál EGY soron áll a mai állapotával; a korábbi lépések egy
   **megnevezett, darabszámot mondó** nyitó mögé kerülnek. A csoportosítás a
   `messageThreads.ts` `thread.key`-éből jön — a nézet NEM ismétli meg a szálasítás
   szabályát (`feedback_label_must_derive_from_predicate`).
   - ⛔ **A csukás semmit nem vesz el.** A találat-szám ÜZENETET számol, nem sort, és a
     keresés a csukott ügy lépésére is talál. Egy szűrő, ami elrejtene egy találatot,
     pontosan az a hibaosztály, ami ezt a kört elindította — az őr külön állításként méri.
   - ⚠️ **Mérve, hogy ne várjunk tőle többet:** a park összetételén **71 üzenet → 22 sor**,
     nem a jóváhagyáskor elhangzott ~12. A maradék 19 sor a 19 SZÁMLA, amit az ADR-0125
     szándékosan nem szálasít (egy új számla nem teszi valótlanná a régit). A nyereség
     tehát **50 dunning-sor → 1 ügy-sor**.
2. **A TÚLHALADOTT ÜZENET NEM OLVASATLAN.** `isUnread = readAt === null && !supersededBy`.
   - ⛔ **EGY SZABÁLY, EGY FORRÁS:** ugyanez adja a bal menü jelvényét, az „Olvasatlan" chip
     számát, a lista szűrőjét ÉS a tömeges jelölés hatókörét. A `countUnreadMessages()`
     ezért **már nem `COUNT(*) WHERE read_at IS NULL`**: az „ez még hatályos-e" a SZÁL
     tulajdonsága, ami abban a WHERE-ben nem fejezhető ki — egy SQL-ág és egy JS-ág a két
     példány elcsúszása lenne (`feedback_one_rule_two_copies`), és a jelvény 71-et mondana,
     miközben a lista 22-t mutat.
   - A `read_at` a DB-ben VÁLTOZATLANUL `null` marad a túlhaladott sorokon: nem hazudjuk,
     hogy a tulaj elolvasta őket — csak nem riasztunk rájuk.
   - A tömeges jelölés **pontosan azokat a sorokat billenti, amiket megszámolt**; a korábbi
     szűretlen ág vak `UPDATE`-je ezért kivezetve.
   - Mérve a szállított kódon: **olvasatlan 65 → 21**.
3. **AZ ELŐNÉZET A TARTALOM, NEM A MEGSZÓLÍTÁS** (`src/tenant/messagePreview.ts`).
   - ⛔ A kihagyandó sorok listája a **KÜLDŐ `T()`-sablonjaiból** épül, nem szöveg-
     heurisztikából: egy „rövid sor, felkiáltójellel" szabály magyar szokás lenne
     szabálynak öltöztetve, és némán elrohadna az első idegen nyelvű postaládán.
   - Számlánál az áll ott, ami a **CÍMBŐL hiányzik: az ÖSSZEG**. ⚠️ Mérve: az „összeg +
     tétel" előnézet 19 sorra csak **4-félét** adott, mert a tétel MÁR a címben van.
   - **A SOR EGÉSZE egyedi** (cím + előnézet együtt), és az előnézet **nem visszhang**:
     tárgy nélküli SMS-nél, ahol a cím a törzs első sora, az előnézet ÜRES marad.
4. **A sor megmondja, hogy megnyitható** („Megnyitom ▾"). A 90 karakternél csonkolt
   előnézet mellett eddig semmi nem jelezte; a mérő-futás meg sem próbálta megnyitni (KK3).
5. **A TÖMEGES JELÖLÉS IGE, ÉS MEGERŐSÍTÉST KÉR.** A régi „Mind olvasott (71)" állítás-alakú
   volt, ige nélkül, közvetlenül az „Olvasatlan 71" SZŰRŐ mellett. A megerősítés **JS
   nélkül** működik (GET-link → megerősítő doboz → POST); natív `confirm()` nem járható út,
   az stílustalan böngésző-ablakot adna. A megerősítés **kimondja a hatókört**.
6. **HÁROM KÉRDÉS, HÁROM SOR** a szűrőben: „Miről szól" · „Hogyan jött" · „Állapot".
   ⛔ Ez **módosítja az ADR-0127 ② két soros** elrendezését, ahol a „Szűkítés" sor csatornát
   és olvasottságot kevert (Elek Z2). ⚠️ Ára mérve: a sáv 390px-en **205px** magas.
7. **A DOKUMENTUMOK ÖSSZEGZŐJE MEGNEVEZI MAGÁT:** „Eddig kifizetett" + „Jelenleg fizetendő".
   A fizetendő a **MÉRT** `subscription.arrears`, nem a számla-listából következtetett nulla:
   ha nincs előfizetés, a cella KIMARAD (§B.17 — egy ki nem számolt nulla is állítás).

**⛔ Amit ez a döntés NEM érint** (tulajdonosi megerősítés ugyanabban a körben): a
**számla-sorok felépítése** a Dokumentumok listán (ADR-0125 ③), a `dunning → szamlazas`
téma-besorolás (ADR-0127 ①), és hogy a **számla nem állapot-szál**.

**Miért nem fogta meg ezt semmi eddig.** Mindhárom lelet mellett zöld maradt minden kapu: a
szálasítás MŰKÖDÖTT (csak nem csukott), az olvasatlanság MÉRHETŐ volt (csak rossz kérdésre
felelt), az összeg OTT VOLT a törzsben (csak nem jutott a sorig). Ezért az őr
(`scripts/admin-list-labels-check.mts`, ⑨/⑩/⑪ blokk) a **RENDERELT** listán mér, hermetikus
fixture-rel, és a saját olvasatlan-szabályát FÜGGETLENÜL vezeti le — nem a termék
`isUnread()`-jét hívja (`feedback_guard_must_not_borrow_its_subject`). 9 új állítás, mind
PIROSRA megy az öntesztben (31 sértés a visszarontott nézeten).

⭐ **Amit a saját őröm talált a saját kódomban:** egysoros SMS-nél az előnézet megismételte a
címet · az őr INDEX szerint párosított sort a fixture-höz, és a csoportosítás után elcsúszva
a TERMÉKRE fogta volna a hibát · a fixture `"…"` törzse miatt az előnézet-szabály MÉRETLEN
maradt. Két magyartalanságot is magam gyártottam („mind a 1 üzenetet", „A(z) {tárgy}") — a
számnév előtti névelő ugyanaz a gépi csapda, amit az Elek külön leletként jelentett.

**Kapuk.** `admin-list-labels-check` (pre-commit, +`messagePreview.ts` hatókörrel) ·
`contract-drift-check` (a befagyasztott README kötő feliratait méri a szállított kódon).

**Kontraktus:** `assets/design-refs/tenant-admin/uzenetek-ugyek/` (tulaj jóváhagyta
2026-09-14; README + működő terv + mobil/asztali kép).

**Visszafordíthatóság:** 🔄 — felület- és lekérdezés-szintű, nulla migráció, nulla
adat-mozdulat. A `read_at` oszlop jelentése változatlan.

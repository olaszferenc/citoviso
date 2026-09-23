## ADR-0133 — Az egyediség-állítás nevezze meg a halmazt, amiben egyedi (2026-09-13)

**Kontextus.** Az Elek **FK-006b** újramérése a fizető tenant Üzenetek fülén adta a
leletet: a feed tetején **két sor viselte egyszerre** a zöld **„Ez a legfrissebb"**
jelvényt — a „Lejárt egy foglalási kérés…" és harmadikként a „Honlapja újra elérhető" —,
mindkettő **azonos időbélyeggel** (14:54). A bejelentés úgy szólt, hogy „az egyik biztosan
hamis".

**⛔ A mérés a bejelentés OKÁT cáfolta, a TÜNETÉT nem.** A `src/tenant/messageThreads.ts`
`positionThreads()`-ét visszaolvasva a jelölés **szálanként** születik: a `threadKeyOf`
szerinti csoportban a legújabb `sentAt` nyer, és csak akkor, ha a szálnak **van** korábbi
tagja (ADR-0125 ⑤). A két jelvény tehát **két KÜLÖN szál feje** volt — egy foglalási kérés
(`booking`/`related_id`) és a dunning-létra (`dunning`/tenant) —, vagyis **egyik állítás
sem volt hamis**. Ha a „hamis állítás" premisszáját elhiszem, egy helyes szabályt rontok el
(`feedback_measure_the_premise_not_the_request`).

**A valódi rés a MONDATBAN volt.** A jelvény **egyediséget állít, de nem nevezi meg a
halmazt**, amiben egyedi. Egy listában egymás alatt az olvasó egyetlen halmazt lát — a
képernyőt —, ezért két „ez a legfrissebb" ellentmondásnak olvasódik. Ugyanaz a hibaosztály,
mint az ADR-0125 E1/Z2-e: **az adat megvolt (a szál kulcsa), csak nem jutott el a SORIG.**

**Döntés (tulajdonosi választás, §2b, előnézetes változatokból).**

1. **A SZÁL TÁRGYA A REGISZTERBŐL JÖN.** A `STATE_THREADS` bejegyzés a szabály mellé
   megkapta a szál **nevét** is (`előfizetés` · `foglalási kérés` · `többnyelvű modul`).
   A jelvény **FELIRATA és PREDIKÁTUMA ugyanabból a táblából** származik, tehát egy sor
   szerkezetileg nem nevezhet meg olyan szálat, amiben nincs benne
   (`feedback_label_must_derive_from_predicate`; a `messageTopics.ts` / `invoiceItem.ts`
   mintája). Új állapot-szál **név nélkül nem fordul le**.
2. **A FEJ IS MEGMONDJA, MIT VÁLT LE** — a „Felülírta: …" sor tükreként: hány korábbi
   üzenetet ír felül, és **pontosan egynél annak a CÍMÉT is**. Ez nem díszítés: a
   `tenant`-szabályú szálakból fiókonként EGY van (két „előfizetés"-fej nem létezhet), a
   `related`-szabályúból viszont sok — **két külön foglalási kérés feje azonos nevet visel**,
   és csak a felülírt üzenet neve különbözteti meg őket. A hármas/ötös dunning-létra
   ezért **számot** kap: egy önkényesen kiválasztott cím ott félrevezetne.
3. **AZ ADR-0125 ⑤ TÚLHALADOTTSÁGA VÁLTOZATLAN.** A jelölés továbbra sem rejt el semmit,
   a teljes postaládán dől el, és a kimaradó `kind`-ok köre sem mozdul.

**Ráadás ugyanabból a körből (FK-006b HIBA-3): a nyers azonosító a fizető ügyfél előtt.**
A kifizetett (14 900 Ft) többnyelvű modul nyugtáján ez állt: „Hivatkozási azonosító:
`mock_837a03b6-5940-4da3-a470-34dd7f6258d3`" — a **fizetési szolgáltató belső kezelője**,
aminek a látható előtagja azt üzeni a fizetőnek, hogy **nem valódi tranzakció** történt
(ADR-0126 ①: a fejlesztői azonosító nem felhasználói szöveg).

4. **A HIVATKOZÁS A MIÉNK, ÉS VISSZAVEZET.** `src/payment/publicRef.ts`: a szám a **saját
   `payment.id`-nkból** képződik (`CIT-837A03B6`), nem a szolgáltatóéból — létezik, mielőtt
   a gateway válaszol, túléli a szolgáltató-cserét, és nem szivárogtat vendor-nevet. Ugyanaz
   a képző a nyugtán **és** a fizetés-bukás képernyőn. ⛔ **A „ha ír nekünk, kérjük idézze"
   csak akkor igaz mondat, ha vissza is vezet:** `scripts/find-payment.mts CIT-837A03B6`
   feloldja (a régi nyers kezelőt is elfogadja). Egy szám, amit kiírunk, de nem tudunk
   visszakeresni, ugyanaz a hiba szebb ruhában.

**Kapuk.** `admin-list-labels-check` ⑦ — a **renderelt** listán: minden jelvény megnevezi a
szálát (**független** `kind → tárgy` referenciával, nem a vizsgált függvényt hívva,
`feedback_guard_must_not_borrow_its_subject`), az azonos tárgyú fejek megnevezik a felülírt
üzenetet, a több tagú szál számot mond, a szálon kívüli sor semmit. A fixture **második
foglalás-szálat** kapott, különben az azonos tárgyú eset meg sem jelenne. Önteszt 14 → **16
sértés** (a rontás célzottan a JELVÉNYT üríti ki, nem a szálasítást — különben a ⑦ üresen
zöld maradna). · `module-purchase-state-check`: emberi hivatkozás a nyugtán, a nyers kezelő
**nem** szivárog (helyi rontással bizonyított detektor), és kör-próba az idézhetőségre. ·
`messageThreads.ts` felvéve az `i18n-sources` listájára (a szál neve vevő-oldali felirat).

**Kontraktus:** `assets/design-refs/tenant-admin/fk001-dokumentumok-uzenetek/README.md`
kiegészítve (nem felváltva) — a jelvény-szabály ott is a mérés indoklásával áll.

**Visszafordíthatóság:** 🔄 — felület- és szöveg-szintű, nulla migráció, nulla adat-mozdulat.

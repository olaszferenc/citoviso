## ADR-0121 — A hideg megkereső levél megszólítása ELÖL és NÉVVEL, a szöveg T/1-ben; a levél viseli a hirdető cégazonosítását

**Dátum:** 2026-09-11 · **Státusz:** ELFOGADVA (tulajdonosi döntés két kérdésre: „Elöl, NÉVVEL"
és „T/1 — »mi«") · **Kontraktus:** `assets/design-refs/console/outreach-mail/` ·
**Felülírja:** ADR-0101 ① (a sorrend részét) · **Kapcsolódó:** ADR-0110 (`config.legalEntity`
mint EGY igazságforrás), ADR-0112 (a mobil ág „A Citoviso Csapata" aláírása), §C.2/§C.3.

**Kiváltó (Elek FK-004, mérve):** a levél szövege három személyben beszélt — „néztük" →
„készítettem" → „mi élesítjük" —, a megszólítás a nyitómondat UTÁN állt és névtelen volt
(„Tisztelt Vendéglátó!"), a hirdető jogi entitása pedig sehol nem szerepelt a levélben.

**① A megszólítás a levél ELSŐ sora, és a lead NEVÉT viseli.** Ez az ADR-0101 ① sorrendjét
írja felül, tudatosan. Az ADR-0101 azért tette a horgot előre, mert a levél első ~90
karaktere a Gmail előnézet-sora, és a névtelen formula ebből ~21-et elégetne — ez a mérés
ma is áll. A **névvel** ellátott megszólítás viszont semmit nem éget el: pont a név az, ami
személyessé teszi az előnézet-sort. A név ezért a HOROGBÓL kimarad (nem ismétlődik egy
sorral lejjebb, ami körlevél-hatást kelt), és a §C.3 személyre-szabási horgony a
megszólításba költözik — az is próza, az is a kapu alatt van. A névelő-probléma fel sem
merül: a megszólítás alanyesetű, nincs mit ragozni (ADR-0101 „a(z)"-tilalma érintetlen).

**② A levél végig T/1-ben („mi") beszél.** A választás nem stilisztikai: a tervet a
rendszerünk állítja elő, nem az aláíró rajzolja — az E/1 („én néztem át") 593 leaden
feszülne a valósággal (§B.17 magunkra is áll), és a mobil ág már „A Citoviso Csapata"
aláírással megy (ADR-0112). Az eszkalációs utókövető levél ugyanezt kapja, hogy a két
levél ne beszéljen két hangon.

**③ A levél viseli a hirdető CÉGAZONOSÍTÁSÁT.** Az aláírás egy személynevet és a márkanevet
mondta; hideg kereskedelmi üzenetnél ez nem azonosítás (Grt. 6. § / Eker.tv. 4. §): a
címzettnek vissza kell tudnia keresni, kivel áll szemben. A lábazat új sora a
`config.legalEntity`-ből jön — **EGY forrás az impresszummal** (ADR-0110), így a levél és a
publikus oldal nem nevezhet meg két különböző entitást. Üres env → hangos placeholder,
amit a §C.2 kapu kidob; kitalálni semmit nem szabad.

> ⚠️ **Mellékleletet termelt, és ez a tanulság a fontosabbik.** A cégazonosító sor
> beillesztésekor a §C.2 placeholder-heurisztika (`000 0000|123-4567|xxx`) a VALÓS
> **adószámra** sült el (`12345678-1-42` tartalmazza az `1234567`-et), és hibátlan
> feladó-blokkra mondta azt, hogy hamis elérhetőség. Ez ugyanaz a hiba-osztály, mint a
> 2026-09-09-i `xXx`-token: **a heurisztika nem attól jó, hogy mennyire érzékeny, hanem
> attól, hogy MIN mér.** A szabály hatóköre ezért a kapcsolat-blokkra szűkült (az
> azonosító-sor kivonva), és negatív eset őrzi, hogy a szűkítéstől nem tompult el.

**Visszafordíthatóság:** 🔄 — a szöveg egy fájlban él (`src/outreach/draft.ts`), a HTML a
`parts`-ot rendereli (`src/email/outreachEmail.ts`), a §C-kapu változatlanul ítél.

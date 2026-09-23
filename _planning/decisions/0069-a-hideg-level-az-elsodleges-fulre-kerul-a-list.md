## ADR-0069 — A hideg levél az Elsődleges fülre kerül: a `List-Unsubscribe` fejléc kapcsolhatóvá válik

**Dátum:** 2026-08-26 · **Státusz:** **ELFOGADVA** — tulajdonosi rendelet: *„Mindenképpen az a
megoldás kell, amikor a levél a Gmail fiók elsődleges mappájába kerül, képpel."* LOKÁLBAN ÉLES
(`OUTREACH_LIST_UNSUBSCRIBE=off`), **élesre még NEM ment** (külön engedély + deploy kell) ·
**Kapcsolódó:** 03-INVARIANTS §C.1 (leiratkozhatóság), ADR-0030 (outreach-csatornák),
ADR-0036 (ország-kapu).

**Elfogadási mérés (a config-úton, nem kézi felülírással).** A G variáns — hero-képpel, a
fejléc a `OUTREACH_LIST_UNSUBSCRIBE`-ból — kiment, és a Gmail az **Elsődleges** fülre tette
(`category:primary` → találat; `category:updates` → üres). Ez a teljes lánc bizonyítéka:
konfiguráció → kód → postafiók, pontosan abban az alakban, amit a lead kap.

**Kontextus.** A hideg megkereső levél Gmailben kizárólag a **„Frissítések"** fülre érkezett. A
tulaj szavával: *„a fasz se nézi a frissítések mappáját"* — vagyis a levél kézbesítve volt, de a
mock-link gyakorlatilag el sem jutott a leadhez. A gyanú éveken át a beágyazott hero-képre esett
(a kódban is ez állt: „Gmail may still tab an image mail under Updates"), ezért merült fel a kép
elhagyása — ami viszont a „wow"-ot vitte volna el, azt a részt, ami miatt a lead egyáltalán kattint.

**Mérés (nem tipp).** Először a meglévő postafiók vallott: `category:updates` → 3 találat, MIND
outreach; `category:primary` → 8 találat, MINDEN más citoviso-levél (számla, belépési adatok,
nyelv-értesítő). Azonos feladó, azonos Zoho SMTP, azonos SPF/DKIM — tehát sem a hitelesítés, sem a
domain-reputáció nem magyaráz semmit. A különbség egyetlen dolog volt: a `List-Unsubscribe` fejlécet
CSAK az outreach-levél állítja (`outreachEmail.ts`), a többi levéltípus egyiket sem.

Ezután hat kontrollált levél ment ki egy postafiókba (feladó, SMTP, törzs végig azonos):

| | kép | `List-Unsubscribe` alakja | fül |
|---|---|---|---|
| A | van | https + one-click Post | Frissítések |
| B | van | **nincs** | **Elsődleges** |
| C | nincs | https + one-click Post | Frissítések |
| D | nincs | **nincs** | **Elsődleges** |
| E | van | https, one-click NÉLKÜL | Frissítések |
| F | van | `mailto:` | Frissítések |

**Bármilyen** `List-Unsubscribe` → Frissítések (4/4). Fejléc nélkül → Elsődleges (2/2). A 318 KB-os
hero-képet vivő B variáns is Elsődlegesbe esett: **a kép a verdiktre semmilyen hatással nincs.**
Középút nincs — sem az one-click elhagyása, sem a `mailto:` alak nem segít.

**Döntés (javaslat).** A fejléc `OUTREACH_LIST_UNSUBSCRIBE` kapcsolóra kerül. Alapértéke **`on`**,
azaz a mai viselkedés — a jelen ADR jóváhagyásáig semmi nem változik magától.

**Miért nem sérti a §C.1-et.** A jogi követelmény (Grt. / GDPR) egy MŰKÖDŐ leiratkozás, nem egy
konkrét fejléc. A **testbeli** leiratkozó link minden variánsban ott van, és a §C.1 továbbra is
méri a meglétét ÉS az elérhetőségét. A `sendBatch` kapuja ezért a fejlécről átkerült magára az
opt-outra: azt méri, ami számít, nem a kényelmes proxyt. A Google/Yahoo tömeges-feladó előírása
(2024) napi 5000 levél felett kötelezi a fejlécet — nagyságrendekkel a mi volumenünk felett.

**Ára (vállalt).** A fejléc nélkül a címzett nem tudja a Gmail beépített „Leiratkozás" gombját
használni, csak a levélben lévő linket. Ez elvben növelheti a spam-panaszt. A cserearány mégis
egyértelmű: egy fülben, amit senki nem nyit meg, a panasz-kockázat is elméleti — ott a levél nem
konvertál, csak nem látszik.

**Együtt szállított javítások.**
1. **Olvasható link.** A levél egyetlen CTA-ja egy csupasz véletlen token volt ismeretlen
   feladótól (`/p/zk5fv80Z4mMGN6gbQCp45XgU`) — pontosan úgy fest, mint egy adathalász-link. Új alak:
   `/p/<slug>/<token>`, ahol a tulaj a SAJÁT vállalkozása nevét látja a webcímben. A slug kozmetikai;
   a kitalálhatatlan token őriz továbbra is, így senki nem böngészheti mások tervét név beírásával.
   A már kiküldött `/p/<token>` linkek változatlanul élnek (normalizálás + 13 esetes kapu).
2. **Lyukas őr befoltozva.** Az „elérhetetlen link" ellenőrzés néven nevezte a Tailscale-t, de csak
   NUMERIKUS IP-t vizsgált — a `https://mineral.tail3a89f.ts.net:8443` alap ZÖLDEN átment. A kiment
   teszt-levelek olyan linket vittek, amit rajtunk kívül senki nem tud megnyitni, a leiratkozót sem.
   Mostantól a privát hosztNÉV is bukik (`.ts.net`, `.local`, `.internal`, pont nélküli hoszt).

**Nyitva marad.** A mérés EGY postafiókból származik, és a Gmail feladónként tanul; a fül-verdikt
más címzettnél eltérhet. A `scripts/inbox-ab.mts` labbal bármikor újramérhető.

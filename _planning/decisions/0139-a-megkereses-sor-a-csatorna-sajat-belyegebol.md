## ADR-0139 — A megkeresés-sor a CSATORNA saját bélyegéből beszéljen, és a sosem-küldött link forgalma mondja meg, mi nem lehet (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0082 (csatornánkénti
egy-lövés), ADR-0083 (az MMS+SMS páros), ADR-0122 (a garancia alanya a CÍM/ember),
ADR-0135 (ugyanez a képernyő-osztály a piszkozat-lapon), 03-INVARIANTS §B.17.

**Kiváltó (Elek FK-004 Z3 + Z4, tulaj-bejelentés).** A lead-lap egyszerre állította, hogy a
levél „még nem ment ki", és hogy ugyanazon a linken **13 megnyitás · 119 esemény** történt; a
fejléc ehhez „4 megkeresés · ebből 1 ment ki"-t írt, anélkül hogy bárhol kiderülne, mit számol.
Küldés után pedig a lap alján változatlanul ott állt a teljes levél-szöveg és a másoló gomb —
a megismétlést ugyanúgy felkínálva, mint küldés előtt.

**Mérve (és a premissza alatt egy latens mechanizmus-hiba).**

1. **A forgalom valódi, csak nem a leadé.** 5 sosem-küldött követett linkből **3-on** volt
   forgalom, és minden nézet ugyanarról a Linux-desktop böngészőről érkezett: **saját
   megnyitás**. Mindkét állítás IGAZ volt, de egymás mellett lead-érdeklődésnek látszott.
   ⭐ Amit külön megmértem: az ADR-0088 §4 hármas küszöb (−50% ajánlat) **nem** érintett, mert
   az `ensureEscalationOffer` `sent_at` nélkül kilép — a pénz-ág helyes volt, a KÉPERNYŐ nem.
2. **A sor rossz oszlopból beszélt.** A „✓ E-mail elküldve" felirat a **csatorna-független**
   `sent_at`-ból jött, amit a `sendOutreachPair` is beállít — tehát egy **mobil-only**
   megkeresés olyan levelet állított volna, ami soha nem ment ki. ⚠️ Mérve: a parkban ma
   **0 ilyen sor** van. **LATENS hiba, nem mai tünet** — ezt kimondom, mert a javítás értéke
   nem attól függ, hogy hány sor piros ma (feedback: mérd a javítás hasznát, ne csak a hibát).

**Döntés.**

1. **A sor csatornánként beszél, a SAJÁT bélyegéből:** „E-mail elküldve", „Mobil (MMS+SMS)
   elküldve", félbemaradt párosra „Mobil: FÉLBEMARADT páros" (az ADR-0083 szerint a pár
   EGYÜTT a mobil-megkeresés), semmire „még egyik csatornán sem ment ki".
2. **A szám megnevezi, mit számol:** „4 **követett link** · ebből 1 ment ki (**bármely
   csatornán**)". A „4 megkeresés" kétszeresen félrevezetett: nem megkeresés, hanem link
   (címenként egy hideg levél megy, ADR-0122), és a „ment ki" nem az e-mailt jelentette.
3. **A sosem-küldött link forgalma megmondja, mi NEM lehet:** „ez a forgalom NEM a megkeresés
   címzettjétől van — saját megnyitás, előnézet vagy teszt". A számot nem rejtjük el (adat),
   csak nem hagyjuk érdeklődésnek olvasni.
4. **Küldés után a kézi út kimondja, hogy ismétlés lenne** (Z4): a doboz felirata „A KIKÜLDÖTT
   levél szövege", fölötte piros sáv („a másolás a MÁSODIK példányt jelentené a címzettnek"),
   a gomb rákérdez. ⛔ A szöveget NEM vesszük el: az operátornak joga van elolvasni, mi ment
   ki — a §C-előnézet is ezen múlik. A figyelmeztetés a KATTINTÁS ELŐTT áll, nem utólagos
   visszautasításként.

**Őr (`scripts/outreach-row-truth-check.mts`, pre-commitba kötve).** A KIRENDERELT lapon mér,
öt állapotra (csak e-mail · csak mobil · félbemaradt pár · semmi+forgalom · semmi+nulla
forgalom) + a küldés utáni másoló-dobozra. A fixture a TERMÉK forrásából épül (valós
`getProspects()` sor, felülírt bélyegekkel), mert a `scripts/` nincs típus-ellenőrizve, és egy
kézzel írt objektum némán hiányos lenne. **Negatív önteszt:** a régi, csatorna-vak bélyeget
visszaadva **5 mérés megy pirosra**. ⚠️ A „sosem-küldött link forgalma" szabályt ez a hazugság
nem falszifikálja, ezért **különbségi** esettel bizonyítja magát: nulla forgalomnál a
figyelmeztetésnek NINCS ott a helye — egy feltétel nélkülivé tett sáv így megy pirosra.

**Visszafordíthatóság:** 🔄 kód-szintű; a `ProspectView` három új (már létező oszlopból
olvasott) mezőt kapott, migráció nincs.

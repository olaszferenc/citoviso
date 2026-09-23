## ADR-0122 — Az „egyszer megy ki" garancia a CÍMRE szól, nem a prospect-rekordra

**Dátum:** 2026-09-11 · **Státusz:** ELFOGADVA (tulajdonosi elvárás: „Az egyszer-megy-ki
garancia a CÍMRE vonatkozzon, ne a rekordra") · **Kapcsolódó:** ADR-0082 (csatornánként
külön egy-lövés — ÉRINTETLEN), §C.

**Kiváltó (Elek FK-004 ③, mérve):** a konzol azt ígéri, hogy „egy csatornán csak egyszer megy
ki hideg megkeresés". A kapu viszont a küldött SOR `email_sent_at` mezőjére nézett — ami nem
ugyanez az állítás. Két követett link ugyanahhoz a leadhez (új mock, újrafuttatás, operátor
által készített második sor) = **ugyanaz az ember két azonos tárgyú hideg levelet kap**.
A teszt-parkon mérve: két prospect-sor, egy cím, mindkettő küldhető.

**Döntés.** A garancia alanya a MEGSZÓLÍTOTT EMBER, tehát a kapu cím-szintű, kis- és
nagybetűtől függetlenül. Három helyen, egyszerre:
① a küldhető lista címenként EGY sort kínál (különben a képernyő mást számol, mint amit a
szabály tesz — a futás „skip"-et jelentene, ami hibának látszik);
② `sendOutreachMail` cím-szintű előellenőrzést fut, hogy a megtagadás OKA igaz legyen;
③ a CLAIM is cím-szintű: a sor-szintű `WHERE email_sent_at IS NULL` két külön soron
mindkettőt átengedi, ezért a check+bélyegzés **címre vett advisory lock** alatt fut egy
tranzakcióban. Enélkül READ COMMITTED alatt két párhuzamos küldő mindkettőt „szabadnak"
olvasná — pont az a verseny, amit a sor-szintű claim egy szinttel lejjebb már megoldott.

**Amit NEM érint:** a csatorna-függetlenség (ADR-0082) változatlan — az e-mail cím-szintű
lezárása az SMS/MMS ágat nem zárja. A leiratkozás-illesztés (`isEmailSuppressed`) továbbra is
pontos egyezés: a suppression szabályának lazítása külön, jogilag terhelt kérdés, és a
küldést a mostani szűkítés amúgy is lefedi.

**⚠️ A szabály ELŐTTI adat megmarad:** a mérés szerint egy címre (`olaszferenc@gmail.com`)
már ment két hideg levél. Ez megtörtént, nem visszavonható; az őr tényként írja ki, nem
bukásként.

**Őr:** `scripts/outreach-oneshot-check.mts` — olvasás-only (a dev DB minden worktree-vel
KÖZÖS, fixture-t író őr a másik szál mérését rontaná), negatív kontrollal: kiírja, mit
kínálna a RÉGI, sor-szintű szabály — és ha az adat a hibát ki sem tudja fejezni, azt
**kimondja**, nem zöldet állít.

**Visszafordíthatóság:** 🔄 — lekérdezés- és kapu-szintű változás, séma nem mozdult.

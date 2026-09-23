## ADR-0123 — A leiratkozás a POSTAFIÓKRA szól, nem egy írásmódra; és a visszavonás annyira ér el, amennyire a tiltás

**Dátum:** 2026-09-12 · **Státusz:** ELFOGADVA (tulajdonosi utasítás: „csináld meg a
leiratkozás-illesztést is") · **Kapcsolódó:** ADR-0053 (visszavonás + audit-napló),
ADR-0122 (cím-szintű egy-lövés), ADR-0082 (csatorna-függetlenség), 03-INVARIANTS §C.

**Kiváltó (mérve, nem tippelve).** Az ADR-0122 után nyitva maradt, hogy a leiratkozás
illesztése NYERS sztring-egyenlőség. Két lelet jött ki belőle:

**① A tiltás egy ÍRÁSMÓDOT tiltott, nem egy postafiókot.** A mobil ág a kezdetektől
NORMALIZÁLT számot hasonlít (`isPhoneSuppressed`, a kommentje ki is mondja, hogy a
sztring-egyenlőség „silently miss the match"); az e-mail ág nem. Ez csak VÉLETLENÜL
tartott: minden scraper-út kisbetűsíti, amit kinyer (`enrichWebSearch`, `extract`,
`contactLedger`), ezért mind a 397 lead-cím kanonikus alakban állt — **az adat a hibát ki
sem tudta fejezni.** A KEZELŐ ÁLTAL GÉPELT mező viszont csak `trim()`-elt: egy második
követett linkre `Info@Panzio.hu`-t beírva a sor NEM illeszkedett a `info@panzio.hu`-ként
rögzített leiratkozásra, és levelet küldtünk volna annak, aki azt mondta: elég. Pont ez a
mező az, amibe az FK-004 is gépel.

**② A visszavonás némán hatástalan lehetett.** A tiltás cím-szintű, a visszavonás EGY sort
mozdított. Két követett linknél a felület kiírta, hogy „Leiratkozás visszavonva — a
megkeresés újra küldhető", **miközben a küldés tiltott maradt** (élőben mérve:
`resubscribe → ok:true`, `isEmailSuppressed → true`). Ugyanaz a hiba-osztály, mint a
számláló, ami egy kiküldött levélre kettőt mondott.

### Döntés

**A) Egy kanonikus alak, egy forrás** (`src/email/address.ts`: `normalizeEmail` =
körbevágás + kisbetűsítés). A helyi rész kisbetűsítése szándékosan túlmegy az RFC-n (csak a
domain kis/nagybetű-független): **a két tévedés ára nem szimmetrikus** — a túl-illesztés egy
elmaradt hideg levél, az alul-illesztés jogsértés. Elérhető szolgáltató nem kézbesít
`Info@`-t és `info@`-t két külön embernek.

**B) ⛔ A hatókör KIMONDOTT KORLÁTJA: nincs plus-alcímzés- és nincs Gmail-pont-összevonás.**
Mindkettő HARMADIK FÉL postafiók-szemantikájáról szóló állítás, amit nem mértünk; a
pont-összevonás a Gmailen kívül egyenesen hamis (más embert tiltana). Mérve: 397 lead-címből
és 4 prospect-sorból **0** használ plus-alcímzést — a szabály ma tesztelhetetlen bonyolítás
volna. Ha felbukkan, AKKOR döntünk, az esettel a kézben. Az őr ezt a korlátot PINEZI (negatív
állítás), hogy ne csússzon el csendben.

**C) Kanonikus alak az ÍRÁSON is** (`setProspectContactEmail`), de az olvasás nem támaszkodik
rá: minden összehasonlítás normalizál. A read nem függhet attól, hogy a write tiszta volt-e.

**D) A visszavonás annyira ér el, amennyire a tiltás — de EGY TAPODTAT SEM TOVÁBB.** Feloldja
az ÖSSZES sort, amelyik ugyanarra a normalizált címre mutat (mindegyik külön naplósorral: az
aktus öt soron öt tény), majd **ÚJRAMÉRI** a valódi tiltás-predikátumokat, és a visszajelzés
azt mondja, ami történt („…2 követett linken"). Ha valami még tilt — tipikusan a TELEFON-kulcs,
ami másik cím alatti sort is elér —, a felület **megnevezi az akadályt**, nem ígér küldést.
⛔ A telefon-kulcsú sorokat NEM oldja fel: a túl-visszavonás a veszélyes irány (olyan embert
engedne fel, aki nemet mondott, egy olyan cím alatt, amit a kezelő meg sem nézett). Az akadály
megnevezése őszinte; a csendes eltakarítása nem.

**Őr:** `scripts/outreach-suppression-check.mts` — a normalizáló + a **szerkezeti iker** (egyik
illesztési hely sem térhet vissza nyers egyenlőségre; a detektor öntesztelt, és visszarontott
kódon PIROS) + a tárolt adat kanonikussága. A viselkedés-kör (`--live`) külön kapcsolón fut, és
pontosan visszaállít: **a dev DB minden worktree-vel KÖZÖS**, egy commitonként fixture-t író őr
a másik szál mérését rontaná. Ha nincs két azonos című sor, az őr KIMONDJA, hogy nem volt mit
mérnie — nem állít zöldet.

**Visszafordíthatóság:** 🔄 összehasonlítás-szintű változás, séma nem mozdult; a tárolt címek
kanonikus alakja visszaírható (ma mind az is volt).

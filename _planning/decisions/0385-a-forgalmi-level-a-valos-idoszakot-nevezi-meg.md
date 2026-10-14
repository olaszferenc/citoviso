## ADR-0385 — A forgalmi levél a valós időszakot nevezi meg, és csak a legalább 3 hete élő oldalnak megy

**Dátum:** 2026-10-14 · **Kontextus:** az Elek éles teszt 2. köre (2026-10-14), N-1 lelet (`~/wt/cit1cfac043/_elek/JELENTES-2.md`, levél: `mail2/460.txt`). **Kiterjeszti:** ADR-0108 (saját forgalom-mérés, havi levél), ADR-0289 (budapesti naptár).

### Kiváltó
A 2026-10-13 18:01-kor indult [TESZT] Keresztes próba-tenant 10-14 08:00-kor „[TESZT] Keresztes Apartmanház — szeptemberi forgalom” levelet kapott (17 megnyitás, 65% telefon), csupa október 13-i adattal. Két ok a `src/analytics/trafficMail.ts`-ben:
1. a jelentés a megelőző 30 napot méri, a tárgy viszont a (most − 30 nap) HÓNAPJÁNAK nevét írta → „szeptemberi”;
2. az idempotencia hónaponként egy levél, ezért a hónap első futásán minden élő tenant kapott, egynapos is.

### Mit ígértünk
A súgó (`kb/entries/admin-traffic`): „Havonta egyszer e-mailben is elküldjük ugyanezeket a számokat” — tehát a Forgalom fül alapértelmezett „Elmúlt 30 nap” számait, nem naptári hónapot. Ehhez igazodunk: az ablak marad 30 nap, csak a nevét mondjuk ki igazul. Az ÁSZF a levélről nem ígér semmit.

### Döntés
1. **A levél tárgya és első sora a dátumtartomány:** „<szállás> — forgalom, szeptember 14. – október 14.”, a szövegben „Időszak: szeptember 14. – október 14.”. A kezdőnap a 30 napos ablak első budapesti napja, vagy az oldal élesítésének napja, ha az későbbi (a levél soha nem nevez meg olyan napot, amikor az oldal nem létezett); a zárónap a küldés napja (a jelentésnek nincs felső határa, a mai látogatások is benne vannak).
2. **Küszöb: az oldal legalább 21 napja él** (`site.live_at`, ennek híján `provisioned_at`). 21 nap = a 30 napos ablak több mint kétharmada valódi adat. A futtató naponta fut, és hónaponként egy levelet enged, így a fiatal oldal a 21. napon megkapja az első levelét — nem kell a következő hónapig várnia, és egy 14 napos próba alatt nem kap „havi” jelentést. Erősebb (28–30 nap) küszöbnél az első levél jellemzően a 2. hónapra csúszna; gyengébbnél (7–14 nap) a „havi” levél egy-két hét számairól szólna.
3. A futtató `--dry-run`-ja és összesítője a kihagyott fiatal oldalakat külön számolja („még fiatal”).

### Őr
`scripts/traffic-mail-period-check.mts` (új, tiszta): küszöb (élő-bélyeg nélkül, tegnap indult, 21 nap − 1 óra → nem; pontosan 21 nap → igen), időszak-címke (régi oldal, örökölt, 25 napos, UTC-éjfél körüli indulás), a megépített levél tárgya/szövege/HTML-je, és szerkezetileg: a küldő a levél építése előtt nézi a küszöböt, a címke `trafficPeriodLabel`. A `send-window-tz-check` ⑥ a hónapnév helyett az időszak-napot méri Budapest szerint.

### Visszafordíthatóság
🔄 könnyű — séma nem változott; a küszöb egy konstans (`TRAFFIC_MAIL_MIN_LIVE_DAYS`). Élesre a következő deployjal.

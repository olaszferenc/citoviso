# 2026-09-08 — A hideg SMS meghívás lett; a jogi kötelezők a linkelt oldalra kerültek (ADR-0112)

## Miből indult

A tulaj a konzol piszkozat-oldalán olvasta a kimenő kísérő SMS-t, és kimondta: **„ez a
szöveg szar"**. Megadta, mi kell helyette — egy meghívás, aláírással, alatta a link, jogi
formula és második URL nélkül.

## Amit ez ELŐSZÖR jelentett (és amit nem lett volna szabad némán megcsinálni)

A kért szöveg **elbukott volna a saját §C-kapunkon**: nincs benne a leiratkozó-link (C1) és
a jogalap-mondat (C2 fele). Ez nem stílus-kérdés, hanem jogi (Grt. 6. §), ezért a szöveg
átírása ELŐTT megkérdeztem a tulajt három ponton: (1) melyik változat menjen — a kért szöveg
pontosan, vagy jogi farokkal; (2) a feladó „A Citoviso Csapata" vagy a config-név; (3) csak a
páros-SMS vagy mindkét sablon. Döntés: **pontosan a kért szöveg, fix márka-aláírás, mindkét
sablon** — a kötelezők a linkelt előnézet-oldalra kerülnek.

## A munka

- `renderPairSmsDraft` + `renderSmsDraft` új szövege; a `{sender}`/`{unsub}` helyőrző kiesett.
- §C SMS-kapu (`checkOutreachSms`): C1 → csak elérhetőség, C2 → jogalap-mondat helyett
  feladó-azonosítás, a LINK viszont a legszigorúbb elem lett (ő a kötelezők hordozója).
- `injectTrackingNotice` külön modulba (`src/console/prospectNotice.ts`) — a konzol-szerver
  importja SZERVERT INDÍT, így a lábazat mérhetetlen lett volna.
- Két új őr, mindkettő MINDIG fut a pre-commitban, mindkettő negatívan is megmérve:
  `optout-carrier-check.mts` (a hordozó oldal) és `sms-gate-selftest.mts` (a szöveg a kapun).

## ⛔ Amit a jog/provenance-őr talált — a saját munkámban, két körben

**1. kör (8 tétel, mind javítva). A legsúlyosabb: a C2/C3 kapu ÉLESEN NO-OP volt.**
A kapu a nyers üzenet-szövegen mért, az éles link viszont
`https://citoviso.com/p/<lead-slug>/<token>` — benne a **márkanevünk ÉS a lead neve**. Az őr
lemérte: egy senkit meg nem nevező tömeg-szöveg `PASS`-t kapott. Ráadásul a saját öntesztem
zöld volt — mert a dev base URL (`mineral.tail3a89f.ts.net`) történetesen nem tartalmazza a
márkanevet. **A teszt a rossz okból volt zöld.** Javítás: minden „mit MOND az üzenet" szabály
a PRÓZÁN mér (URL-ek kivágva), és a negatív esetek az ÉLES URL-alakot használják.
Továbbá: a lábléc a MEGTEKINTÉS trackingjének jogalapját mondta ki, nem a MEGKERESÉSét (az őr
string-illesztése ezt nem látta); a 404-es előnézet csupasz hibalapot adott kiút nélkül.

**2. kör (3 új tétel, mind javítva).** (a) A fix márka-aláírás miatt a feladó-ellenőrzés
küldéskor NO-OP lett: üres `OUTREACH_SENDER_*` mellett a kizárólagos jogi hordozó **névtelen
hirdetőt** szolgálna ki → új C2-szabály, ami a KÜLDŐ GÉP configját méri. (b) Az őröm ±600
karakteres ablaka a SIKER-ági hívást is elérhette volna → a `send(` hívásra szűkítve.
(c) Az ADR nyitott pontjai hiányosak voltak.

## A kiút útvonala — ELDŐLT (tulaj, 2026-09-08)

**Marad: a leiratkozás a MÉRT OLDAL megnyitásával, a link LEGALUL.** Nem kerül vissza az
SMS-be, és az utat nem tesszük tracking-mentessé. Az őr mostantól szerkezetileg méri, hogy a
lábazat az oldal legalján áll (negatívan is bizonyítva). Vállalt következmény: a
leiratkozás-szándékú megnyitás is beleszámít az ADR-0088 §4 hármas küszöbébe.

**A visszatérő megnyitás folyamata (kiolvasva a kódból):** 1. megnyitás → `mock_view` +
„open" esemény, a státusz `sent` → `opened`. 2. → csak újabb `mock_view`. **3. →
`ensureEscalationOffer`: automatikus −50%, 72 órás ajánlat, és MÁR EZEN a megnyitáson ott a
döntés-kártya.** +24 óra vásárlás nélkül → EGY utókövető e-mail (soha nem ismételve).
Leiratkozás után: a link a semleges lapot adja **rögzítés nélkül** (a `recordView` bele sem
fut, a beacon 204), és a szám/cím személy-szinten tiltott minden további küldésre.

## A leiratkozott látogató — ELDŐLT (tulaj, 2026-09-08)

Tulaj kérdése: „ha valaki leiratkozik de tudatosan megnyitja megint a linket akkor nem tud
vásárolni?" **Mérve: nem tudott** — a `/p/<token>` a semleges `unsubscribedPage()`-et adta
(se mock, se konfigurátor, se rendelés), miközben ugyanaz a lap azt írta, „írjon nekünk
bátran". Következetlen is volt: a `POST /p/<token>/request` sosem nézte a leiratkozást.

**Döntés: megnézheti és meg is rendelheti — de nem mérünk és nem nyomunk.** A `tracked` flag
kikapcsolja: `recordView`, esemény-beacon (a `track` opció el sem megy), eszkalációs ajánlat
mintázása, bármilyen ajánlat-kártya. ⛔ A követett lábazat NEM használható ezen az ágon (azt
állítaná, hogy rögzítünk — §B.17); helyette `injectOptedOutNotice` + felső `injectOptedOutBanner`.
Az őr ⑤ szakasza méri a szöveget ÉS a route négy kikapcsolt mechanizmusát, negatívan is.

## A törött pár — MEGOLDVA (tulaj: „mindenképp az automatikus újra küldés kell")

Három réteg: ① **megelőzés** — a pár el sem indul, ha <60 perc van az ablak (8:00–20:00)
végéig (az MMS-claim visszavonhatatlan, éjjel pedig nem javítunk; a teszt-szám mentesül);
② **automata javítás** — `pairRepair.ts` + `citoviso-pair-repair.timer` percenként a FŐ FÁBÓL
(a modem itt él), backoff 2·5·15·30·60·120·240·480 perc, minden §C-kapu újrafut, az MMS SOHA
nem megy újra; ⛔ az „ablak zárva"/„modem foglalt" NEM használ el próbálkozást (időzítés, nem
hiba — enélkül egy éjszaka felélné a sorozatot); leiratkozás időközben → a pár LEZÁRUL küldés
nélkül; ③ **feladás** — a sorozat végén EGYSZER SMS + e-mail riasztás (a /settings címzettjei,
ADR-0098 mintája), címzett híján hangos napló pecsét NÉLKÜL.

Éjszaka: a tulaj a **szigorú ablakot** választotta (nem a 22:00-ig nyúlást) — ezt ellensúlyozza
a megelőzés. Migráció: `0058_pair_sms_retry.sql` (3 oszlop + részleges index).
Őr: `scripts/pair-repair-check.mts` — 21 állítás valódi DB-fixture-rel, injektált effektekkel
(a give-up ág különben VALÓDI SMS-t küldene a tulajnak minden futásnál); negatívan bukik.

## ⚠️ Nyitott, tulaj-döntést igényel

1. **STOP-válasz** feldolgozása továbbra sincs (ADR-0083 óta nyitott).
2. **A lábazat magyarul beégetett** — a piac-nyitásnál (ADR-0111) a kötelezők egyetlen
   hordozója magyarul jelenne meg.

## Mellékesen kiderült

- A 404-es előnézet-lap (és az ismeretlen-tokenes ág) a LEADNEK mutatta az operátor-konzol
  menüjét (Irányítópult / CRM / Pénzügy / Kilépés) — screenshoton látszott, `chrome:false`.
- A konzol SMS-előnézete elnyelte a sortörést (`white-space:pre-wrap` hiányzott), így az
  operátor nem azt látta, amit a címzett kap.
- A tulaj által nézett prospect mockja a fő fa GYÖKERÉBEN van (relatív `artifactPath` a
  cwd-hez képest), ezért worktree-ből 404 — nem éles hiba, de törékeny.

## Módosított / létrehozott fájlok

- `src/outreach/draft.ts`, `src/outreach/outreachCheck.ts`, `src/outreach/sendOutreachPair.ts`
- `src/console/prospectNotice.ts` (ÚJ), `src/console/server.ts`, `src/console/views.ts`
- `scripts/optout-carrier-check.mts` (ÚJ), `scripts/sms-gate-selftest.mts` (ÚJ)
- `src/outreach/pairRepair.ts` (ÚJ), `scripts/pair-repair.mts` (ÚJ),
  `scripts/pair-repair-check.mts` (ÚJ), `migrations/0058_pair_sms_retry.sql` (ÚJ),
  `deploy/systemd/citoviso-pair-repair.{service,timer}` (ÚJ), `src/db/schema.ts`,
  `src/outreach/sendOutreachSms.ts`
- `scripts/design-token-lint.mts`, `hooks/pre-commit`, `src/i18n/catalog.json`
- `_planning/DECISIONS.md` (ADR-0112), `_planning/DOMAIN/03-INVARIANTS.md` (§C)

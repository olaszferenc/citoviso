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

## ⚠️ Nyitott, tulaj-döntést igényel

1. **A kiút most KÖVETETT és KÉT KATTINTÁS.** Aki le akar iratkozni, előbb meg kell nyitnia a
   követett oldalt (`recordView` + eszkalációs számláló). Ütközik a §C.1 „egy-kattintásos"
   betűjével. Feloldás: tracking-mentes leiratkozó-út / a számláló ne vegye be / a link
   mégis vissza az SMS-be rövidebb alakban.
2. **Törött pár** (MMS kiment, SMS nem): a címzettnél reklám-kép, kiút nélkül. ADR-0083 óta
   így van, de ez a döntés súlyosabbá tette. Retry vagy riasztás kell?
3. **A lábazat magyarul beégetett** — a piac-nyitásnál (ADR-0111) a kötelezők egyetlen
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
- `scripts/design-token-lint.mts`, `hooks/pre-commit`, `src/i18n/catalog.json`
- `_planning/DECISIONS.md` (ADR-0112), `_planning/DOMAIN/03-INVARIANTS.md` (§C)

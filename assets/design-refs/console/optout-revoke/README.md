# JÓVÁHAGYOTT TERV — Leiratkozás visszavonása (B változat)

Tulaj-jóváhagyás: 2026-09-06 („B”). Ez a terv a megvalósítás KONTRAKTUSA —
elvárt viselkedés, nem stílus-javaslat.

## A hiány, ami kikényszerítette

A dev DB-ben EGY leiratkozás zárta le mind a 8 prospectet, és a tulaj nem tudott küldeni.
Nem hiba: a suppression szándékosan SZEMÉLY-szintű (`isEmailSuppressed` bármely azonos című
sorra, `isPhoneSuppressed` normalizált szám-egyezésre) — a teszt-leadek viszont mind a tulaj
saját címét/számát hordozzák, így egyetlen kattintás az egész teszt-parkot lezárta. A feloldás
addig csak `psql`-ből ment, és a „mindenkinél leiratkozott van VALAMIÉRT” kérdés
megválaszolhatatlan volt: a `unsubscribed_at` egy dátum, nem mondja meg, ki és miért.

## Amit a terv KÖT

1. **Hely:** lead-lap → „Megkeresés — követett link” panel, a prospect sorának alján.
   Csak akkor jelenik meg, ha VAN aktív leiratkozás VAGY van naplóelőzmény — érintetlen sor
   ugyanolyan csendes marad, mint ma.
2. **A művelet LECSUKVA indul** (`<details>`, „Leiratkozás visszavonása ▸”). Ez a B változat
   lényege és az egyetlen dolog, amiben eltér az A-tól: a visszavonás jogilag az érintett
   kérésén áll, tehát nem sülhet el egy félrekattintásból. Az A (mindig nyitott űrlap) el lett
   vetve.
3. **Az indoklás KÖTELEZŐ.** Üres vagy 3 karakternél rövidebb (trimmelt) szöveg elutasítva,
   szerver-oldalon is — nem csak a böngésző `required` attribútumával. Elutasításkor az állapot
   NEM változik és naplósor SEM keletkezik.
4. **A napló mindig látszik**, a doboz alján, legújabb elöl: időpont · mi történt · ki · indoklás.
   Ez válaszolja meg a „miért van leiratkozva?” kérdést a lapról, DB nélkül.
5. **Az actor a BEJELENTKEZETT operátor** (`currentOperator`), soha nem űrlapmező — különben az
   audit-nyom önbevallás lenne.
6. **Visszavonás után:** a piros címke eltűnik, a küldés-gomb visszajön, az űrlap eltűnik, a
   doboz „múlt” állapotba vált (semleges keret) és megtartja a naplót.
7. **Őszinte üres állapot:** a napló a 0053 migráció napjától él. Egy korábbi leiratkozáshoz
   NEM gyártunk visszamenőleges sort — a doboz kimondja, hogy „a napló bekapcsolása előtti”
   (§B.17: kitalált actor egy audit-naplóban rosszabb, mint az üres állapot).
8. **A suppression maga ÉRINTETLEN.** A gomb az EGY sort mozgatja, ami az opt-outot hordozza;
   `isEmailSuppressed`/`isPhoneSuppressed` személy-szintű hatóköre nem gyengül. Élesben ez a
   viselkedés helyes, és úgy is marad.

## Ami a mockból NEM ment át (és miért)

A mock a `[hidden]` attribútummal rejtett — amit a `display:flex/inline-flex` felülír, mert az
UA-szabály specificitása nulla. A képen ez NEM látszott (a rejtett küldés-gomb és a lezárt
űrlap láthatóan ott volt), a végigkattintás fogta meg. Az éles kód ezért szerver-oldalon
FEL SEM RENDERELI, amit nem szabad látni, a mock pedig `[hidden]{display:none!important}`-tal
javítva került ide.

## Megvalósítás

- `migrations/0053_prospect_optout_log.sql` — audit-tábla (mindkét irány)
- `src/console/data.ts` — `resubscribeProspect()`, `getProspectOptoutLog()`; a `unsubscribeProspect()` is naplóz
- `src/console/views.ts` — `optoutBox()`
- `src/console/server.ts` — `POST /prospect/:id/resubscribe`
- `public/assets/ui/citui-console.css` — `.optout-box`
- Súgó: `kb/entries/console-lead/entry.hu.md` → „Ha a soron »leiratkozott« áll”

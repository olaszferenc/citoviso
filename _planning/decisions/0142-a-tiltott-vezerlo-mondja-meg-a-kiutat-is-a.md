## ADR-0142 — A tiltott vezérlő mondja meg a kiutat is; a visszafordíthatatlan után ne kínáljunk szerkesztést (2026-09-13)

**Dátum:** 2026-09-13 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0136 (a tiltott gomb
élőnek látszott — ott született meg a `.con button:disabled` szabály), ADR-0082/0122
(csatorna-egylövés), ADR-0139 (ugyanez a lap, Z3/Z4).

**Kiváltó (Elek FK-004 Z6 + Z7).**

- **Z6:** a „**Páros indítása (nincs szám)**" gomb a saját előfeltételének hiányát közölte,
  miközben ugyanolyan súlyú, kitöltött gombnak látszott, mint a működő „Küldés e-mailben".
  Nem derült ki, megnyomható-e, és **hogyan lehet számot pótolni**.
- **Z7:** küldés után az e-mail kártyán a cím-mező és a „**Cím mentése**" gomb változatlanul
  aktív maradt, közvetlenül a „kiküldve" jelvény alatt — mintha a levél célja még módosítható
  volna.

**Mérve, és ez a fele fontos.** A Z6 „aktívnak látszik" része **közben megszűnt**: egy
párhuzamos szál (ADR-0136) bevitte a hiányzó `.con button:disabled { opacity:.5;
pointer-events:none }` szabályt, a gomb pedig már addig is `disabled` volt. **Nem állítom,
hogy ezt én javítottam** — amit a bejelentésből ténylegesen nyitva találtam, az a MÁSIK fele:
a felület kimondta a hiányt, de nem mondta meg a kiutat.

**Döntés.**

1. **A tiltott vezérlő mellé odakerül a KIÚT** — ott, ahol a hiány látszik: „Telefonszám
   nélkül a páros nem indítható. A számot a lead adatlapján, a »Begyűjtött adatok —
   szerkeszthető« panelen tudod megadni" + odavivő link. ⚠️ A szám a LEAD adata, nem a
   követett linké, ezért nincs (és ne is legyen) mező a kártyán: a kiút egy hivatkozás, nem
   egy második beviteli hely ugyanarra az adatra.
2. **Visszafordíthatatlan művelet után nem kínálunk szerkesztést azon, amit már elküldtünk.**
   A kiment levél címe olvashatóan megmarad („A levél erre a címre ment ki: … — a cím
   módosítása ezen már nem változtat"), de űrlapként nem. ⛔ A címet NEM tüntetjük el: az
   operátornak tudnia kell, hova ment.

**Őr (`outreach-row-truth-check`, pre-commit).** Öt új állítás a KIRENDERELT lapon: a
páros-gomb szám nélkül `disabled`; a lap megnevezi a kiutat és linkel rá; küldés után nincs
`contact-email` űrlap; a cím viszont olvashatóan ott van; küldés ELŐTT pedig szerkeszthető
(mert a cím pótlása a rendes út). Az önteszt **5 → 9 pirosra** nőtt.

⚠️ **Amit nem tudtam élőben megnézni:** a Z6 állapot (kapu ÁTENGED + nincs szám) ezen a gépen
nem áll elő, mert az ADR-0130 azonosítás-kapu minden levelet blokkol itt — a szövegét a
valódi renderből olvastam ki, a gomb tiltottságát az őr méri. A Z7 állapotot ÉLES lapon
néztem meg (egy prospect, aminek tényleg kiment a levele).

**Visszafordíthatóság:** 🔄 felirat- és feltétel-szintű.

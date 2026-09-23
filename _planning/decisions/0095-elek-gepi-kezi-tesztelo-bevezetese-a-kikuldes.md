## ADR-0095 — „Elek" gépi kézi-tesztelő bevezetése + a kiküldés-szabály tulajdonosi felülírása

**Dátum:** 2026-09-04 · **Státusz:** ELFOGADVA (tulajdonosi megbízás + két pontosító döntés) ·
**Kapcsolódó:** ADR-0045 (KB-doktrína — a console-test-log entry ennek része), ADR-0081 (§2b kapu —
a napló-felület B kontraktusa ezen ment át), ADR-0084 (a tervezett FK-001 célfelülete).

### Döntés

① **A MineREAL-ben bevált Elek-rend átvétele** (tulaj-megbízás): kétrétegű gépi kézi-tesztelő —
determinisztikus runner (`elek/bin/runner.mts`: FK-forgatókönyv → in-process szerver efemer
porton, mintelt HMAC-session, lépésenkénti shot + console/HTTP/dialog-rögzítés) + friss-kontextusú
AI-kiértékelő (charter/RUN-PROMPT/MEGBÍZÁS-SABLON szerint; lelet = tény+repro+shot, javaslat soha).
Kőbe vésett: kontextus-diéta (se forráskód, se fejlesztői memória), két-út doktrína (az emberi
tesztelő nem tud Elekről; az `elek` sor a napló közös listájából rejtve, csak `?user=elek` linkkel
látható), nulla néma zöld (kézi-lépés képről ítélve), ELEK-TESZT rekord-előtag.

② **Napló-felület:** operátor-gated `/test-log` a konzolon (jóváhagyott B kontraktus:
`assets/design-refs/console/elek-test-log/`); tárolás FÁJL-alapú (`data/test-log/`, per-user JSON +
append-only history) — a közös dev DB-t párhuzamos sessionök ürítik, a napló pont ezt éli túl.

③ **Scope: ALL IN** (tulaj): a teljes hurok a scrape-elt leadtől a mock-generáláson és kiküldésén
át a tenant-vásárlásig/bővítésig/lemondásig. Cél a LEHETŐ LEGTÖBB eset: bukott fizetés,
időtúllépés/lejárat, dunning-fokozatok, freeze — a mátrix az `elek/scenarios/SCOPE.md`-ben.

④ **Kiküldés-szabály FELÜLÍRVA** (tulaj, szó szerint: *„nyomjon kiküld gombot! de minden esetben a
saját emailcímére érkezzen a megkeresés és onnan folytassa"*): az eredeti „levelet nem küld"
tiltás helyett — Elek kiküldés-akciót CSAK olyan rekordon indíthat, amelynek címzettje
**elek@citoviso.com** (ELEK-TESZT lead/tenant az ő címével); a beérkező levélből lead-ként
folytatja (link-kattintás → funnel → mock-gateway-es vásárlás). Bármely más címzett = teljes stop,
ELŐFELTÉTEL-HIBA. SMS/MMS-küldés marad TILOS (a modem valódi SIM-ről valódi számra küld, Eleknek
nincs saját száma; az `OUTREACH_SMS_ALLOWLIST` fék ettől függetlenül él).

### Következmények / előfeltételek

- **elek@citoviso.com postafiók (tulaj Zoho-lépés) az outreach-kör KEMÉNY előfeltétele** + IMAP-
  olvasás Eleknek a saját fiókjára (a diéta része: a SAJÁT postafiókja a világa).
- Időfüggő esetek (dunning T−3…T+30, freeze): az állapot-beállítás fejlesztő-session SETUP
  (seed/időutazó helper, tulaj-jóváhagyással), Elek a FELÜLETET ítéli — a diéta nem sérül.
- Első leletek (2 kör): ORSZÁG-oszlop kevert formátum (HIBA), angol `none` magyar felületen,
  kézikönyv↔UI drift (diszkvalifikáltak-link), néma favicon-404 — triázs a tulajnál.

**Visszafordíthatóság:** 🔄 — a rend leállítható (runner+napló additív); a ④ felülírás paraméter-
szerű (a charter tiltás-szakasza), visszaállítható az eredeti tiltásra.

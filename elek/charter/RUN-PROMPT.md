# RUN-PROMPT — az Elek-kiértékelő agent állandó feladatlistája

> Státusz: **F0 TERVEZET — tulajdonosi jóváhagyásra vár.**
> Ez a 2. réteg: az AI-kiértékelő, friss kontextussal, subagentként fut a runner (1. réteg)
> minden futása UTÁN. A szó szerinti indító prompt sablonja: `BRIEF-TEMPLATE.md`.

## Bemenete (a kontextus-diéta szerint — SEMMI más)

- `elek/charter/CHARTER.md` (a munkakör),
- a futtatott FK (`elek/scenarios/FK-….md`),
- a futás-mappa: `result.jsonl` + `shots/`,
- a futás-történet: `elek/memory/runs.jsonl` (+ korábbi futás-mappák LELETEK.md-i),
- a felhasználói kézikönyv, HA az FK hivatkozza.

## Feladatlista (sorrendben)

1. **Minden `manual` és `fail` lépés képét NÉZD MEG** (Read, nem csak listázd) és ítélj.
2. **`fail` lépésnél válaszd szét:** valódi **HIBA**, vagy **FORGATÓKÖNYV-HIBA** — ha a képen
   az elvárt dolog LÁTSZIK, csak a szelektor nem fogta, az a forgatókönyv hibája, nem a
   rendszeré. A kettő soha nem mosódhat össze.
3. **Console-hiba = lelet akkor is, ha a lépés `pass`** — a zöld lépés alatti JS-hiba a
   klasszikus néma bukás.
4. **Vetsd össze a futás-történettel:** ami korábbi futásban zöld volt és most piros, az
   **REGRESSZIÓ** címkét kap — ez a legfontosabb lelet-típus, a lelet elejére kerül.
5. **`manual` lépésnél** dönts a képről: **KÉZI OK** (az emberi elvárás láthatóan teljesül)
   vagy **KÉZI KELL** (nem ítélhető meg / gyanús — emberi szem kell rá), indoklással.
6. **Leltár:** gyűjtsd ki az FK `adat:` mezőiből és a futásból a létrehozott `ELEK-TESZT`
   rekordokat — ezek a napló-összegzésbe kerülnek.

## Lelet-címkék

**HIBA** · **REGRESSZIÓ** · **KÉZI OK** · **KÉZI KELL** · **FORGATÓKÖNYV-HIBA** ·
**ELŐFELTÉTEL-HIBA** · **GYANÚ** (valami nem stimmel, de nem bizonyított — tényekkel).

**Lelet = tény + repro-lépések + shot-hivatkozás. SOHA nem javítási javaslat** — Elek nem
ismeri a kódot, és nem is találgat róla.

## Kimenete

1. **`LELETEK.md`** a futás-mappába: fejléc (FK, időpont, lépés-statisztika), majd leletek
   címke szerint, REGRESSZIÓ elöl.
2. **1 sor** az `elek/memory/runs.jsonl`-be:
   `{"fk":"FK-001","ts":"…","steps":{"pass":N,"fail":N,"manual":N,"blocked":N},"leletek":{"HIBA":N,"REGRESSZIO":N,…}}`
3. **A webes teszt-napló kitöltése API-n át** (`elek` app-userként, hamisított sessionnel):
   - pipa CSAK arra a lépésre, aminek az EMBERI elvárása teljesült (`pass` vagy KÉZI OK),
   - a leletek tömören a szakasz-kommentekbe,
   - a bent maradt `ELEK-TESZT` rekordok listája a végső összegzésbe.

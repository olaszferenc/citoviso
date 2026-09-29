## ADR-XXXX — A `cfg-sheet-scroll-check` is a közös poolon mér, a húzás után NYUGVÓPONTRA vár (nem fix alvás), és a nem nyugvó mérés PIROS (S11) (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** „Ok a és b” — a lassú kapuk párhuzamosítása (koordinátor `cit3bd83952`).
  Brief: `~/rc-briefs/cfg-sheet-scroll-gyorsitas.md`. A kapu a `cit48c5979c` landjában 803 s után is
  futott, a land tiszta-main próbája 300 s-nál időtúllépett rajta.
- **Előzmény:** ADR-0261, ADR-0263 (`scripts/lib/gate-pool.mts`), ADR-0264; ADR-0168 (mozgó elemet
  nyugvópontban mérünk). A `gate-pool.mts`-hez nem kellett nyúlni.

**Időbontás (előtte, soros, load ~15 / 8 mag):** egy egység 38–49 s, ebből a 31–32 húzás 33–37 s
(~1,2 s/húzás: 450 ms fix utó-alvás + 12 × 16 ms mozgás CDP-körökkel + CDP-session nyitás/zárás
húzásonként); a többi fix várakozás ~3,9 s/egység. 25 egység (18 fő + 7 piros önteszt) SOROSAN →
~20 perc terhelés alatt.

**Döntés**

1. **Mind a 25 egység egy poolon** (`CIT_GATE_JOBS`, alap 4): a (sablon × tartás) fő mérések ÉS a hét
   önteszt-mérés — mind saját böngésző-kontextus, közös írt állapot nincs (a fixture memóriában, a
   képek neve egyedi). A kiírás a pool UTÁN, a soros sorrendben; a `run()` maga nem ír ki semmit.
2. **Eredmény nélküli egység = hangos bukás** („a mérés lefutott” ✗, a hibaüzenettel); az
   önteszt-ellenőrzések egy eredmény nélküli egységen üres rekordot kapnak → mind pirosak.
3. **A húzás utáni 450 ms fix alvás helyett nyugvópont:** a lap és MINDEN görgető offsete ≥ 8 egymást
   követő animációs képkockán ÉS ≥ 160 ms-ig változatlan, legalább 250 ms a `touchEnd` után. Egy
   kiéheztetett renderelő nem fest képkockát, így nem tud hamis nyugvást mutatni. A gesztus maga
   (12 × 16 ms touchMove) VÁLTOZATLAN — a sebesség a lendületet is meghatározza.
4. **S11 (új, a mérés hitele):** ha 4 s alatt nem áll be a nyugvópont, az egység S11-e **PIROS**, nem
   figyelmeztetés — a következő leolvasás mozgó lapra esne, ami egy piros önteszt-ágban épp az ADR-0168
   hamis zöldje. Az önteszt-egységeken is kötelező (ott csak bukáskor ír sort). Negatív kontroll:
   100 ms-os plafonnal mind a 6 mért egység S11-e piros lett.
5. **Egy CDP-session oldalanként**, újrahasznosítva (eddig húzásonként nyitott és zárt).
6. A többi fix várakozás (panel-nyitás 700 ms, S3 1200 ms, lépésváltások) marad: egységenként ~4 s,
   és a nyugvópontra cserélésük új kockázat lenne kis nyereségért.

Semmi nem gyengült: sablonok (3), tartások (6), szabályok (S0–S10), önteszt-ágak (7 egység, 11 ellenőrzés)
változatlanok; S11 új.

**Mérés** (a gépen közben idegen land-ok):

| futás | fal-idő | megjegyzés |
|---|---|---|
| előtte, soros (becslés a részidőkből) | ~1000–1200 s | load ~15; 25 × 38–49 s |
| utána, 4 munkás, egyedül | **306 s**, **294 s** | load ~17 (idegen) |
| utána, 4 munkás, 4 CPU-égető + párhuzamos soros futás | **411 s** | load ~27; minden zöld, az önteszt piros ágai pirosak, S11 sehol |
| utána, `CIT_GATE_JOBS=1` (soros) | 992 s | load ~27–35 (az égetős futással együtt); a teljes kimenet betűre azonos a két párhuzamos futáséval |

A leghosszabb néma szakasz = a pool teljes ideje (a pool puffereli a kimenetet): 290–390 s, a 900 s-os
`CIT_GATE_JOB_SILENCE` (ADR-0269) alatt.

# Őszinte futás-jelzés és kimondott vég — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-14, tulajdonosi választás: **A változat — „nincs csík: eltelt idő
+ szakasz + lezáró sor"**. ·
**Hatókör:** `src/console/views.ts`, `src/console/server.ts`,
`src/generator/generateEngine.ts`, `public/assets/ui/citui-console.css` ·
**Kapcsolódó:** Elek FK-003b L03 + L06, ADR-0118 (életjel), ADR-0138 (háttérmunka-életjel),
03-INVARIANTS §B.17. **Őr:** `scripts/quote-author-check.mts` ③.

`gen-progress-end-A.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.**

## Miért létezik

Mérve (2026-09-13, Elek FK-003b): a futó generálás haladó csíkja **mindkét felvételen
teljesen üres, egyenletes szürke** volt (x=533–1234), és a 0:00→0:01 közti **teljes
pixeldiff kizárólag az eltelt-idő szövegére** korlátozódott.

Az ok: a csík `width:34%` fix kitöltést animált (`conSlide`), **semmilyen adathoz nem
kötve** — nem volt mit mutatnia, mert progress-jel nem is létezett a rendszerben.
Letiltott animációnál (screenshot, `prefers-reduced-motion`) a kitöltés `margin-left:-34%`
-on állt, azaz a sávon KÍVÜL — innen az „üres szürke". Egy `prefers-reduced-motion`
szabály ráadásul `width:100%`-ra állította: futás közben **teli** csík, ami kész munkát
sugallt.

**L06:** a generálás VÉGÉT semmi nem mondta ki — a sáv egyszerűen eltűnt: nincs „kész",
nincs időtartam, nincs link az eredményhez.

## Amit a terv KÖT

1. **Nincs adat nélküli haladó csík.** A `.con-runbar__track/__fill` és a `conSlide`
   animáció **kivezetve**; vissza nem kerülhet. Haladást csak VALÓS jelből mutatunk.
2. **A futó sáv a MOST futó szakaszt nevezi meg**, és ezt a **motor jelenti**
   (`generateEngineMock` → `onStage`), nem a felület találja ki. A négy szakasz:
   **adatok betöltése · fotók gyűjtése és szűrése · szöveg generálása · oldal
   renderelése**. A kulcs utazik, a feliratot a felület adja (§B.18).
3. **⛔ Százalék nincs.** A szakaszok hossza erősen egyenetlen (az AI-hívás a futásidő
   zöme), ezért az arányos csík a HÁTRALÉVŐ IDŐRŐL hazudna. Az eltelt idő önmagában
   őszintébb — ez volt a tulajdonosi döntés lényege.
4. **Több sablonnál az elkészültek SZÁMA áll ott** („1/3 mock kész"), nem szakasz-név:
   a sablonok párhuzamosan futnak, ott nincs egyetlen „hol tart".
5. **A VÉG ki van mondva, és MEGMARAD.** A lezáró sor kimondja, hogy **kész**, hogy
   **mennyi ideig tartott**, és **elvisz az eredményhez** (`/mock/<artifactId>`, ha
   pontosan egy mock készült). A sor az outcome TTL-jéig él — nem tűnik el némán, tehát
   a kurátor akkor is megtudja, hogy kész, ha közben máshol járt. Elteheti (×), de az
   csak a sávot rejti el, a tényt nem.
6. **A bukás megmondja az OKOT és azt is, mennyi idő után** állt le.
7. **A háttérmunka NÉGY dolgot tartozik:** hogy ELINDULT, hogy FUT, hogy MIÉRT bukott —
   és hogy KÉSZ. A negyedik ezzel a tervvel került a helyére.

## Csapda, amit a megvalósítás közben mértünk

A lezáró sor bezáró **×** gombja fehér, keretes pirulaként jelent meg: a `.con button`
(0,1,1) **veri** a `.con-done__x` (0,1,0) osztályt. A szabály ezért `.con .con-done__x`
alakban él. Ugyanaz a specificitás-csapda, amit a link-szabály már egyszer elsütött.

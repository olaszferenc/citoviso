## ADR-0329 — A kurátori és a kézi szövegen Vera ítél, nem az AI-őrök (2026-10-05)

**Dátum:** 2026-10-05 · **Státusz:** elfogadva (SUB, koordinátor: CIT fő session; briefek:
`~/rc-briefs/ai-orok-kivaltasa-vera-20261005.md` + két átadó) · **Tulajdonosi döntés (2026-10-05, a koordinátoron át):**
B változat, (a)–(e) lent · **Módosítja:** ADR-0323 D2 („a tényhűség a kurátoré, de az őrök újra ítélnek”) ·
**Kapcsolódó:** ADR-0326 (kurátori szöveg, Poe), §B.17 (tényhűség), a küldés-kapu (`mockVerdictGate.ts`).
**Kontraktus:** `assets/design-refs/console/vera-review/` (terv.html + README + 6 kép).

**A lelet (élesen, olvasva).** 17:00 óta 62 mock készült, mind kurátori (Poe-) szöveggel. Mindegyiken a három AI-őr
(piac `verifyMarketRelevance`, vendég-kritikus `judgeGuestCopy`, tényhűség `verifyFactuality`) egyszer, generáláskor
futott; az `aiUsage.byStep` CSAK ezt a három lépést tartalmazza, kb. **$0.12/mock**. Ugyanezt a szöveget Vera
(tényellenőr digitális munkatárs) a saját jelentésében mockonként amúgy is átnézi (pilot-összevetés, `docs(vera)`).
Mellék-lelet: a kézi mentés őr-futása nem írt `aiUsage`-t, és a napi keret sem látta.

**Döntés.**
1. **Kurátori úton nem fut AI-őr.** A `generateEngine` kurátori ágán a piac-, a tény-őr és a kritikus kimarad;
   a mock `inputs.reviewVerdict = "pending"`-et kap. A nem-kurátori (AI-író) út VÁLTOZATLAN; a dizájn-kapu marad.
2. **(b) A kézi átírás is a Vera-útra kerül** (az AI-szövegű mocké is): a `saveManualCopy` nem futtat őrt, törli a
   régi őr-verdikteket, az ítéletet és a nyugtázást (`verdictAck`), és `reviewVerdict = "pending"`.
   Az ADR-0323 D2 „az őrök újra ítélnek” pontja ezzel ÉRVÉNYÉT VESZTI; a D2 „régi szó nem állhat új átment alatt”
   elve marad, most Vera-ítéletre.
3. **Az AI-újraírás (recopy)** az AI-őröket futtatja, mint eddig, és törli a Vera-ítéletet (az AI szövegére nem az
   övé).
4. **(a) A rögzítő a kártyán, ALAPBÓL nyitva**, amíg nincs ítélet: PASS/FLAG, jelentés-hivatkozás (kötelező,
   ≤ 200), FLAG-nél megjegyzés (≥ 10). `POST /artifact/:id/review` — sima űrlap, amit Vera emberként kattint
   (nincs hátsó API). Befagyott (kiajánlott) mockon is rögzíthető: ítélet, nem szöveg.
5. **(e) „ki”** = a bejelentkezett operátor (`displayName || username`), ahogy a kézi szövegmentés.
6. **Biztonsági öv:** az ítélet a szöveg hash-ét is eltárolja (`copyHash`, a `currentCopy()` összes mezőjéből);
   ha a mostani szöveg hash-e eltér, az ítélet „pending”-nek számít — akkor is, ha egy jövőbeli út elfelejti törölni.
7. **(c) Hiányzó ítélet NEM nyugtázható:** a kapu blokkol, a felugró nem kínál „Kiküldöm mégis”-t, csak „Bezárás”-t
   (e-mail, SMS, kötegelt küldés egyaránt). A FLAG a meglévő `verdictAck`-kel vállalható, ahogy egy őr-FLAG.
8. **A „hiányzik” nem lehet zöld:** a `pending` ÉS az addig zölden látszó `error` jelvény a flag-színt kapja.
9. **(d) A piac-őr elvesztését vállaljuk** a kurátori úton (Vera tényt ellenőriz, nem eladási pontot).

**Hatás.** A kurátori úton az AI-őr költség **$0.12 → $0.00/mock**. Ítélet nélkül a kurátori mock nem küldhető ki.

**Őr.** `scripts/verdict-gate-check.mts` (pending blokkol és nem ackolható; pass átenged; flag ackolható; kézi
mentés → pending; hash-eltérés → pending; a recopy törli) · `scripts/copy-curator-check.mts` ③ (+ `--self-test`
mutánsok: piac-/tény-őr kurátorra is, nincs pending) · contract-drift-check (a README kötő feliratai).

**Visszafordíthatóság:** 🔄 — az őr-hívások a nem-kurátori úton élnek; a kurátori ágon a `if (!curated)` feltétel
visszavonása visszahozza őket.

**Elvetett alternatívák.** A változat (a rögzítő a jelvényre kattintva nyílik) — egy kattintással több Verának, a
tulaj a B-t választotta. Az őrök megtartása Vera mellett — kettős költség ugyanarra az ellenőrzésre.

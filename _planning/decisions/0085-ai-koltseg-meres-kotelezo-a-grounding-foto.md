## ADR-0085 — AI-költség mérés kötelező; a grounding-fotó felbontása NEM költség-lever; tényhűség-kapu a motor-útra
**Dátum:** 2026-08-30 · **Státusz:** ELFOGADVA, LANDOLVA · **Visszafordíthatóság:** 🔄 (kód-szintű, DB-migráció nincs)

**Kontextus.** A tulaj kérdése — „mibe kerül egy mock?" — csak becsléssel volt válaszolható:
minden Anthropic-hívás visszaadta a `usage` mezőt, de senki nem olvasta. A becslés ráadásul
rossz volt (motor-út: ~11–17k token tippelve, 36 851 mérve), és a költség szerkezete is más:
~99% a BEMENET, azon belül a vision-fotók — nem a kimenet.

**① Minden AI-hívás MÉRVE (gépi őr kényszeríti).** `src/ai/usage.ts` (AsyncLocalStorage-
gyűjtő + ártábla); a totál a `mock_artifact.inputs.aiUsage`-be kerül és a konzol artefaktum-
sora mutatja. Pénznem KIZÁRÓLAG USD (tulaj-rendelet): az Anthropic abban számláz, egy
kitalált Ft-árfolyam a mért számot becsléssé rontaná vissza. Ismeretlen modell NEM kap
csendben árat — „árazatlan"-ként hangos. Őr: `scripts/ai-usage-lint.mts` (pre-commit, a
hívás-listát a FORRÁSBÓL származtatja, nem fájllistából) + `ai-usage-selfcheck.mts`
(filléres valódi hívás a teljes láncra). Riport: `scripts/ai-cost.mts`.

**② A grounding-fotó felbontása NEM költség-lever — MÉRVE ELUTASÍTVA.** A kicsinyítés árban
működött ($0.197→$0.085), a tényhűségen bukott: a „légkondicionált" állítás (forrásadatban
kiírva, a gép a fotón látszik) teljes felbontáson 3/3 helyes, 1568px-en 1/3, 1024px-en 0/3 —
és 1024px-en egyszer „ventilátoros szobák" LETT BELŐLE (fabrikáció). §B.17 nem alkudható →
a pixelek maradnak. A sharp-kicsinyítés EGY esetben jogos: a 3 MB feletti kép eddig nyers
URL-re esett (Cloudflare-blokk = elveszett grounding) — ott a zsugorítás jobb az eldobásnál.

**③ A valódi költség-lever: EGY vision-hívás kettő helyett.** A brief és az editorial
ugyanazt a 4 fotót küldte be külön-külön → `generateBriefAndCopy` egy hívásban, MINDKÉT
prompt szó szerint újrahasznosítva (nincs hang-drift), azonos pixelek egyszer. Bónusz: az
editorial megkapja a valós stat-okat („88 vélemény mesél rólunk" — valós számból).

**④ Tényhűség-kapu a motor-útra (eddig CSAK a korpusz-út futtatta!).** A motor-út
ellenőrizetlenül szállított, és mérten fabrikált is. Most ugyanaz a `verifyFactuality` fut;
a FactSource opcionális rating/rooms/amenities mezőkkel bővült, különben a mock SAJÁT VALÓS
számait (4,6★/88, „4 fő") flagelte volna. Mellékjavítás: a verifier fotói inline mennek
(a nyers URL-t a Cloudflare blokkolta → néma `error`). Piros/zöld tesztelve.

**⑤ A `factVerdict="error"` is BLOKKOLJA a küldést (mail+SMS).** Az ellenőrizetlen mock
nem küldhető auto-outreachbe — az ismeretlen ugyanúgy blokkol, mint a bukott; a HIÁNYZÓ
kulcs továbbra is átmegy (determinisztikus utak). Valódi kapu-függvényen tesztelve, mind
a 4 állapotra.

**Ár-mérleg (ugyanaz a lead):** eddig 2 hívás kapu nélkül $0.197 → most merged+kapu $0.242
(+23%-ért egy őrizetlen út került kapu mögé; kapu merge nélkül ~$0.32 lett volna).

**Nyitott:** a mail- és SMS-kapu verdikt-szűrője két másolatban él — közös függvénybe
ikresítés külön szelet (ADR-0082 tanulság).

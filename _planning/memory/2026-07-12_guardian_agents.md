# 2026-07-12 — Őr-agent réteg (guardian guardians) + ontológia-megszilárdítás

## Kiváltó ötlet (user)
"Nem érdemes egy fix identitású, ontológiához hozzáférő agent-csapatot alkotni?" — de NEM
mesterség-szerinti szerepekre (frontend/backend/DBA) gondolt, hanem: az elején megfogni pár
esemény-triggerelt fő feladatkört, ami segítségül hívódik.

## Kulcs-átkeretés (a döntés)
Ne EMBERI munkamegosztás (mesterségek) szerint vágj — az AI-nél a kontextus a szűk keresztmetszet,
nem a specializáció. Vágj a projekt INVARIÁNSAI szerint: azok a doktrínák, amiket már leírtunk, de ma
csak az én figyelmem tart be. Ezek ellenőrök (VERIFIER), nem építők — a fő szál épít, az őr kaput tart.
Ez pontosan a [[feedback_working_mode_focus_reversibility]] rését zárja (a stratégiai csúszás nem
tud átmenni, mert a gép fogja). És belső-konzisztens a §G.20-szal: a fősodor automata, az ember/őr a kivételnél.

## A bevált MINTA (minden őrre)
1. **Kontraktus:** a vonatkozó DOMAIN-invariánst enforce-olható formára élesíteni (bemenet/tiltott/bizonyíték/eljárás),
   VALÓS kód-mezőkre horgonyozva — nem absztrakt szabály.
2. **Subagent** (`.claude/agents/<nev>.md`): szűk system-prompt, adverzariális verifier, a DOMAIN-ra mutat,
   fix kimeneti struktúrát ad (a hívó dolgozza fel, nem a user).
3. **Runtime-kapu** — CSAK ahol van valós kód-felület. Ha a pipeline nincs megépítve → DEFERRED-jelölés
   explicit aktiváló feltétellel (NE építs phantom-pipeline-ra kaput — ez a munkamód-csapda).
4. **Dev-hook** (`.claude/settings.json` PostToolUse) — olcsó determinisztikus háló, ami engem is őriz.
5. FLAG → kurátor-sor (`mock_artifact.inputs`-ba a verdikt), soha nem auto-outreach.

## A 3 megépített kapu
### 1. Tényhűség-őr (§B.17) — 2 réteg, commit 4d26165
- §B.17 kontraktussá élesítve: HARD vs SOFT tény; igazságforrás = strukturált mező (`QualifiedLead`…) VAGY
  image-grounded; tiltott a becsempészett kitalált tény. **Felismerés:** ma a HARD tény strukturáltan be sem
  jön (nincs ár/m²/szoba mező) → az EGYETLEN szivárgás az LLM becsempészése a `GeneratedBrief` szabad szövegébe.
- `src/generator/factCheck.ts`: determinisztikus unicode-regex előszűrő (`\p{L}`-határok, mert ASCII `\b`
  eltörik ő/²/€-n) + LLM-verifier. Az LLM AI-mockra MINDIG fut (nem csak jelöltnél — a kiírt/szám-nélküli
  fabrikáció különben átcsúszna). `json_schema` structured output (brief.ts-minta).
- `generate.ts` AI-ág: verdikt (`factVerdict/factUnsourced/factCandidates`) az artifactba; PASS/FLAG/error log.
- Dev-hook: `scripts/factcheck-scan.mjs` (függőségmentes Node, gyors) — minden `mock-*.html` íráskor.

### 2. Jog/provenance-őr (§A/§C) — commit 35b6165
- **Felismerés:** a magja jórészt MEG NEM ÉPÜLT fázisokról szól. Kép-rights provenance (owner/guest/portal)
  a kidobott Property-modellel kiesett; outreach-küldő kód nincs (`smtpUrl`/`outreachFrom` üres). → runtime-kaput
  csak a demo-framingre lehet (a mock előzetes tervnek deklarálja magát, nem a tulaj élő oldala).
- §A provenance×fázis mátrix (MOCK/DEMO minden forrás OK + kötelező demo-framing; LIVE/TENANT csak owner),
  §C 4 outreach-elem — NOW/DEFERRED címkékkel.
- `src/generator/provenanceCheck.ts`: `checkDemoFraming` (determinisztikus, „Előzetes terv"/„Citoviso" marker +
  félrevezető „hivatalos oldal" állítás tiltása). Subagent fázis-tudatos (mock/outreach/live).

### 3. Dizájn-doktrína-őr (§B + 06-UI-CONTRACT) — commit 35b6165
- A leggépiesebb. `src/generator/designCheck.ts`: emoji-tilalom (`\p{Extended_Pictographic}`), mind a 11
  `--cit-*` token a `:root`-ban, `data-cit-module="booking"` gerinc-horog. Subagent az ítélet-igényű részt
  (egyedi mag valódisága, in-skin illeszkedés, paletta-eredet, no-JS üres-sáv) nézi.

## Ontológia-átvezetés (ugyanaznap, commit cef6736)
Az `_inbox/20260712` distill-review PROMOTE×8/REFINE×2/DRIFT átvezetve: 00-GLOSSARY Architektúra-fogalmak;
02-ENTITY-MAP iparág-agnosztikus 6-entitásos közös mag (a `Property` „szállás-pilot történeti nézet"-té
minősítve, NEM kanonikus — DRIFT-döntés); 03-INVARIANTS új §G (izoláció/jog/ember), §H (SEO/lokalizáció);
halott `src/generate/` kód-pointer → `src/scraper/`+`src/generator/`.

## Nyitott / következő
- ⚠️ NINCS élő end-to-end generálás-teszt a 3 kapura (valós API+DB+fotó) — a füst-tesztek + az agent-validáció
  fedik a logikát, de éles mock-generálás a hátralévő megerősítés.
- Új subagent-típusok (`tenyhuseg-or`, `jog-provenance-or`, `dizajn-doktrina-or`) natív `subagent_type` hívhatósága
  valószínűleg session-újraindítás után.
- A template-fallback ág nincs kapuzva (csak az AI-ág) — külön policy-kérdés.
- Lehetséges ADR-0013: az őr-architektúra döntésnaplózása (ma csak a DOMAIN-kontraktusok rögzítik a mit, a miértet nem).
- DEFERRED kapuk aktiválása, amikor a konverziós/outreach-pipeline megépül (§A/§C DEFERRED-blokkok).

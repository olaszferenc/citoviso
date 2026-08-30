# 2026-08-29/30 — AI-költség mérés + a felbontás-kísérlet bukása + tényhűség-kapu a motor-útra (ADR-0085)

## Mi történt

A tulaj kérdéséből („mibe kerül egy mock? tokent fogyaszt?") három réteg lett:

1. **Mérés.** Kiderült, hogy mind a 12 Anthropic-hívás eldobta a `usage` mezőt — a költség
   csak `max_tokens`-plafonokból volt tippelhető, és a tippem 2–3× alábecsült (motor-út:
   ~11–17k tippelve, **36 851 token / $0.197 mérve**). A számla ~99%-a a BEMENET (vision-
   fotók), nem a kimenet. Megépült: `src/ai/usage.ts` (AsyncLocalStorage-gyűjtő),
   `inputs.aiUsage` az artifacton, konzol-kissor (tulaj-rendelet: **CSAK USD**, Ft tilos —
   a kitalált árfolyam a mért számot becsléssé rontaná), `scripts/ai-cost.mts` riport,
   `ai-usage-lint.mts` pre-commit őr (forrásból származtatott hívás-lista) +
   `ai-usage-selfcheck.mts` (valódi filléres hívás a teljes láncra).

2. **A költségcsökkentési javaslatom MÉRVE megbukott.** Fotó-kicsinyítés: árban jó
   ($0.197→$0.085), tényhűségben katasztrófa — a „légkondicionált" (forrásadatban kiírva,
   fotón látszik) teljes felbontáson **3/3 helyes**, 1024px-en **0/3**, és egyszer
   „**ventilátoros szobák**" fabrikálódott. A pixelek maradnak; a sharp csak a >3 MB képet
   menti (az eddig nyers URL-re esett → Cloudflare-blokk → elveszett grounding).
   A tulaj fele-igazsága rögzítve: a SZÁLLÍTOTT fotókat a felbontás tényleg nem érinti
   (az oldal az eredeti URL-ekből renderel) — de a modell TÉNYT olvas a képről, és abból
   állítás lesz.

3. **A valódi lever + a valódi kockázat.** `generateBriefAndCopy`: a két hívás ugyanazt a
   4 fotót küldte — egy hívás, mindkét prompt szó szerint, azonos pixelek egyszer. ÉS:
   a motor-út **eddig tényhűség-kapu NÉLKÜL szállított** (csak a korpusz-út futtatta) —
   bekötve, a FactSource rating/rooms/amenities mezőkkel bővítve (különben a mock saját
   valós számait flagelte volna), a verifier fotói inline (a nyers URL-t a Cloudflare
   blokkolta → néma error). Végül: a `factVerdict="error"` is blokkolja a küldést
   (mail+SMS) — az ellenőrizetlen nem megy ki; a hiányzó kulcs továbbra is átmegy.

**Ár-mérleg:** $0.197 (kapu nélkül) → $0.242 (merged+kapu); kapu merge nélkül ~$0.32.

## Tanulságok (meta)

- **A `max_tokens`-ből számolt becslés strukturálisan félrevisz** — nem a nagysága rossz,
  hanem az iránya: a drága rész (vision-input) nem is szerepel benne.
- **A saját javaslatomat a saját mérésem cáfolta** — a „gondolom nem érinti a minőséget"
  hipotézist 3+3+3 futással kellett megmérni, és irányított jel jött ki, nem zaj.
- **A felület-kapu első blokkja után a pótlás féloldalas lett**: a `renderAiCost` definiálva
  volt, de sosem hívva — a tsc zöld, minden kapu zöld, CSAK a screenshot-ránézés bukta ki.
- **A verifier két rejtett hibát hordozott** (rating-vak prompt; URL-blokkos fotók) — mindkét
  hibát az ütköztetés találta meg (mi flagelne tévesen? mi hal el némán?), nem a happy path.
- **npm install a worktree-ben** letörölte a közös `node_modules` symlinket → helyreállítva;
  csomagot a FŐ FA node_modules-ába `--no-save`-vel, a worktree package.json-jába
  `--package-lock-only`-val.

## Módosított fájlok (3 landolt commit: 99fee7e, cca424e→a798759 tartomány, 1b05519, 60e5a88)

- `src/ai/usage.ts` (új) · `scripts/ai-cost.mts` · `scripts/ai-usage-lint.mts` ·
  `scripts/ai-usage-selfcheck.mts` (új)
- 12 hívás-hely mérve + `generate.ts`/`generateEngine.ts` wrapper + `console/views.ts` kissor
- `src/generator/images.ts` (sharp méret-mentés + a mérés dokumentálva) · `package.json`
- `src/generator/brief.ts` (`generateBriefAndCopy`) · `src/engine/copywriter.ts` (exportok)
- `src/generator/factCheck.ts` (FactSource-bővítés + inline fotók) ·
  `src/generator/generateEngine.ts` (kapu bekötve)
- `src/outreach/sendBatch.ts` · `src/outreach/sendOutreachSms.ts` (error-blokk)
- `hooks/pre-commit` (ai-usage-lint)

## Nyitott

- A mail/SMS verdikt-szűrő két másolatban — közös függvénybe ikresítés (ADR-0082 tanulság).
- A korpusz-út (drága ág, ~40–50k becsült token) még méretlen — az első generálás magától
  megadja a valós számát.
- A méréssorozat ára: ~12 valódi generálás ≈ $2.

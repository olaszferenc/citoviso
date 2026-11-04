## ADR-0422 — A Fejezetes (horizontal) sablon végleg kivezetve: új mock nem készülhet vele, a második terv alapértelmezése Fullbleed

**Dátum:** 2026-11-04 · **Státusz:** elfogadva (tulaj-doktrína, a koordinátoron át) · Épít: ADR-0027 (sablon-első generálás), ADR-0028 (a sablonválasztás a kurátoré) · Mintája: az editorial kivezetése (2026-10-04, `retired: true`)

### Kontextus

A tulaj (2026-11-04): „soha többet nem lehet a fejezetest mock típust használni”. A Fejezetes
(`horizontal`, vízszintesen görgethető szoba-sín, sötét irodalmi) addig Neo és Poe egyik
leggyakoribb második terve volt („Parallax + Fejezetes”, ≤6 fotónál a Fejezetes nyert). A meglévő
Fejezetes mockok élesen már `rejected` állapotúak.

Ugyanezen a napon derült ki (ADR-0419 utáni sablonpár-jegy, `src/generator/templatePicks.ts`), hogy a
konzol a kért sablon-id-ket korábban szó nélkül szűrte: egy tiltott sablon tehát „eltűnt” volna a
kérésből, és a futás a maradékkal ment volna tovább. A kivezetés ezért nem lehet csak egy jelző a
választóban: a kérés hangosan bukik.

### Döntés

1. **Új mock Fejezetes sablonnal nem készülhet.** A `templatePicks.OWNER_BANNED_TEMPLATES` tartja a
   tiltást: a `/generate` és a `/generate-curated` (`resolveTemplatePicks`) a kérést elutasítja, és
   kimondja, miért és mit válasszon helyette; a motor (`assertTemplateHonoured`, a render előtt) akkor
   sem renderel Fejezetest új mockként, ha valaki a végpontokat megkerüli.
2. **A meglévő Fejezetes mockok és oldalak továbbra is renderelnek** (mint az editorialnál): a sablon
   kódja marad, csak új mock nem készül vele.
3. **A második terv alapértelmezése Fullbleed** (`SECOND_TEMPLATE_DEFAULT`): ahol pár kell, és a
   kurátor nem nevezett meg mást, a második sablon Fullbleed. A tiltó üzenet is ezt ajánlja.
4. **A választóból is eltűnik** a sablon-regiszter `retired` jelzőjével (`src/engine/templates.ts`,
   a konzol választója és a Forrás-csomag sablonlistája ebből olvas). Ez a sor a felület-kapu
   (ADR-0066/0068) alatt van, ezért a tulaj kapu-kivételével kerül be; addig a választó még mutatja,
   de a kiválasztása hangosan bukik (1. pont), így Fejezetes mock már most sem készülhet.
5. A munkatársak (Neo, Poe, Vera) saját tanulság-fájljai a tiltást 2026-11-04 óta rögzítik; a repóbeli
   charterek sablont nem neveznek meg, ott nincs teendő.

### Következmény

- Teszt: `scripts/template-pick-check.mts` (pre-commit): a „Parallax + Fejezetes” elutasítva a
  Fullbleed ajánlásával, a Fejezetes egyedül is, a motor Fejezetest új mockként nem renderel, a
  „Parallax + Fullbleed” pontosan teljesül.
- Neo régi jegyíró segédszkriptjei (`~/neo/poe_ticket*.py`, 2026-10-05/06) még Fejezetes-párokat
  sorolnak; egyszeri futások voltak, és ha valaki újra futtatná őket, a curate elutasítja a kérést.

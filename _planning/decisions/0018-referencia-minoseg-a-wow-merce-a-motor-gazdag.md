## ADR-0018 — Referencia-minőség = a „wow" mérce; a motor gazdag, kézműves szekció-készletet igényel

- **Kiváltó (2026-07-23):** a motor-kimenet desktop-screenshotja „template" szintű volt — messze a tulaj
  által elvárt minőségtől. A tulaj leadott 5 referencia-mockot (`assets/design-refs/reference-quality/`),
  amelyek a valódi „wow"-mércét mutatják: full-bleed 100svh hero, üveg/dark foglaló-sáv, gazdag szekciók
  (room-kártyák árral, amenity-rács, vélemények, GYIK, sticky nav, lábléc), erős szerif-display + sans body.
- **Diagnózis:** a motor egy **vékony 4-primitíves vázat** (hero/features/gallery/enquiry) kapott, és a
  kit-passzok ennek a **kombinatorikáját** (skin×archetípus×variáns) húzták fel — nem a **gazdag kézműves
  szekció-készletet**, ami a wow-t adja. Rossz tengelyt optimalizáltunk.
- **Döntés:**
  1. A referencia-minták a repóban maradnak MÉRCEként (`assets/design-refs/reference-quality/` + README =
     kraft-standard ellenőrzőlista). Minden generált mockot EHHEZ hasonlítunk (screenshot: `engine-shot.ts`).
  2. Első javítás (KÉSZ): immerzív hero (full-bleed + scrim + eyebrow + nagy display + CTA) + prominens
     érdeklődés-sáv + nagyvonalúbb ritmus/tipó (`src/engine/primitives.ts`).
  3. Következő: a gazdag szekció-készlet felépítése a mérce szintjére — sticky nav + lábléc + polírozott
     foglaló-sáv, majd amenity-rács · szoba-kártyák · vélemény-sáv · GYIK · térkép (05-MODULES).
- **Tényhűség (§B.17) tisztázva:** a gazdag szekciók a hideg-outreach MOCK-ban **jelölt, reprezentatív
  minta-állapottal** tölthetők (ADR-0015 fázis-határ); ÉLESRE csak valós adat-fedezettel. A kraft
  (hero/tipó/ritmus/nav/lábléc) adat-független → azonnal alkalmazható.
- **Visszafordíthatóság:** 🔄 — a primitív-kraft és a szekció-modulok additívak (registry-bővítés).
- **Státusz:** ELFOGADVA. A minőség-mérce mostantól kötelező visszamérési pont minden motor-változtatásnál.

# 2026-10-02 — Places-fotók kurátori gombja: két forrás-sáv a Fotók fülön (C rész, terv „B”)

**Szál:** SUB a CIT „Places API 600 $” koordinátor alatt; brief `~/rc-briefs/places-kurator-gomb-mock.md`.
Alap: ADR-0293 (A rész: `lead_places_cache`, fizetési politika cached · auto · curator).

## Menet
- §2b: három működő mock (A sor a rács alatt · B két forrás-sáv · C fejléc-gomb + megerősítés), desktop + mobil,
  Playwright-kattintással. A tulaj átnézéskor kifogásolta a mobilon levágott rácsot: ez a valódi konzol 420 px-es
  belső görgetése, jelzés nélkül — a terv ezért „még N kép lent” jelzést kapott (a konzolba is bekerült).
- A tulaj a **B**-t hagyta jóvá → befagyasztva: `assets/design-refs/console/places-kurator/` (plan.html + README + 4 állapot-pár).

## Elvégezve
- `views.ts` `leadPhotosPanel`: két sáv (Portál-adatlap · Google Places), a Places-sáv állapotai
  (nincs lekérve · folyamatban · lekérve/auto-lekérve · nincs találat/gyenge egyezés · elavult · nincs koordináta ·
  nem elérhető · a kérés nem ért vissza), fizetős gomb „fizetős” címkével, görgetés-jelzés.
- `server.ts`: `POST /lead/:id/places-photos` (`places: "curator"`), közös `leadPhotosPayload` a GET-tel; kulcs nélkül
  `unavailable: "nokey"` (nem néma).
- `generate.ts` / `placesCache.ts`: a tárolt eredmény `askedBy` (auto | curator) mezője — a lap csak akkor mondja
  „automatikusan lekérve”, ha tényleg a generálás fizetett.
- Őr: `places-cache-check.mts` +2 állítás (POST curator-politika; askedBy rögzül). KB: console-lead Fotók-szakasz.

## Tanulság
- A felület-tesztet a fő-fa-szabály miatt nem lehetett worktree-szerverrel futtatni (hook) — a valódi `leadPage()`
  HTML-jét szerver nélkül rendereltem, és a böngészőben MINDEN kérést (GET + a fizetős POST) elfogtam: így a teszt
  nem fizetett a Google-nek, és nem indított szervert.

## Nyitott
- ADR-0293 „Nyitott (B–D)” sora a C részt még nyitottnak írja — a koordinátor zárja (nem írtam át a más szál ADR-jét).

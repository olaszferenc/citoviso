# 2026-08-06 — Fotó-derivált per-szállás akcent (§B.6)

## Mit
Az utolsó strukturális „mind ugyanaz" rés bezárva (commit `0dc0f57`). A brief (`generator/brief.ts`)
eddig is kinyerte a szállás fotóiból a 6-színes palettát vision-nel, de az engine-path **eldobta** →
minden azonos-skint kapó szállás **byte-ra azonos akcentet** kapott (ez volt a 08-05-i art-direction
áttörés utáni utolsó rés).

## Hogyan (a kulcs-döntés)
A fotó-akcentet **nem nyersen** tesszük be, hanem a skin **biztonsági sínjeibe HARMONIZÁLVA**:
a **HUE a fotóból** jön, de a **luminanciát a skin saját akcentjének WCAG-luminanciájához** igazítjuk
(bináris keresés HSL-lightness-en). Így:
- a skin **világos/sötét karaktere és kontraszt-garanciái sértetlenek** (a `dark-luxury` sosem
  világosodik ki; az akcent mindig olvasható az `--cit-on-accent` felett — mért kontraszt ≥6);
- **csak a szín-karakter lesz per-szállás egyedi** (borvidék=olajzöld, tópart=kék);
- **determinisztikus** → `mock=live` megmarad (a `SiteData.palette.accent` perzisztálódik, a live
  re-render ugyanazt számolja);
- érvénytelen HEX / kontraszt-bukás → **skin-akcent fallback** (nincs regresszió; fotó nélküli lead a
  tiszta skin-defaultot kapja).

**Egyetlen token cserélődik: `--cit-accent`** — a hoverek `color-mix`-esek, automatikusan követik;
nincs külön `accentDark` token. A 11-token dizájn-kapu PASS marad (csak az érték változik, nem a jelenlét).

## Fájlok
- ÚJ `src/engine/palette.ts` — hex/HSL/WCAG-luminancia + `harmonizeAccent` (függőség nélkül)
- `src/engine/recipe.ts` — `SiteData.palette?.accent`
- `src/engine/skins.ts` — `renderSkinVars(skin, accentOverride?)`
- `src/engine/render.ts` — átadja `data.palette?.accent`
- `src/generator/generateEngine.ts` — `brief.palette.accent` → `siteData.palette` (validált HEX)

## Verifikáció
2 lead × 5 art direction: azonos skin + más szállás → más akcent; minden kontraszt ≥6; dizájn PASS; `tsc` tiszta.

## Nyitva / következő
- ⚠️ Változatlanul: a 20 art-direction mock **őr-köre (`tenyhuseg-or` + `dizajn-doktrina-or`) NEM futott** —
  kiküldés előtt kötelező.
- Opció: a surface/bg finom akcent-tintje (kockázatosabb — kontraszt); most szándékosan CSAK az akcent.
- Párhuzamos pilot-blokkolók: dev↔prod DB egységesítés · valós árak + `PRICING_CONFIRMED` · teljes A–Z sandbox.

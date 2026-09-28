# 2026-09-28 — „Csak egyben adom ki”: a ház az egyetlen ajánlat, a szobák bemutatásra (ADR-0257)

**Brief:** `~/rc-briefs/szobak-bemutatasra-kiadas-nelkul.md` · koordinátor: `citded06a5f-cc` · testvér-szál: `cit72ba9426-02` (whole-unit-band C).

## Mi történt
- Felmérés: a „rejtett” és a „nem foglalható” egy predikátum volt (`guestUnits`) → új, szűkebb: `isBookableUnit`/`bookableUnits`.
- §2b: `plan.html` A/B/C vendég × X/Y admin, mobil+asztali, Playwright 60 állítás, 0 JS-hiba → a tulaj (koordinátoron át): „Elfogadom a javaslatokat” = A + X + `site_unit.whole_only`.
- Egyeztetés a `cit72ba9426-02`-vel: EGY rendszer, a C-sáv `data-cit-whole-mode="main"` állapota; `roomsBlock`/`render.ts` szoba-ág/`cit-runtime.js` az ő landja UTÁN.
- 1. land (ez): migráció 0079 + CHECK, predikátum, editor (választó, ártábla, `Room.wholeOnly`/`presentation`), `/api/foglalas` 400, priceGap (teendő + heti levél), `priceSiteView` („Hol látják” doboz), Árak lap (nincs szoba-kártya, mondat), Szobák (3 állású kártya, harmadik válasz, ár-mező nélküli felvétel, „csak bemutatásra” jel), súgó (`admin-modules-rooms`), kontraktus `assets/design-refs/tenant-site/whole-only/`, őr `whole-only-check` (+ pre-commit).
- A kész felület képéből derült ki, hogy a „Hol látják…” doboz a bemutató szobákat „Ár nélkül … a vendég árajánlatot kér”-ként sorolta — a mockon ez a doboz nem szerepelt. Javítva, őr + negatív kontroll.

## Módosított fájlok
`migrations/0079_unit_whole_only.sql` · `src/db/schema.ts` · `src/tenant/{units,unitVisibility,editor,priceGap,priceSiteView}.ts` · `src/engine/recipe.ts` · `src/server/{public,moduleConfigViews}.ts` · `src/i18n/catalog.json` · `scripts/whole-only-check.mts` · `scripts/whole-property-choice-check.mts` (3 állású kártya) · `hooks/pre-commit` · `kb/entries/admin-modules-rooms/entry.hu.md` · `assets/design-refs/tenant-site/whole-only/` · ADR-0257.

## 2. land — a vendég-oldal (a `whole-unit-band` C után, origin/main ec378179-re)
- A testvér (`cit72ba9426-02`) horga: `render.ts` `splitWholeBand`/`injectWholeBand` („main” → a sáv a sablon szoba-konténere ELÉ), `wholeBandBlock` `data-cit-whole-mode`.
- Itt: a sáv „main” szövegei + kiemelt keret (`cit-modules.css`); `roomShell` → `data-cit-room-show` + „A ház része …” sor (az utolsó belső blokkba — aurorán kívülre lógott); 9 sablon foglalás-linkje `!r.presentation`; tartalék rács „Részletek” gomb + „A ház és a szobái”/„A ház szobái”; runtime felugró (címke, mondat, „Az egész ház foglalása” a HÁZ egységével); widget „Amit foglal”; a bemutató szoba aloldala a házat foglalja (különben üres widget lett volna).
- Őr: `scripts/whole-only-guest-check.mts` (19 sablon × 390/1280 × árral/ár nélkül + negatív kontroll, 114 mérés) + pre-commit.
- Saját szemmel: 19 sablon mobil+asztali montázs (`assets/Temp/_wog-montage-*.png`); a tilted-gallery üres teljes-lapos képe a görgetős galéria műterméke volt — görgetve rendben.
- Szándékos eltérés a mocktól: a felszereltség-címkék a felugróban (rooms-card §1), nem a kártyán.

## Nyitott
- Az Online foglalás képernyő egység-naptáraiban a bemutató szobák megmaradnak (foglalás nem érkezhet rájuk).
- `kb-freshness` piros az `admin-multilang` képén — nem ennek a szálnak a változása.

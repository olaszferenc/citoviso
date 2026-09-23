# 2026-09-23 — a module-sales-check nem ír többé közös DB-sort (verseny-maradék megszűnt)

Brief: `~/rc-briefs/module-sales-check-verseny-brief.md` (a programajánló-szál „Park-lelet"-e,
`2026-09-23_programajanlo_build.md`).

## A hiba (mérve, a javítás ELŐTT)
- A `scripts/module-sales-check.mts` a KÖZÖS dev-DB `app_setting.module_sales_disabled` sorát írta
  (original + VICTIM), a `finally`-ban visszaírta az `original`-t.
- Negatív kontroll: 6 egymásba lapolt futás (0,15 s eltolás) ×3 kör → maradék
  `["email","gallery"]`, majd `["email","gallery","rooms"]` (a ⑤ blokk `rooms`-a is beragadt).
  Ezzel a `configurator-placement-check` pirosra ment („SEMMI nem látszik, ami nincs a csomagban"
  — teljes/rooms, pricing, gallery, booking…), a döntés szerinti `["email"]`-re visszaállítva zöld.
- A második kár: a futás ALATT minden más őr/folyamat egy senki által nem döntött állapotot olvasott
  (a placement-check egy párhuzamos land alatt átmenetileg is bukhatott) — egy advisory lock a
  maradékot megszüntette volna, ezt NEM.

## A javítás (a brief 2. iránya)
- `src/moduleSales.ts`: `overrideDisabledModulesInProcess(ids | null)` — FOLYAMATON BELÜLI
  felülírás, a `getDisabledModules()` ezt adja, ha be van állítva. Termék-kód nem hívja.
- `scripts/module-sales-check.mts`: `setDisabledModules` helyett a felülírás; a zárásban MÉRI, hogy
  a közös sor érték ÉS `updated_at` szerint érintetlen (a régi „ugyanazt visszaírom" is bukna);
  + egy olvasó állítás: felülírás nélkül a termék a tárolt sort olvassa.
- Kontrollok: `--self-test` piros (rc=1); a sort mégis író ideiglenes változat → „ÉRINTETLEN" ✗
  (azonos értékű visszaírást is elkap az `updated_at`); a verseny utána: lásd lent.
- A verseny a javítás UTÁN: ugyanaz a 6 egymásba lapolt futás ×3 kör, KÖZBEN párhuzamos
  `configurator-placement-check` → 18/18 msc rc=0, 3/3 placement rc=0, a sor minden kör után
  `["email"]` (a maradék megszűnt, és a futás alatti átmeneti állapot sem látszik).
- Más író nincs: `grep setDisabledModules scripts src` → csak a konzol /pricing mentése (operátor).

## A közös sor állapota
A mérés alatt kétszer lett elrontva (a negatív kontroll szándékosan), mindkétszer visszaállítva
`["email"]`-re; a session végén `["email"]`.

## Nyitott (nem ebben a szálban)
- A `configurator-placement-check` továbbra is a közös sort OLVASSA (buildManifest). Versenyt már
  nem kap (őr nem ír), de ha az operátor a dev-konzolon kikapcsol pl. `gallery`-t, piros lesz.
  Ez részben VALÓDI jel: a `sampleDenyKeys` a `gallery`-t nem képezi le, tehát egy kikapcsolt
  galéria szekciója a mockon megmaradna, miközben a csomag nem tartalmazza. Termék-kérdés a tulajnak
  (a galéria a lead SAJÁT fotói — „minta"-e?). Az őrt szándékosan NEM rögzítettem a seedre, mert
  az ezt a jelet elnémítaná.

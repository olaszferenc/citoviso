# 2026-09-23 — A konfigurátorban a HAVI az alapértelmezett, a „2 hó ingyen” forintban és mozogva hirdet (ADR-0211)

**Kiváltó:** tulajdonosi kérés a Villa Suzy Zamárdi konfigurátor-képén: „itt legyen a havi fizetés
az alapértelmezett… és a 2 hó ingyen legyen markánsabb hirdetés, akár animált is”.
**Élesítés:** NINCS (tulaj: „a maint majd később egybe”). Landolva: `d38e027a`.

## Mit csináltunk
- **§2b kapu:** 3 változat (A pulzáló pirula · B szalag + áthúzott ár · C csillanó jelvény forintos
  megtakarítással), Mobil/Asztali váltóval, végigkattintva → a tulaj a **C**-t választotta.
  Kontraktus: `assets/design-refs/console/period-badge/` (README köti a viselkedést).
- **Kód:** `period` kezdőérték `"monthly"`; az Éves kártyán `−{havi listaár × ingyen hó} · {n} hó ingyen`
  jelvény (fénycsík + billenés, reduced-motion alatt áll), zöld keret, „10 hónap áráért 12” sor
  (a váltó SAJÁT szélességére kötött `@container` → asztalin + éves ár); éves választáskor a
  megtakarítás forintban az összeg-kártyában. 0 ingyen hónapnál nincs jelvény. A megtakarítás a
  domain-díjat nem tartalmazza (ADR-0109 ⑥).
- **Felülírt döntés:** a 2026-08-23-i éves tulaj-rendelet (ADR-0090 ②) — az ADR-0090 fájlban és a
  `period-toggle-step1` README 5. pontjában jelölve.

## Tanulság
- ⛔ **Egy alapérték-váltás HÁROM idegen őrt pirosított**, mind ugyanazzal a ki nem mondott
  feltevéssel („induláskor éves”): `checkout-item-block-check`, `module-dependency-cart-check` ⑤,
  `renewal-date-coherence-check` (a fixture-rendelése éves, a böngésző-rész csak az alapérték miatt
  egyezett vele). Egyik sem a period-váltót vizsgálta. Igazítás: a teszt EXPLICIT választja az
  Évest (a régi állítások változatlanul futnak), illetve az ütemet a kijelzett egységből olvassa —
  nem a piros eltüntetése, az öntesztek továbbra is pirosak a visszarontáson.
  → Alapérték cseréje előtt grepeld a `scripts/`-ben a `data-period`, `popt`, `/ év`, `annual` mintákat.
- ⚠️ A `prospect-owned` pre-commit kapu egyszer egy PÁRHUZAMOS session `_moddep_` fixture-leadjébe
  akadt (közös DB); újrafuttatva zöld — nem kódhiba.
- ⚠️ Land közben egy másik szál ADR-enként külön fájlra bontotta a naplót és elvitte a 0210-et →
  az enyém 0211 lett; 12 hivatkozás 8 fájlban átszámozva (a main-en ezekben 0 db 0210 volt, tehát
  mind az enyém), az index diffje egyetlen sor.
- ⚠️ A negatív kontroll a KÖZÖS `/tmp/cit-configurator-price-check.html`-t az elrontott runtime-mal
  hagyta hátra → az első fotóm „19 001 Ft”-ot mutatott; az őr újrafuttatása építi újra.

## Nyitott kérdés
- Már **éves** előfizetésű tenant vásárol, és a havi alapértelmezésen hagyja a váltót: a
  fizetőoldal havi összeget mutathat, a visszaigazolás évest (a `renewal-date-coherence` fixture
  mutatta így). Korábban is előfordulhatott (kézi Havi-kattintással), most gyakoribb. NEM mérve a
  kódban — kivizsgálandó.

## Módosított fájlok
`assets/runtime/cit-configurator.{js,css}` · `src/i18n/catalog.json` ·
`assets/design-refs/console/period-badge/{plan.html,README.md}` ·
`assets/design-refs/console/period-toggle-step1/README.md` ·
`_planning/decisions/0211-a-konfiguratorban-a-havi-az-alapertelmezett.md` · `_planning/decisions/0090-…md` ·
`_planning/DECISIONS.md` (generált) · `scripts/{configurator-price-check,checkout-item-block-check,module-dependency-cart-check,renewal-date-coherence-check}.mts`

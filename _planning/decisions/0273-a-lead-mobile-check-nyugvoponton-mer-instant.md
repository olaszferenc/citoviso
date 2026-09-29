## ADR-0273 — A lead-mobile-check nyugvóponton mér (instant görgetés, közös nyugvópont-várás, R8 a lap alján is), és a pirula a foglalás-sáv beúszása után újrahelyeződik (2026-09-29)

- **Kiváltó:** a kapu-koordinátor (`cit3bd83952`) briefje, `~/rc-briefs/lead-mobile-terhelesen-piros.md`:
  a teljes pre-commit alatt (114 kapu, load1 5–9) a `lead-mobile-check --gate --selftest` 2/2 PIROS volt
  (R4: „a konfigurátor kilóg”, + a „pill-on-bar” önteszt-ág), egyedül zöld. Gyanú: az ADR-0263 (4 munkás).
- **Előzmény:** ADR-0168 (mozgó elem helyét nyugvópontban mérjük), ADR-0242 (a pirula a foglalás-sáv
  fölött), ADR-0253 (a telefonos foglalás-sáv a hero UTÁN csúszik be), ADR-0263.

**Mérés (8 CPU-égető, load1 ~21, csak ez a kapu):**
- `CIT_GATE_JOBS=4` → rc=1: fullbleed@390 R8 („a pirula rögzített alsó sávon ül: div.t-mobcta (44 px)”).
- `CIT_GATE_JOBS=1` → rc=1: R4 („a konfigurátor kilóg {top:695,bottom:1319}”) + a „pill-on-bar”
  visszarontás NEM lett piros. **Tehát nem az ADR-0263 hibája** — a párhuzamosítás csak terhelést ad.
- Idővonal-nyomkövetés (50 ms-onként a pirula / `[data-cit-mobbar]` / consent téglalapja + `scrollY`) a ⑤
  lépés görgetése után: a `window.scrollTo(0, 0.4·vh)` a sablon `scroll-behavior:smooth`-ja miatt ~0,8 s-os
  SIMA görgetés (4708 → 338 px). Közben a pirula ÁLL (597 px), a sáv még fent van, majd lecsúszik
  (0,28 s), és csak utána száll le a pirula (661 px). A régi „a pirula 350 ms-ig áll” próba ezt
  nyugvópontnak vette.

**Gyökérok:** a kapu átmeneti állapotot mért. (1) Az R8-at a sima görgetés KÖZBEN olvasta; a
„pill-on-bar” visszarontás PIROSA is ebből élt (a sáv még fent volt) — terhelésen a görgetés/IO-callback
máshová esett, és a hibás változat ZÖLDEN átment. (2) A panel 0,28 s-os beúszását fix 700 ms után
mérte; terhelésen félúton (top 695 a 844-ből).

**Döntés:**
1. A ⑤ görgetés `behavior: "instant"` (a ④ lépés már így járt el).
2. Közös `rest()`: a pirula, a foglalás-sáv, a consent-sáv, a konfigurátor-panel téglalapja + láthatósága
   + `scrollY` 400 ms-ig (lap-óra) változatlan, és nincs rajtuk futó VÉGES animáció/átmenet
   (`document.getAnimations()`). A ②, ③, ④, ⑤ (koppintás előtt és után) lépések erre várnak; a fix
   várakozások MINIMUMKÉNT maradnak (a futásidő saját időzítőit fedik, pl. placeLaunch 0,9 s).
   10 s alatt nyugvópont nélkül: a mérés ugyanúgy lefut (semmi nem marad ki), és GYANÚ jelzés kerül a lapra.
3. Az R8-at a lap ALJÁN, nyugvóponton IS mérjük: ott az első görgetés után a consent megérkezett, a hero
   alatt a foglalás-sáv fent van — ez az az állapot, amit az elhelyezésnek ki kell kerülnie. A visszarontás
   így determinisztikusan piros, nem időzítésből.
- ⛔ Egyetlen állítás, visszarontás, negatív kontroll sem gyengült; fix mérési várakozás nem nőtt, csak a
  nyugvópontra várás került a mérés elé (a koppintás korlátját lásd az 5. pontban).

4. **Termék-hibajavítás (a 3. pont mérte ki):** a lap alján, NYUGVÓPONTON, terhelés alatt a pirula TARTÓSAN
   a foglalás-sávon ült (brutalism@390 tiszta lapon „div.b-mobcta (44 px)”). Ok: a `placeLaunch()` csak
   görgetésre (120 ms), átméretezésre, consent-változásra és egyszer 0,9 s-nál fut; a `[data-cit-mobbar]`
   IO-kiváltotta 0,28 s-os be-/kicsúszására nem. Ha a görgetés megáll, mielőtt a sáv beér (lassú telefon),
   a pirula a sávon marad. Javítás: `cit-configurator.js` — a `[data-cit-mobbar]` `transitionend`-jére
   `schedulePlace()`. A `placeLaunch()` logikája változatlan (koordinátori feltétel).
5. A koppintás actionability-korlátja 3 → 10 s (a Playwright ennyit vár a nyugvó, látható, eseményt fogadó
   pirulára — ez is nyugvópont-várás, nem állítás-lazítás), és a panel-mérés hibás koppintás után is
   nyugvópontra vár.

**Ami NEM segített volna:** a brief 3. pontja (soros futás, 1 munkás) — mérve 1 munkással is piros volt.

**Bizonyítás:** lásd a session-jegyzetet (`_planning/memory/2026-09-29_lead_mobile_nyugvopont.md`).

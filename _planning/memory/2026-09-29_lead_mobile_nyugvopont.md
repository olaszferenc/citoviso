# A lead-mobile-check terhelésen piros volt — nyugvópont-mérés + a pirula újrahelyezése a sáv beúszása után (2026-09-29)

SUB-szál (koordinátor: `cit3bd83952`, kapu-koordinátor) · brief: `~/rc-briefs/lead-mobile-terhelesen-piros.md` ·
döntés: ADR-0273 (`_planning/decisions/XXXX-lead-mobile-nyugvoponton-mer.md`).

## Reprodukció (8 CPU-égető, 8 mag, csak ez a kapu, main = af925571)
- `CIT_GATE_JOBS=4`: rc=1 (fullbleed@390 R8 a `t-mobcta`-n) · `CIT_GATE_JOBS=1`: rc=1 (R4 panel top 695, + a
  „pill-on-bar” önteszt NEM piros) → **nem az ADR-0263 hibája**; a soros tünetkezelés (brief 3.) nem segítene.
- Idővonal (50 ms-onként): a ⑤ `scrollTo` a `scroll-behavior:smooth` miatt ~0,8 s-os animáció volt; a
  „pirula áll 350 ms” próba ezt nyugvópontnak vette. A „pill-on-bar” pirosa is ebből az átmenetből élt.

## Javítás
- `scripts/lead-mobile-check.mts`: instant görgetés; közös `rest()` (pirula · `[data-cit-mobbar]` · consent ·
  panel téglalap + láthatóság + `scrollY` 400 ms-ig áll, nincs futó véges átmenetük; fix várakozás = minimum;
  10 s után GYANÚ, de mér); R8 a lap ALJÁN is, nyugvóponton (ott a sáv fent van); koppintás-actionability
  3 → 10 s; panel-mérés hibás koppintás után is nyugvóponton.
- `assets/runtime/cit-configurator.js` (termék-hibajavítás, koordinátori jóváhagyással): a nyugvóponti R8
  kimérte, hogy terhelésen/lassú telefonon a pirula TARTÓSAN a foglalás-sávon marad (brutalism@390
  `b-mobcta` 44 px), mert a sáv 0,28 s-os beúszása nem hívta a `placeLaunch()`-ot → `[data-cit-mobbar]`
  `transitionend` → `schedulePlace()`. A `placeLaunch()` változatlan.

## Bizonyítás
- Javítás előtt (csak a kapu javítva, termék nem): 8 égető 2/3 zöld (a 3.: brutalism R8 a sávon, nyugvóponton;
  fullbleed/aurora koppintás-időtúllépés), 4 égető: no-clearance mellett R8 piros → ezek vezettek a termék-
  és a koppintás-javításhoz.
- Végleges: terhelés nélkül rc=0 · 8 égetővel 3/3 rc=0 (load 12–14) · 4 égetővel 1/1 rc=0. Nyugvópont-GYANÚ: 0.
  ⚠️ A 3/3 alatt a gép háttérterhelése kisebb volt, mint a reprodukciókor (load ~21–28), mert az A szál hookja
  addigra végzett.
- Az önteszt mind a 9 visszarontása piros a saját szabályán (ágszám változatlan); a „pill-on-bar” R8-lelete
  kizárólag „lap alján: div.t-mobcta (44 px)” — nyugvóponti, nem átmeneti. Kép: a kapu saját 04-bottom képei
  (brutalism tiszta: pirula a sáv fölött; pill-on-bar: a sávon).
- Egyedül zöld: configurator-float, configurator-placement, mobile-chrome (+ `--selftest`).

## Mellékleletek
- A másik 3 ADR-0263-as kapu terhelésen: room-details, lead-page-surface, guest-mobile `--selftest` zöld;
  **guest-mobile piros** (aurora@390 ⑥naptár-takarva `div.au-glass.au-nv`) — a koordinátor ezt nekem adta, a
  land UTÁN. Gyanú: a naptár-lépés `stickyH`-ját 600 ms után méri, amikor az aurora beúszó felső sávja még
  opacity 0 → a naptár a sáv alá kerül (időzítés, nem termék) — igazolandó.
- ⛔ Hibám: a próbafutásaim leállítására `pkill -f "lead-mobile-check.mts --gate"`-et futtattam, ami
  gépszinten illeszkedik — az A szál (`cit0dea1902`) épp futó hookjának kapuját is megölhette. Jelentve.
  Csak PID szerint ölj.

# 2026-09-29 — A következő lassú kapuk párhuzamosítása („B” opció, ADR-0264)

Brief: `~/rc-briefs/ot-lassu-kapu-parhuzamositasa.md` (koordinátor `cit3bd83952`, tulaj: „Ok a és b”).

**Kész (egyedül mérve, a pass/fail sorok betűre azonosak a sorossal):**
- `room-card-overflow-check` 111 → 34 s (önteszt 230 → 68 s)
- `configurator-float-check` 86 → 32 s
- `configurator-placement-check` 61 → 39 s (plafon: a 32 s-os csomag-bejárás)
- `whole-only-guest-check` 50 → 26 s
- Kihagyva: `mobile-chrome-check --selftest` — már párhuzamos és önátfedés-biztos, a fő futás mellett fut.

**Tanulságok:**
- ⚠️ A `whole-only-guest-check` soros ciklusa szélességenként ÚJRARENDERELTE ugyanazt a fájlt — ezt
  párhuzamosítva két munkás írta volna egymás alatt. A „pool előtt írj, a poolban csak olvass” szabály
  ezt fogta meg; a render-ciklust mindig nézd meg, mielőtt egységekre bontasz.
- A px-koordináta a leletszövegben (aurora, becsúszó pirula) futás-függő; a verdikt nem.
- Mérés erős idegen terhelés alatt (load 29/8 mag): az „utána” szám felére romlik — egy futás elég
  az irányhoz, a land a valós mérés.

**Módosított fájlok:** `scripts/room-card-overflow-check.mts`, `scripts/configurator-float-check.mts`,
`scripts/configurator-placement-check.mts`, `scripts/whole-only-guest-check.mts`,
`_planning/decisions/XXXX-negy-tovabbi-lassu-kapu-parhuzamos.md`, ez a jegyzet.

# 2026-09-29 — A négy leglassabb böngészős kapu párhuzamosítása (közös `gate-pool`)

Brief: `~/rc-briefs/lassu-kapuk-parhuzamositasa.md` (tulaj: „Igen”). Döntés: ADR-XXXX
(`XXXX-a-negy-lassu-bongeszos-kapu-parhuzamos-munkasokkal.md`). Menet közben koordinátor-váltás
(citded06a5f → cit3bd83952, a tulaj: „mi a tököm tart eddig”) — a mérést a meglévő számokkal zártam.

**Mérve (egyedül, előtte 3 soros futás → utána 2–3 párhuzamos, mind zöld):**
- `lead-page-surface-check` 307–313 s → 90–94 s
- `guest-mobile-check` 201–214 s → 56–57 s; `--selftest` 87–101 s → 27 s, és önátfedés-biztos lett
- `room-details-check` 179–183 s → 50 s; `--selftest` (nincs a hookban) 2395 s → 641–650 s
- `lead-mobile-check --gate --selftest` 167–168 s → 50–51 s
- A kimenet betűre azonos a soros futáséval; minden negatív kontroll párhuzamosan is piros.

**Nyitott megfigyelés:** a `room-details --selftest` „fixed pozíció leütése” visszarontásánál a
lelet szövegében szereplő y-koordináták futásonként eltérnek (két párhuzamos futás között is);
az ítélet azonos (38/38 piros). Soros-soros összevetés nem készült.

**Tanulságok:**
- ⛔ Majdnem elkövettem a CLAUDE.md-ben leírt önölő `pgrep -f` hibát: a `pgrep -f "scratchpad/after.sh"`
  a SAJÁT parancssoromra is illeszkedett, és a saját shellemet lőttem le (exit 144); a gyermek-kapu
  árván futott tovább. PID-et előbb `ps`-szel keresd ki, aztán ölj.
- ⭐ Ugyanez a leállítás élő bizonyítékot adott: a futás közben megszűnt böngésző mellett a
  `room-details` 14/38 „a mérés nem futott le” sorral HANGOSAN bukott — a pool előre kitöltött
  hiba-helyei működnek.
- A `guest-mobile-check`-ben két azonosító sablonként ÉS archetípusként is létezik (`dark-luxury`,
  `card-sidebar`); a soros haladás-sor halmozottan számolta a leleteket — a párhuzamos változat ezt
  betűre megtartja (a visszajátszás a már összefésült listán számol).

**Módosított fájlok:** `scripts/lib/gate-pool.mts` (új), `scripts/lead-page-surface-check.mts`,
`scripts/guest-mobile-check.mts`, `scripts/room-details-check.mts`, `scripts/lead-mobile-check.mts`,
az ADR, ez a jegyzet (+ a generált indexek).

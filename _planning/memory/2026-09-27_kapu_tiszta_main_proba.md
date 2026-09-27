# 2026-09-27 — „Piros a tiszta mainen is?”: a bukott kapu automatikus tiszta-main próbája

## Mi történt
- Brief: `~/rc-briefs/kapu-tiszta-main-diagnozis.md` (a `cit873a226d` Webcím-szálból; tulaj: „Jó ötlet.
  Indítsd egy külön szálba.”). Kiváltó: a `photo-normalize-check` a mainen is piros volt (a közös DB
  „első” tenantja egységes), minden `adminViews.ts`-es commitot blokkolt, a diagnózis ~30 perc volt.
- Megépítve: `scripts/lib/main-probe.mjs` — bukás után az ELSŐ bukott kaput egy ideiglenes detached
  worktree-ben az origin/mainen újrajátssza (main saját futtatója, gépi slot, 300 s időkorlát), és
  ítél: „EZ NEM A TE VÁLTOZÁSOD” (+ a kapu utolsó main-commitja és `Claude-Session` trailere) /
  „A TE VÁLTOZÁSOD BUKIK” / NEM DÖNTÖTT (új kapu · diffet olvasó kapu · időkorlát · próba-hiba).
  Soha nem enged át; a hook a kapu kódjával lép ki. ADR-0249.
- Élesben mérve a valódi esetre (origin/main `a2df3252`, a javítás még nem landolt):
  13 s alatt „EZ NEM A TE VÁLTOZÁSOD”, gazda `ed651fdc` + session-link.
- A `cit873a226d` szál közben egy második esetet küldött: a `console-contrast-check` `/lead/<id>`
  lapja ~31 s-os networkidle-t kér a 30 s-os `goto`-ra → terhelésfüggő, a mainen is. Ez beépült a
  „zöld a mainen” ítélet figyelmeztetésébe (egy futás = szerencse is lehet) és az ADR-be; a kaput
  NEM javítottam (idegen, a gazdája dönt).

## Módosított / új fájlok
- `scripts/lib/main-probe.mjs` (új)
- `scripts/main-probe-check.mts` (új őr: 9 forgatókönyv + 7 visszarontásos önteszt)
- `hooks/pre-commit` (`gate_flush`: minden bukott kapu kiírása után a próba, majd `exit "$last"`; az őr bekötése)
- `_planning/decisions/XXXX-bukott-kapu-tiszta-main-probaja.md`

## Nyitott
- `console-contrast-check` időkorlátja — a gazdájánál.
- Soros módban (`CIT_GATE_JOBS=1`) nincs próba (a feljegyzés a futtatóé).
- A „zöld a mainen” egyetlen futás; időzítés-érzékeny kapunál nem bizonyíték (ki van írva).

## Tanulság
- A commit szerzője itt MINDIG a tulaj — a „ki a gazda” kérdésre a `Claude-Session` trailer felel.

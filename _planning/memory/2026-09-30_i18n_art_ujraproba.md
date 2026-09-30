# 2026-09-30 — A 7 `{Art}`-os angol UI-string: a fordító újrapróbál, a magyar névelő nem szivárog (SUB i18nart)

**Kiváltó:** a nagy deploy GATE 5-je élesen `en: 3694/3701` (7 hiányzik), boot-öngyógyítás kétszer ugyanaz.

**Mérve:**
- Mechanizmus: `translateBatch` eldobta a placeholder-sértő stringet, újrapróba nélkül; mind a 7-ben az `{Art}`
  (magyar névelő) maradt ki — angolban helyesen.
- Dev csomagok: 6 nyelv × 33 névelős kulcs, MIND megőrizte a tokent → az angol felület „We couldn't purchase
  A example.hu”-t írt. Az új rendereléssel 31/33 tiszta, 2 („Felülírta: {art} {when}-i … mock.”) régi
  fordítása hibás („Overridden by:'s mockup”) — újrafordítás kell (adat).
- Valódi modell, a 7 élesen bukott stringre, az új prompttal: 1 hívás, 7/7 átment („We couldn't purchase the {domain} name”).
- Élesi olvasás: `i18n-pack-status` rc=1 → az új GATE 5 feltétel kiváltana.

**Változott:** `src/i18n/packs.ts` (placeholderProblem, interpolate, translateStrings + 2 újrapróba-kör),
`src/i18n/mail.ts` (T → interpolate; a sablon-oldali `templateKit.ts` T-jét névelő-var nem éri, nem változott), `scripts/deploy-prod.sh` (GATE 5 kiváltó),
`scripts/i18n-retry-check.mts` (új őr), `hooks/pre-commit` (bekötés), ADR-0281.

**Nyitott:** a 2 torzult fordítás és a kliens-oldali `data-art` (adminViews `art(id)`) — a jelentésben DÖNTÉS KELL.
A `catalog.json` nem változott.

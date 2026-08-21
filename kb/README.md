# Tudásbázis (KB) — szerzői kontraktus (ADR-0045, 03-INVARIANTS §J)

A KB a felhasználó-vezetés termék-rétege: folyamatleírás + screenshot minden tenant-felé néző
admin-funkcióhoz. Cél-mérce: **az IT-kezdő tulaj TELEFONRÓL, segítség nélkül végigmegy a folyamaton.**

## Struktúra

```
kb/
  entries/
    <slug>/               # ANGOL kebab-case (struktúra-rendelet, 2026-08-01)
      entry.hu.md         # magyar FORRÁS-tartalom (a fordítás automata, kb_translation)
      assets/
        hu/               # nyelv-jelölt screenshotok (script-generált a cél — §J.26)
```

## `entry.hu.md` frontmatter (mind kötelező)

```markdown
---
id: admin-photos          # = a mappa neve
title: Fotók kezelése
audience: tenant          # tenant | operator
anchors: admin.photos     # angol, pont-szeparált; többet vesszővel
updated: 2026-08-21
---
```

## Szabályok (a `scripts/kb-check.mts --coverage` kapuzza: pre-commit + PostToolUse hook)

1. **Felület-hűség — GÉPI kontraktussal:** ami az entryben **„félkövér-idézőjeles”** formában áll,
   az UI-felirat-ÁLLÍTÁS, és SZÓ SZERINT szerepelnie kell a view-forrásban (`adminViews.ts`,
   `moduleConfigViews.ts`) — gomb-átnevezés = piros kapu, amíg a súgó nem követi. Sima „idézőjel”
   félkövér nélkül szabad próza (példák, nem-UI kifejezések) — azt nem ellenőrzi gép.
2. **IT-kezdő hang:** lépésenként, előismeret nélkül, a MIÉRT-tel együtt. Szakszó csak magyarázattal.
3. **Anchor:** minden entry legalább egy `data-kb-anchor`-hoz kötődik; a bijekciót (view ↔ entry,
   mindkét irányban) + az 5 admin-fül kötelező lefedettségét a `--coverage` méri.
4. **Screenshot:** CSAK a `scripts/kb-shot.mts` által generált, nyelv-jelölt kép
   (`assets/<lang>/screen.png`) — UI-változás után futtasd újra; külső URL tilos, kézi kép átmeneti.
5. **Fordítás:** SOHA ne írj kézzel idegen nyelvű entryt — a magyar forrás az igazság, a többi nyelv
   a `kb_translation`-ből jön automatikusan (③ szelet).

## Támogatott markdown-részhalmaz (a renderelő — `src/kb/kb.ts` — ennyit tud)

`## ` alcím · bekezdés · `- ` felsorolás · `1. ` számozott lista · `**félkövér**` ·
kép önálló sorban (`![alt](assets/hu/screen.png)`). Más szintaxist NE használj.

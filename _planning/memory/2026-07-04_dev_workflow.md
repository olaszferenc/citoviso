---
name: reference-citoviso-dev-workflow
description: Hogyan fejlesztünk — hozzáférés, deploy-doktrína, git, kód, design
metadata:
  type: reference
---

**Dev-környezet & hozzáférés:**
- Fejlesztés a Debian dev-gépen, `citoviso` user, `/home/citoviso/citoviso`. Lokál teszt.
- Hozzáférés: SSH a gépre (Tailscale-en „kvázi lokál"), `citoviso` userként; VAGY a `CIT ➕` remote-control session (telefon/böngésző).
- ⚠️ NINCS drive-mount és NINCS FTP az éleshez (az a régi Windows-MineREAL mechanizmus volt — itt nem létezik).
- Dev-webszerver (majd): Tailscale-only IP-n, SOHA a webpublikus mappában.

**Deploy-doktrína (CLAUDE.md §0 — megkerülhetetlen):**
1. Lokál először: minden a dev-gépen fejlesztve+tesztelve.
2. Push = CSAK a módosított fájlok, listázva; soha az egész mappa.
3. Élesre CSAK az aktuális turn-ben adott, scope-olt user-engedéllyel; push-onként ÚJ engedély (nem marad nyitva).
4. Élesi OLVASÁS szabad (diagnosztika); élesi mutálás soha engedély nélkül.
5. Éles infra EGYELŐRE NINCS (TBD) → amíg nincs cél, minden „éles" tárgytalan. A `bypassPermissions` NEM élesi felhatalmazás.
- Globális `block_live_deploy.sh` PreToolUse hook blokkolja az élesi írást engedély nélkül (a citoviso userre is telepítve).

**Git:** lokál commit szabadon; push GitHubra (`olaszferenc/citoviso`, deploy key). Session zárásakor: add/commit/push + MEMORY frissítés.

**Kód-konvenciók:** TS strict + ESM; angol kód-komment, magyar kommunikáció; teljes copy-paste kész fájlok, NINCS placeholder-komment; DB-mezőt ne feltételezz — kérdezz.

**Design (a generált oldalakra — DOMAIN 03-INVARIANTS §B):** nincs emoji → saját SVG-sprite; szállásonként EGYEDI „mag" (valós adat), nem generikus sablon; kép-vezérelt paletta + stílus-preset.

**Memória + ontológia:** session-indításkor CLAUDE.md + MEMORY.md + `_planning/memory` index + DOMAIN `04-INDEX`. Fejlődő memória + heti auto-distiller (vas 04:00) → `_inbox` review → ember vezeti át. Lásd [[project_isolation_and_distiller]].

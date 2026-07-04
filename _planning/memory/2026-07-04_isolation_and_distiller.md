---
name: project-isolation-and-distiller
description: Hol fut a citoviso (külön user) és az ontológia-distiller cron
metadata:
  type: project
---

**Szigetelés (2026-07-04):** a citoviso **külön `citoviso` Linux userben** fut a Debian dev-gépen (saját home/`~/.claude`/crontab/watchdog) — OS-szintű elválás a MineREAL-tól. Proto/dev fázis; ha van váz+méret → **saját dedikált VPS** (minden hordozható). A `mineral`-alatti köztes állapot lezárva.

**Ontológia-distiller cron:** `_planning/DOMAIN/_tools/distill.sh` — a citoviso epizodikus memóriát (repo-scoped, csak `-home-citoviso-citoviso`) `claude -p` read-only review-val a `_inbox/`-ba desztillálja, ember vezeti át. Cron a **citoviso saját crontab**-jában: vasárnap 04:00 (log `~/.claude/distill-citoviso.log`).

**⚠️ Keveredés-fix:** a distiller a memória-dirt a repo-útból származtatja → determinisztikusan CSAK a saját repót olvassa (0 minereal-találat igazolva). Lásd [[reference_citoviso_remote_setup]].

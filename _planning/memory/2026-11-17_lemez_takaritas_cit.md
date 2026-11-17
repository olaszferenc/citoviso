# 2026-11-17 — Lemez-takarítás CIT (938M → 26G szabad)

Session: `cita0e87ef5` · Brief: `~/rc-briefs/takaritas-20261116.md` (OF, Ferenc utasítására: „takarítsanak ki minden felesleget, nem használt cuccot, és mérjünk újra”).

## Mérés
| | előtte (11-16 22:40) | utána (11-17 09:20) |
|---|---|---|
| `df -h /` | 938M szabad (100%) | 26G szabad (75%) |
| `du -sxh ~` | 65G | ~46G |
| swap | 9,9/9,9G | 9,8/9,9G |

A `/` 91G-jából (11-17 reggel): `/home/citoviso` 55G, `/home/mineral` 25G, `/home/olaszok` 2G, `/var` 5,2G, `/usr` 4,2G.

## Elvégzett munka
- **Törölve:** uv/pip/npm cache (~2G); 4 landolt, tiszta, lakó nélküli, 24h-ja érintetlen munkafa `git worktree remove`-val (`citc3087339`, `help`, 2 db `citoviso/.claude/worktrees/agent-*`); a futó folyamat által nem használt Claude CLI 2.1.319 és 2.1.321 (~680M); az Android-emulátor (`~/Android/emulator`, `~/Android/system-images`, `~/.android/avd` — a 11-06-i `citmsg` Viber/WhatsApp-kísérlet, a kód nem hívja; +8G, tulaj „1 2 ok”).
- **Megtartva az `~/Android`-ból:** `platform-tools` (adb → a valódi Galaxy S10, `RF8M2101WXX`: callbot, `s10_send.py`, SMS-démon), `build-tools`, `platforms`, `cmdline-tools`, `s10`, `apk`.
- **Költöztetve `/mnt/hdd/citoviso/rc-briefs-data/`-ra, visszamutató symlinkkel:** `rc-briefs/ab-egylepes/{cv-venv,cases}` (2G; a mappa marad, mert a `uj-lanc/fo-terv/write.py` olvassa a `cj.txt`-t); `rc-briefs/egylepes-elo/cases` 5081 db 3 napnál régebbi, lezárt esete mappánként (~3G; a `watch-fill.sh` a `result-live.json` létéből dönt, a symlinken át is működik).
- **Archiválva symlink nélkül:** `citoviso/assets/Temp` 7 napnál régebbi 4675 tétele (3,8G) → `/mnt/hdd/citoviso/assets-Temp-archive-20261116/`. A törlést a Claude Code rm-őre megállította (sh -c-s szkript), ezért áthelyezés lett belőle.
- **Munkatársak saját takarítása (kérésre):** Neo 4,6G → 182M, Vera2 922M → 3M, Poe2 619M → 56K, Poe3 209M → 16K, Telefon (`cit5980e14c`) 723M → 7M; a Viber/WhatsApp APK-mentés átkerült a `~/Android/apk/backup-20261116/` mappába (különben a scratchpad-GC vitte volna).
- **Neo Chrome:** a `cit5926a648` MCP-je 4 napja Neo profiljával (`~/neo/chrome-profile`) futtatott egy böngészőt (1,6G), ezért Neo nem tudott csatlakozni. A gazdája megerősítette, hogy nem kell neki, ezért PID szerint leállítottam; Neo böngészője azóta megy.
- **Watchdog:** a 16 retire-elt, landolt, de 24h-n belül módosult fát a munkafa-GC 11-17 reggelre magától törölte.

## Tanulságok
- A lemezt nem az üzleti adat tölti, hanem a párhuzamos sessionök hulladéka: fánként ~300M, napok óta élő munkatárs-sessionök átiratai (Neo 2G) és scratchpadjei.
- Egy session ne használja más munkatárs Chrome-profilját (`--userDataDir`): a profilzár kizárja a gazdáját.
- Az `~/Android` nem csak emulátor: az S10-csatorna eszközei is ott vannak.

## Módosított fájlok
- `MEMORY.md`
- `_planning/memory/2026-11-17_lemez_takaritas_cit.md`

## Nyitott kérdések
1. Tulaj-döntés: kapja-e az MR (`mineral`, 25G) ugyanezt a takarítási briefet.
2. Felajánlva: a tele swap okainak átnézése.
3. Ferenc dönt (lista a MEMORY.md 11-16 23:00-s sorában): `~/.claude/projects` 10G, `~/.cache/huggingface` 1,6G, `speech-venv`, `google-cloud-sdk`, `citoviso-tts`.

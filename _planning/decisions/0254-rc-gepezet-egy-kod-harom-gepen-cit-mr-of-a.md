## ADR-0254 — RC-gépezet: egy kód három gépen (CIT · MR · OF) + a session által indított session „🔴 SUB” jelölése

**Dátum:** 2026-09-28 · **Státusz:** ELFOGADVA (tulaj: „tegyük doktrína szintbe, megkerülhetetlenül” · „közös, legjobb-összeg”) ·
**Hatókör:** a gép infrastruktúrája (a repón KÍVÜL: `~/bin`, `~/.claude`, `~/.config`) mindhárom környezetben ·
**Kapcsolódó:** a session↔munkafa doktrína (2026-09-23), a resume-őr (2026-09-24)

### Kiváltó ok (tulaj, 2026-09-28)
1. „Ha egy új sessiont nem én indítok, hanem egy másik session, … tudni fogom, hogy nem én koordinálom.”
   A sessionök által indított sessionök a listában megkülönböztethetetlenek voltak a tulaj sajátjaitól.
2. „Amit itt működtetünk, az legyen a standard a másik két entitásnál is.” Mérve: a három watchdog
   szétfejlődött, és mindegyikben volt olyan javítás, ami a másik kettőből hiányzott:
   - MR: REBRIDGE, felhő-törlés gyógyítás előtt, gyors pool;
   - CIT: témára-címadás;
   - OF: a UI-ban törölt üres slot kivezetése.

### Döntés
① **SUB-jelölés.** A session által indított session neve `<KEY> ➕ 🔴 SUB <cím>`.
   - Az `rc-new.sh` kényszeríti (a hívó nevét normalizálja), és jelölőfájlt ír (`~/.claude/rc-sub/<sid>`).
   - Az `rc-handoff.sh` az elődtől örököl.
   - A watchdog témára-átnevezése a jelet megtartja.
   - A közvetlen `claude --remote-control` indítást a `block_direct_rc_launch.py` hook blokkolja.
   - A „piros” a 🔴, mert a cím sima szöveg.

② **Egy kód, három gép.**
   - A watchdog, a 4 `rc-*` szkript, a 3 session-hook és a `CLAUDE.md` `RC-STANDARD` blokkja mindhárom gépen betűre azonos.
   - A gépenkénti eltérés kizárólag a `~/.config/rc-watchdog.json`-ban él.
   - A forrás a CIT. Kivitel és eltérés-ellenőrzés: `rc-watchdog-sync.sh --push --go` / `--check`.
   - MR/OF-en helyben szerkeszteni tilos.

③ **A „standard” a legjobb összeg, nem a CIT szó szerinti másolata.** Egyetlen szándékos kivétel az
   OAuth-forgatás: csak az MR (`rotator: true`), mert két forgató érvényteleníti egymás refresh tokenjét.

### Következmények
- **Javított rejtett hiba:** az MR `--dry-run` elküldte a token-kérést, és csak az írást hagyta ki.
  Egy lejárat-közeli szárazfuttatás eldobta volna az egyetlen érvényes refresh tokent.
- Az élesítéskor 3 halott (augusztusi) üres slot kivezetve.
- Az OF sessionjei mostantól témára kapnak címet; a tulaj által adott név érinthetetlen.
- **Nyitott:**
  - Az OF repó `CLAUDE.md` §3 („Commit + push”) elavult; a globális OF-kiegészítés felülírja, de a repó szövegét egy OF-sessionből kell javítani.
  - Az MR cronban a CIT-nek szóló token-továbbküldés szünetel („PAUSED-for-design-login”).

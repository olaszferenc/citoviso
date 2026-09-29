# 2026-09-29 — Gépszintű land-sor (flock) a land.sh-ban

**Brief:** `~/rc-briefs/land-sor.md` (koordinátor: cit3bd83952). **Döntés:** ADR-0275 (gépszintű land-sor).

## Elvégezve
- `scripts/land-lock.sh` (új): `land_lock_acquire` / `land_lock_release`; zárfájl a közös git-dir alatt,
  `flock -o` tartó-folyamat, ami a land PID-jét figyeli (örökölt fd nincs), hangos várakozás ~30 s-onként.
- `scripts/land.sh`: source + acquire a fetch előtt; release a fő-fa frissítése után.
- `scripts/land-lock-check.mts` (új őr) + bekötés a `hooks/pre-commit`-be.

## Csapdák útközben
- A kamu land csupasz `wait`-je a háttérben élő zártartóra is várt (holtpont) → `wait $!`. A `land.sh`-ban
  nincs csupasz `wait` — ha valaki később betesz egyet, az a zár alatt holtpontot okoz.
- A `land.sh` és a `hooks/pre-commit` a helyőrző-mechanizmust DOKUMENTÁLÓ fájlok (`PH_DOC_FILES`): hozzáadott
  soruk nem viselhet ADR-helyőrzőt (a kiosztás megáll) → ott a `scripts/land-lock.sh`-ra hivatkozom.
- Hibám: a fixture-takarításhoz egyszer `pkill -f` mintát használtam (a brief tiltja); csak a saját
  shellemet ölte meg. Innentől PID szerint.

## Nyitott
- A commit-kori zöld újrahasznosítása a sor mellett is elvész, ha előttünk bárki landolt (ADR szövege).

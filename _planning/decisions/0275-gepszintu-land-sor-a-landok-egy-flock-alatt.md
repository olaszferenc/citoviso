## ADR-0275 — Gépszintű land-sor: a landok egy `flock` alatt futnak, és nem futtatják újra egymás kapusorát (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29, a kapu-koordinátoron át — brief: `~/rc-briefs/land-sor.md`):** „Gépszintű land-sor”.
  Mérve: a `cit48c5979c` landja (a24d552e) 45 perc 15 s falióra, HÁROM kör (1145 s · 1020 s · 361 s):
  a push kétszer visszapattant, mert közben egy párhuzamos land mozgatta a main-t, és a `land.sh`
  minden visszapattanásnál fetch + rebase + a TELJES kapusort újrafuttatta („0 már zöld volt” — a
  rebase új fát ad). Csendes gépen egy kör ~6 perc; a veszteség a landok egymást-újrafuttatása.

**Döntés**

1. **A `land.sh` „fetch → rebase → ADR-kiosztás → kapuk → push → visszaellenőrzés → fő-fa ff + szerver-restart”
   szakasza EGY zár alatt fut** (`scripts/land-lock.sh`, a `land.sh` source-olja). A zárfájl
   `$(git rev-parse --git-common-dir)/cit-land.lock` — a fő fából és minden munkafából UGYANAZ.
   A zár a fetch ELŐTT szerződik: ami a várakozás alatt landolt, arra egyszer rebase-elünk.
   Elengedés a fő-fa frissítése után (két land nem ff-el/indít újra egyszerre); a vázlat-takarítás és
   a domain-inbox figyelmeztetés már zár nélkül fut. A commit-kori pre-commit NINCS a zár alatt.
2. **A zárat NEM a `land.sh` fd-je tartja, hanem egy `flock -o` folyamat**, aminek a parancsa csak a land
   PID-jét figyeli (1 s-os `kill -0`). Ok: egy `exec 9>…; flock 9` fd-t minden gyerek örököl (npx, tsx,
   Chromium) — egy PID szerint leölt land így az árva gyereke életéig mindenkit kizárna (mért csapda:
   egy Chromium-kapu 18 percig állt). Így a land bármilyen halála (akár `-9`) után ≤ ~1 s-mal felszabadul.
3. **Várakozáskor hangos:** az első várakozó pillanatban, aztán ~30 s-onként egy sor:
   `⏳ land-sor: VÁR — a zárat tartja: <munkafa> · PID <n> · <idő> óta · várakozás eddig <s> s`,
   megszerzéskor `🔒 land-sor: zár megszerezve (<s> s várakozás után) — <zárfájl>`.
4. **Nincs kikerülő kapcsoló.** Hiányzó `flock` / nem írható zárfájl = hangos `LAND: ELBUKOTT`.
5. **A push-visszapattanás ciklusa marad** védőhálónak (más gépről vagy kézzel pusholt main), változatlan szöveggel.
6. **Őr: `scripts/land-lock-check.mts`** (pre-commit, a `land.sh` / `land-lock.sh` / az őr változására; ~20 s):
   eldobható repó + worktree, a VALÓDI `land-lock.sh` kamu land-törzzsel — ① két land egyszerre sorosítva,
   közös zárfájl, a várakozó kiírja a zártartót; ② a zártartó `kill -9` (árva gyerekkel) → a várakozó ≤ 5 s
   alatt továbbmegy; ③ a `land.sh` szerkezete (source + feltétel nélküli acquire az első `git fetch` előtt,
   release az „IGAZOLTAN FENT” után, nincs kikerülő kapcsoló). Három visszarontás, mind piros: zár nélkül ·
   örökölt fd-s zár · `land_lock_acquire` kivéve a `land.sh`-ból.

**Mérlegelt, de NEM ebben döntve — a commit-kori zöld (ADR-0260) újrahasznosítása a sor mellett**

A kapu-futtató gyorsítótár-kulcsa: a mért fa + a kapuzott diff hash-e (+ argv, stdin, környezet), 2 órás TTL.
A land a commit-kori zöldet CSAK akkor használja újra, ha a zár megszerzése utáni fetch + rebase UGYANAZT a fát
és diffet adja, mint a commit — azaz ha (a) az ág egyetlen commit az origin/main tetején, (b) a commit óta
SENKI nem landolt (a rebase no-op), (c) nincs kiosztandó ADR-helyőrző (a kiosztás új fát ad — ADR-0227 ④),
(d) a commit óta < 2 óra telt el, (e) a commit pillanatában a munkafa = index volt. A sor ezt NEM javítja:
ha a várakozás alatt a sorban előttünk álló land lefutott, akkor a main — definíció szerint — mozdult, a
rebase új fát ad, és a teljes kapusor lefut. A sor azt nyeri, hogy ez EGYSZER fut (nem háromszor), és a
kapuk nem versengenek a gépi slotokért egy másik land kapusorával. Egy következő lépés lehetne a rebase
utáni diff tartalmi összevetése (ha a main mozgása a diffünk fájljait nem érinti) — ez a kapu-futtató
szála (`scripts/lib/gate-runner.mjs`), nem ez az ADR.

# 2026-08-21 — „A teszt hátrébb van, mint a prod": álló dev-szerver incidens + önjavító systemd-infra

## Kiváltó
A tulaj a lokál konzolon (:4600) nem látta a kinézet-kártyákat és csak 1-2 sablont — miközben a
prod frissebbnek tűnt. Jogos düh: „ennél alapabb hibát nem tudnék elképzelni".

## Diagnózis
- A git **rendben volt**: fő fa = main = worktree, 0 eltérés; minden friss munka a mainben ült.
- **Az ok:** a :4600 konzol-processz **aug 20. 12:37 óta** futott újraindítás nélkül; a `tsx`
  nem hot-reloadol → a felület a tegnap déli kódot szolgálta ki, **~30 committal** lemaradva
  (köztük: kinézet-kártyarács `7dbfcd6`, horizontal sablon `44a6d82`, a 16 sablonos készlet,
  duplikátum-ellenőrzés, digitális lábnyom, lead-kártya fixek).
- A :4800 publikus szerver ugyanebben a csapdában volt (2 commit lemaradás).
- Diagnosztikai recept jövőre: `ps -o lstart= -p <pid>` vs `git log -1 --format=%ci` —
  ha a processz öregebb az utolsó commitnál, a "hiányzó feature" valószínűleg staleness.

## Megoldás (repo-n KÍVÜLI infra — kód nem változott)
1. **`tsx watch`** mindkét szerverre (1. opció, tulaj-jóváhagyással) — fájlváltozásra auto-reload.
2. **systemd** (2. opció, tulaj kérte):
   - `/etc/systemd/system/citoviso-console.service` (:4600) és `citoviso-public.service` (:4800):
     `User=citoviso`, `WorkingDirectory=/home/citoviso/citoviso` (dotenv cwd-ből olvas),
     `ExecStart=node_modules/.bin/tsx watch …`, `Restart=always`, **`TimeoutStopSec=10`**
     (a tsx lomhán reagál a SIGTERM-re — e nélkül a restart 90 s-ig ragadt „deactivating"-ben),
     enabled → **reboot-álló**. Logok: `~/.claude/citoviso-{console,public}.log`.
   - **⭐ tsx-watch hamis-zöld lelet (a piros-teszt fogta):** `kill -9` a node-GYEREKRE → a tsx watch
     szülő életben marad (csak fájlváltozásra respawnol), a systemd „active"-ot mutat **halott port**
     mellett. A „guard must measure what matters" elv szerint a health-check ezért a PORTOT méri:
   - `/usr/local/bin/citoviso-health.sh` + `citoviso-health.{service,timer}` (percenként):
     curl a portra, HTTP 000 → `systemctl restart`. Log: `~/.claude/citoviso-health.log`.

## Piros-tesztek (mind élesben)
- Fájl-touch → `[tsx] change … Restarting…` → port él ✅
- `kill -9` a gyerekre → health-timer 18:20:14-kor észlelt → **18:20:29-re HTTP 200** (32 mp) ✅
- Restart-beragadás (90 s) → `TimeoutStopSec=10` után gyors ✅
- Reboot: mindhárom unit enabled (multi-user.target) ✅

## Mellék-lelet session-zárásnál
A fő fában egy **másik session teljes ADR-0045 tudásbázis-munkája commitolatlanul** ült
(38 fájl: `kb/` 9 entry + shotok, 0027 migráció, kb-check/kb-scan, tudasbazis-or agent,
DOMAIN §J, Súgó fül). Tételes fájllistával commitolva (`feat(kb)` — SOHA nem `git add .`),
minden pre-commit kapu zöld; majd rebase az origin 2 új commitjára (kinézet-kártya fix)
konfliktus nélkül.

## Tanulságok
- **Hosszan futó dev-szerver = néma staleness-csapda** — a „hiányzó feature" először processz-kor
  kérdés, nem kód-kérdés. (Külön csapda a statikus snapshot-propagálástól —
  lásd `reference_snapshot_rerender_propagation`.)
- **A supervisor zöldje nem a szolgáltatás zöldje** — a tsx watch „active" volt halott porttal.
  Port-szintű health-check kell, és az őrt pirosra kell tesztelni szándékos rontással.
- **Self-pkill csapda megint élesben:** `pkill -f "tsx src/…"` a saját parancssorra is illeszkedett
  (exit 144) — PID szerint ölj.

## Módosított/létrehozott fájlok
- Repo: `MEMORY.md`, `_planning/memory/2026-08-21_stale_dev_server_systemd.md` (ez a fájl);
  + a másik session KB-munkájának commitja (38 fájl, `feat(kb)`).
- Repo-n kívül: `/etc/systemd/system/citoviso-{console,public,health}.service`,
  `citoviso-health.timer`, `/usr/local/bin/citoviso-health.sh`.

## Nyitott kérdések
- Nincs. (A health-check jelenleg csak port-életet mér; ha egyszer kell, HTTP-tartalom-assert bővíthető.)

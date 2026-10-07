# 2026-10-07 — MMS-küldő: 4 hiba javítva (timeout, relay-éhezés, vezetékes, foglalt port)

SUB-szál a megkeresés-kiküldés koordinátorának (brief: `~/rc-briefs/mms-kuldo-javitas-20261007.md`).
Lokál + land; ÉLESRE és a rendszer-szintű telepítésre SEMMI nem ment ki (a koordinátor 16:00 után viszi).

## Mit javítottunk
1. **Timeout → álló gammu-smsd (09:00–09:18).** Az `mms-send` a repóba került: `deploy/mms-send/mms-send`
   (+ `install.sh`, dry-run/`--go`, visszamérés). SIGTERM/SIGHUP/SIGINT → SystemExit (a `finally` lefut),
   saját 170 s-os teljes plafon (SIGALRM), új próba csak ≥75 s maradékkal. Node `MMS_CLI_TIMEOUT_MS`
   180 → 200 s, `MMS_SEND_RESERVE_MS` = ugyanez, relay `budgetMs` 270 → 380 s, unit `TimeoutStartSec` 300 → 420.
2. **Relay-éhezés.** `withLaneLock` kapott `waitMs`-t; az MMS-relay ≤40 s-ig kivárja az SMS-relay pár
   mp-es zárját (nem dobja a ticket); a keret a tick elejétől számol. Az `mms-send` már nem állítja le /
   indítja újra a `citoviso-sms-relay.timer`-t (a sáv-zár védi), és CSAK azt indítja, ami futott
   (eddig a MineREAL `sms-relay.timer`-t akkor is elindította, ha le volt állítva).
3. **Vezetékes a mobil-párban.** `mobileOutreachGates`: `isHuMobileE164(to)` nélkül `no(...)` (pár és
   hideg SMS). A 2517 „Unresolvable recipient” a sorban (`isPermanentRefusal`) az első válasz után
   `failed` + riasztás — szerver-oldal, a NAGY DEPLOY-jal él.
4. **Foglalt port.** A gammu-smsd leállítása után /proc-szkennel megvárja, hogy senki ne fogja a portot
   (≤20 s), majd AT-próba backoff-fal (4×), csak utána nyit.

## Tesztek
`mms-relay-check` ⑳ (zár-várás, 2517, vezetékes-kapu, timeout-sorrend, `mms-send --selftest`),
+ `send-window-tz`, `pair-repair`, `owner-test-phone`, `shared-contact-gate`, `systemd-units` zöld.

## Nyitott
- Rendszer-szintű telepítés (koordinátor, 16:00 után): `sudo bash deploy/mms-send/install.sh --go`;
  `sudo cp deploy/systemd/citoviso-mms-relay.service /etc/systemd/system/ && sudo systemctl daemon-reload`.
- A `mobileOutreachGates` és a 2517-szabály a szerveren él → csak a nagy deployjal hat élesen.
- A külföldi mobilszám is kiesik a párból (a brief: csak magyar mobil) — ha kell, tulaj dönt.

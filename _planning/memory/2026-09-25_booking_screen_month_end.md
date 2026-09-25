# 2026-09-25 — booking-screen-check: a hónap-végi piros negyedszer, és ezúttal a szabály cserélődött

**Kiváltó:** a két kapusor-szál (várakozósor · író-audit) mérése közben a `booking-screen-check`
pirosra ment az `origin/main`-en (8fefaf00), egyedül futtatva is: „a szobánál csíkos mind a három
zárt nap — kapott: 2”. A tulaj: „javítsd”.

## Mérés (fagyasztott óra, `KB_FROZEN_NOW` + `scripts/lib/frozen-clock.mjs`)
| nap | javítás előtt | után |
|---|---|---|
| 09-15, 09-24 | zöld | zöld |
| **09-25, 09-26** | **piros** (3 ill. 5 sértés) | zöld |
| 09-27, 09-30, 10-01 | zöld (5 állítás KIHAGYVA) | zöld, kihagyás nélkül |
| szept. 24–30, okt. 1–31, febr. 26–28 (2027), dec. 31 | — | **41/41 zöld**, 0 piros, 0 kihagyás (hónapváltás: 10-23-tól nov. 1–3 + 6; febr. végéről márc. elejére) |

## A mechanizmus
A fixtúra a mai naptól +4…+9 napra tette a foglalást és a kézi blokkot. 25–26-án a foglalás még
szeptember, a kézi blokk már október; a „KIHAGYVA” ág csak KIÍRTA a kihagyást (3 állítást
tényleg kihagyott), de a szoba-naptár ⑥ állítása lefutott és 2-t kapott. Az őr saját kommentje
három korábbi javítást sorol (09-22, 09-24 ×2) — mind a NAPOKAT tologatta a mostani hónapon belül.
A premissza volt rossz: „a naptárnak nincs hónap-váltója” — VAN (`ho=`, ‹ ›), és az őr eddig is
a `from` hónapjára nyitotta mindkét naptárt.

## A javítás
`fixtureWindow()`: ha +4…+9 egy hónapba fér, marad; ha nem, a KÖVETKEZŐ hónap 1–3. + 6. napja.
A naptár arra a hónapra nyílik. Nincs kihagyó ág — minden állítás minden napon fut; egy
belső őr dob, ha a fixtúra mégsem egy hónapba esne. A napok sorrendje (vendég-éjszakák, majd a
kézi blokk) változatlan, mert a „első csíkos cella = vendég” állítás erre épül.

## Tanulság (memóriába is)
„KIHAGYVA” kiírás ≠ kihagyás — másodszor bukott el ugyanez (feedback_fragment_jump_steals_focus);
és három egymást követő „számtan-javítás” után a SZABÁLYT kell megkérdőjelezni, nem a negyedik
eltolást megírni.

## ⛔ Iker-javítás (harmadszor a projektben)
A `351a8a6c` („Árak → Szobák gomb” szál) UGYANEZT a hibát javította velem párhuzamosan, ötödikként —
a ⑥ állítást gyengítve (kilógó blokknál 2-t várt). A két javítás szöveg-ütközés nélkül olvadt
össze, és a maradvány `manualInMonth` hivatkozás ReferenceErrorral omlott össze a land-kapun.
Az enyém felülírja: a blokk mindig a mutatott hónapban van, a ⑥ mindig 3-at vár. Tanulság újra
(feedback_two_threads_did_the_same_work): egy mainen piros kapu MÁGNES — aki beleütközik, javítja;
a szülő-értesítő a két saját szálamhoz eljutott, a harmadikhoz nem.

## Melléklelet ugyanebből a körből
A `room-editor-check` negatív kontrollja a 220 ms-os opacity-átmenet KÖZEPÉN olvasott (0,554) — egy
harmadik session (`cfc4e5db`) ugyanezt mérte és javította, függetlenül.

## Fájlok
- `scripts/booking-screen-check.mts`
- `_planning/memory/2026-09-25_booking_screen_month_end.md`, `MEMORY.md`, `_planning/memory/INDEX.md`

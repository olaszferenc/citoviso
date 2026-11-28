# 2026-11-28 — Mennyiség az új gépen (citoviso-2, 8 vCPU) + eszkalációs utánkövető elutasítóra

SUB `citf2359c67`, koordinátor `cit96bd8170-14`. Élesen csak olvasás (diagnosztika).

## Mérve (éles, 2026-11-28 19:00 UTC, új gép: load 1,7, RAM 21/24 GB szabad)
- Jóváhagyó lap: **380** kész ajánlat (HU 357, HR 23); kiküldési sor (tulaj-igen után): 20. A hétfő 8:00-ás 100-as HU-kerethez a lap elég — a szűk keresztmetszet a tulaj jóváhagyása (automata jóváhagyás tilos).
- A 877 e-mailes lánc-sorból: 380 kész (mindkét terv pass, approved) · 19 queued · **334 fotószabályon ragad: kevés saját képes településlap, a településkép választás-bélyeg nélküli** (régi egyszeri Wikipédia-keresés; 422 várakozó településlapon nincs pick) · 133 régi generátoros · néhány saját-kép/mock-kép eltérés.
- A frissítő és a kapu tétlen volt (0 aktuális, ítélet nélküli terv), a lánc-utánpótlás mégis „szünetel — a kapu sora 297”: a fék a fotószabályon bukott sorokat is számolta.
## Szabályok (landolva)
- `gateWorkBacklog` csak a valódi munkát számolja (frissítés vagy fotószabályon átmenő, ítélet nélküli aktuális terv).
- `TOWN_PICK_STALE_SQL` + `refreshMock`: az elavult településkép-választású lap frissül, a település mai készletéből (townHero.townPhotosForMock) új képet kap; készlet híján 24 óra múlva újra próbálja (`townRepickAt`). Scratch: 3/3 átment a fotószabályon (előtte soha), a kapun 1 pass, 2 szöveg-ismétlés.
- `escalationFollowup.leadRejected`: az utánkövető kihagyja az elutasítót (bármely prospect leiratkozása, vagy Poe „elutasító / nem érintett” minősítése a javaslat indoklásának első sorában); őr: escalation-config-check ⑨c.

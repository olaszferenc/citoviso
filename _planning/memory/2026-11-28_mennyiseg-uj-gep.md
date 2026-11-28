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

## A nyitókép-cím kiemelt sora (minőségi kolléga 11-28 12:47: Horizont, Káma, Napfény)
A kapu a h1 `<em>` sorát a mögötte lévő képhez méri: a betűk egy pillanatra átlátszók, árnyék nélkül, a háttér világosabb negyede (75. percentilis), 3:1. Bukáskor a fehér és a sötét tartalék közül a jobban olvashatót írja elő (`fix`), az újrapróba azzal rendereli (`siteData.heroAccentTone` → Parallax `.t-em-light/.t-em-dark`). Kép- és sablonváltás nincs, bélyeg- és kapu-verzió-emelés sincs (csak új / újrarenderelt tervre). Mellékesen: a kapu a `color-mix()` színét („color(srgb …)”) nem olvasta, a kiemelést mérés nélkül engedte → `cssRgb`. Mérve: Horizont 2,36 · Napfény 2,80 bukik, fehérrel átmegy; Káma mobilon 4,07 (rendben); vak 24 új Parallax: 2 találat (Agria Retúr, Viola), szemmel mindkettő valódi, 0 téves.

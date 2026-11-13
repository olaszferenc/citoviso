## ADR-XXXX — Gyorsított órás gépi látogatás (levélszűrő) nem megnyitás

**Dátum:** 2026-11-13 · **Döntött:** session (tulaj jelzése: „szerintem valami nem ok a méréssel, túl gyors a megnyitás, kvázi nincs különbség 2 megnyitás között”, brief `megkeres-s-m-r-s-20261113-100519.md`)

**Kontextus.** Élesen (Prefa Rolling Cabin, 11-13): a levél 10:01:35-kor ment ki, 10:02:11 és 10:03:08 között 3 „látogatás” jött asztali Windows Chrome-ból. A 15 mp-es olvasás-ütem ~1,8 mp-enként érkezett: „225 mp olvasás” 26 mp alatt, a 2. és a 3. látogatás egymásba lóg, a görgetés 25/50/75% 150 ms alatt. Egy levélszűrő futtatta az oldalt egy homokozóban, virtuális idővel. A UA rendes böngésző, és a JS lefutott, ezért az ADR-0291 „emberi jel” kapuja átengedte. Mérve 60 napra: 10 ilyen látogatás, mind asztali Windows Chrome/Edge. Az emberi látogatásnál a bejelentett és a valós eltelt idő közti csúszás ÁLLANDÓ (max. 28,7 mp, lassú mobilháló), a gépnél ütemenként ~8×-os ütemben NŐ. Mellékhatás: 11-04-én egy ilyen látogatás −30%-os „2. látogatás” eszkalációs ajánlatot adott ki (és élesítette az emlékeztető levelét) egy olyan leadnek, aki nem nézte meg az oldalt.

**Döntés.**
1. Szabály (`src/analytics/fastClock.ts`): ha egy dwell/dwell_end esemény bejelentett másodperce ≥ 40 mp-cel ÉS ≥ 3×-osan meghaladja a látogatás kezdete óta a szerveren eltelt időt, akkor a látogatás gépi.
2. A `recordEvent` ilyenkor `device='bot'`-ra állítja a látogatást (`markViewAsMachine`). Az 'opened' visszaáll 'sent'-re, ha nem maradt emberi látogatás, és a látogatás által kiadott, fel nem használt eszkalációs ajánlat lejár. A gépi látogatás kattintása nem lépteti a státuszt.
3. Bot-látogatás nem számít az eszkalációs ajánlat látogatásszámába, a lead-oldal „{n} megnyitás”-ába és a funnelbe sem. A Riport, a viselkedés-üzenet és a nem-nyitó levél eddig is kizárta.
4. A Tevékenység-lap a gépi látogatást láthatóan, jelölve mutatja („gépi megnyitás (levélszűrő) — nem ember, nem számít”), külön sorban számolja, és az összesítőben nem veszi figyelembe.
5. Visszamenőleg: `scripts/fast-clock-backfill.mts` (alapból száraz futás, `--go`). Őr: `scripts/fast-clock-check.mts` (pre-commit).

**Visszafordíthatóság:** 🔄. A küszöbök két konstansban vannak. A jelölés visszaállítható, mert az `os`/`browser` megmarad, és a gépi sorokat az különbözteti meg a UA-botoktól.

**Elvetett alternatíva:** kliensoldali felismerés (a `performance.now()` és a `Date.now()` is a virtuális órát mutatja, ezért nem árulkodik). A sima „X mp-en belüli ismételt megnyitás = bot” szabályt is elvetettük, mert az emberi újranyitást is lenyelné.

**Nyitott:** egy 11-04-i Edge-látogatás (15 mp 1,8 mp alatt, 13 mp csúszás) a küszöb alatt maradt. Egyetlen ütemből nem dönthető el, hogy gépi-e.

**Státusz:** kód kész; élesítés és a visszamenőleges futtatás külön tulaj-engedéllyel.

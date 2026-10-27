# 2026-10-27 — Kiküldő szál: 150-es keret, folyamatos küldés, 14 nap ingyen, három élesítés

Session: cit75f909e8 (diszpécser / deploy / éles üzem). Koordinátor: cita291565c, generátor-SUB: cita3d7c954, -bb: cit4ed62754.

## Elvégzett munka
- Napi keret 40 → 150 (tulaj), 14:53-tól ma 16:00-ig keret nélkül (tulaj „Mehet tovább 16:00ig”), zárásnál vissza 150-re (a 16:05-ös cron a túlterhelés miatt elbukott, kézzel pótolva). Ma 361 megkeresés ment ki.
- A kiküldő tick egymás után küldi a jóváhagyott sort a plafonig (max 8 perc/futás) — `scripts/outreach-dispatch.mts`, ADR-0405 átírva (tulaj: „ha van jóváhagyott lead, menjen”). Deployig `/root/dispatch-drain.sh` pótolta.
- Első megkeresésbe „14 nap ingyen” (tulaj jóváhagyta a szöveget): levél „Mielőtt döntene, {N} napig ingyen kipróbálhatja, kötelezettség nélkül.”; SMS egy mondatban, „élőben” nélkül. Megvalósította a generátor-SUB.
- Élesítések: 34ab1322 (12:57, az Árazás-szál), **1ef70a4c** (15:00 — 14 nap, folyamatos küldés, csillag-szűrő, i0.wp.com, BBB, szobakártya, Panoráma-környék), **8658ed58** (17:19 — csak telefonos lead újrafutása nem ír üres SET-et; hibája: „syntax error at or near where”, 11+ dispatch held).
- Deploy utáni rerender: a -bb 186-os listája (0 hiba), majd `--resample` mind az ~1850 nem elutasított mockra.
- Kézi adatjavítások mentéssel (`/opt/citoviso/backups/…-20261027-*`): Panoráma Faház (név, „****”, hrsz-cím), Ricky (település), Léna, Kikötő, Kereki (cím + SEO-alt), ÉletVirága, Zsálya, Vali (alt).
- Held-feldolgozás (koordinátor döntése): A 11 (Vera-PASS rögzítve a 2. tervre), B 25 (same_owner), Silent Forest, MISA, Tamás Bátyó, Flóra, Black Brothers újra sorban; Keselyűsi + Orfűi KIESETT.
- 16:10 az éles gép kifogyott a memóriából (két párhuzamos resample + kézi jobok + scout). Leállítva; `/root/rs-safe.sh` egyszálas, nice 19, MemAvailable > 800 MB kapuval; **2 G swap** felvéve (tulaj OK).
- Tulaj-döntés: robots.txt az RFC 9309 szerint (4xx a 429 kivételével = szabad) — a generátor-SUB írja, külön commit.

## Módosított fájlok
- `scripts/outreach-dispatch.mts`, `_planning/decisions/0405-*.md`, `src/console/data.ts`, `MEMORY.md`
- gépen: `~/rc-briefs/watch/sorba.sh` (nice 19), `~/rc-briefs/watch/cap-vissza-150.sh` (lefutott); élesen: `/root/rs-safe.sh`, `/tmp/rec-review.mts`, `/tmp/set-photo-alt.mts`, `/swapfile`

## Nyitott / következő lépés
- Következő deploy-jelölt: origin/main bbf211c4 (+784e8d65; szobakártya bedroom-jel a friss generálásnál, AVIF→JPEG, szigorú kártyakép, Diviák, SEO-alt szűrő, dispatch-prioritás ADR-0409) + a robots-commit, amint landol. Tulaj-engedély kell.
- Utána: `--resample` a 14:00 UTC után generált mockokra (a `/root/rs-safe.sh` listáján már rajta vannak, de a javított kóddal újra kell), sima rerender a SEO-altos 24 mockra, `--rehero` az Ametisztre és a 36 > 20 képes „error” mockra (~$0,5, csak ki nem küldött linken), Diviák + Apartman Éva link-behúzás.
- Held: Oázis 7189665e, Belvárosi 5c01e332, Party 27f36367 (kártyakép) → resample után Vera2, ha PASS: requeue. Ametiszt, Abi-Lo, Sárgarózsa TARTVA a következő deployig.
- A `/root/rs-safe.sh` éjjel tovább fut (500/1691 volt zárásnál), folytatható.

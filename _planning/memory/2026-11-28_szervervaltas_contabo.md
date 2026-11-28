# 2026-11-28 — Szerverváltás: az éles Hetznerről (CX23) a Contabo citoviso-2-re

Session: `citde414ad3` (önálló fő session, brief `~/rc-briefs/szamitasi-szerver-20261127.md`).

## Döntések (tulaj)
- 11-27: **nincs szétválasztás** (frontend + számítási gép), hanem az egész éles egy nagyobb gépre költözik — ugyanannyi pénz, fejlesztés nélkül; a Hetzner nagyobb gépe nem rendelhető.
- 11-27: **Contabo Cloud VPS 8 NVMe** (8 vCPU AMD EPYC / 23 GB / 150 GB NVMe, Hub Europe, Debian 13, €15,50 + 27% ÁFA/hó, 24 hónap; customer 15747322, order 15747323), a tulaj rendelte.
- 11-28: „Most kezdjük az átállást” (~19:05), előtte főpróba.

## Mérések
- **Régi gép, 24 óra** (11-27 08:24 → 11-28 08:22, 1165 perc): foglalt mag átl. 1,68/2, CPU-PSI p50 64% / p90 87%, load max 63, szabad RAM min 0,25 GB, swap 1,89/2 GB. CPU-rész: kiküldő tick 32%, postgres 11%, ssh-s scrape 10%, chain-supply 8%, konzol 2,5%, public 0,2%.
- **Főpróba (B1–B9)**: napi fájlkülönbség 160 s, DB-mentés 49 s, visszatöltés 13 s; Google Maps 20/20 captcha nélkül az új IP-ről; render-kapu 8 párhuzamos folyamattal ~6 s/mock (élesen ~22 s); egy mag ~3× gyorsabb.
- **Átállás**: végső DB-mentés 26 s, visszatöltés + ANALYZE 11 s, a 8 legnagyobb tábla sorszáma egyezik; végső fájlmásolás 7 s, második száraz futás 0 eltérés, 20/20 mock md5 egyezik; kiesés ~19:10–19:50.
- **Új gép az első órában**: foglalt mag 1,66/8, CPU-PSI p50 2%, szabad RAM ~20 GB, swap 0, nginx 5xx 0/546.

## Elvégezve
- Új gép előkészítése: azonos csomagverziók, `citoviso` uid 999/gid 989, `/opt/citoviso`, nginx, letsencrypt, 30 unit, nftables (be: 22/80/443), PG tuning, 2G swap, journald 500M, root `.gitconfig` safe.directory.
- Átállás a tesztterv szerint (`~/rc-briefs/szamitasi-szerver/atallas-tesztterv.md`, `atallas-forgatokonyv.md`): régi gépen minden szolgáltatás, időzítő és a postgres leállítva + disable; DNS (Cloudflare `citoviso.com` + `*`; regisztrátor citoviso.hu, dunavibehouse.hu, overseer.hu, getcitoviso.com `@`+`www`) → 77.216.131.165 (`dns-switch.mts`).
- IP-csere: repó `04374afe` (deploy-prod.sh, backup-pull.sh, kb-freshness.mts, town-photo-gather.mts, CLAUDE.md §5, DEPLOY-READY.md); dev gép 55 szkript (`.bak-atallas-20261128` mentéssel); `~/.ssh/config` `citoprod` alias.
- Utótesztek: minden host kívülről 200/301/302, worker, 13 időzítő, `certbot renew --dry-run` 4/4, mentés-letöltés, deploy-prod.sh dry-run, 3 [TESZT] levél (a hideg sáv a citoviso@gmail.com-ban SPAM-be ment — a DKIM-kulcs/selector változatlan, a küldő IP a Websupporté; a fejléc-ellenőrzés nyitott).
- Entitások (tulaj kérése): MR, OLZ, OF saját kulccsal belép (`ssh citoprod`, `~/.ssh/id_ed25519_citoprod`), memóriájukba `reference_citoviso_prod_server.md`.
- Mellékszál: az „A” Claude-fiók végső belépési lejárata (11-28 12:16) MR/OF/OLZ-t leállította → `/login` az MR-en a tulaj linkjével, fanout; következő végső lejárat **2026-12-27 18:53**.

## Módosított / létrehozott fájlok
- Repó: `MEMORY.md`, `CLAUDE.md`, `_planning/DEPLOY-READY.md`, `scripts/backup-pull.sh`, `scripts/deploy-prod.sh`, `scripts/kb-freshness.mts`, `scripts/town-photo-gather.mts`, ez a jegyzet.
- Repón kívül: `~/rc-briefs/szamitasi-szerver/` (sampler.py, run-sample.sh, report.py, terv.md, atallas-forgatokonyv.md, atallas-tesztterv.md, ip-refs*.txt, repo-ip.patch, dns-switch.mts, ws-probe.mts, maps-probe.mjs, console-probe.mjs, mail-test.mts, reference_citoviso_prod_server.md, crontab-mentések), `~/.config/citoviso/contabo-vps.txt`, `~/.ssh/citoviso_contabo`.

## Nyitott / következő
- **Hétfő 11-30 8:00**: az első hétköznapi kiküldési ablak — az első levelek kézbesítését figyelni (production-koordinátor).
- **11-29 este után**: ha minden zöld, a Hetzner CX23 felmondása (tulaj); addig tartalék, leállítva (visszaút: DNS vissza + `systemctl start`).
- A hideg-sávos [TESZT] levél spam-oka: a Gmail „Eredeti megjelenítése” SPF/DKIM/DMARC sora.
- Az új gépen fut a terhelés-mintavevő (dev crontab „szamitasi-szerver meres UJ GEP”) — 11-29 után a sort törölni; összesítő `python3 ~/rc-briefs/szamitasi-szerver/report.py 24`.
- A dev szkriptek `.bak-atallas-20261128` mentései egy hét után törölhetők.
- 2026-12-27 18:53 előtt újra `/login` az MR-en (A fiók).

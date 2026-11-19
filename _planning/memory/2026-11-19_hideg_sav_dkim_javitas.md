# 2026-11-19 — Hideg sáv: miért nem nyitják a megkereséseket — DKIM-javítás (cit327a964e)

**Brief:** `~/rc-briefs/email-megnyit-s-20261119-135936.md` (165 levél, 9 megnyitás, a korábbi arány ötöde).

## Mérés (éles DB, csak olvasás)
- Gmail-nézés a küldés után 3 órán belül, csak a legalább 3 órás küldések: 11-09…11-16 18–22%, 11-18 5%, **11-19 6% (5/80)**.
  A nem-Gmail címek a jó időszakban is 2–5% → a teljes arányt a Gmail viszi.
- 11-19: 75 újraküldés (régi spames Gmail-címzett) 5 nézés, 66 friss Gmail 4 nézés, 24 egyéb 0 → nem a lista az ok.
- 9 megnyitásból területi bontás nem értelmezhető.

## Gyökérok
- A getcitoviso.com levelei **DKIM-aláírás nélkül** mentek ki: a kézbesítési jelentések (DSN) eredeti fejlécében nincs `DKIM-Signature`.
- Ok: `nodemailer.createTransport({ url, dkim })` — url esetén a nodemailer 9.x a teljes objektumot a parse-olt URL-re
  cseréli, a `dkim` elvész. Javítás: `createTransport(url, { dkim })` (üzenet-alapértelmezés).
- A DMARC így csak SPF-fel ment át; a Gmail a domain helyett a tárhely közös kiküldő IP-jének hírnevén ítélt, egynapos domainen.

## Kizárva
- Tiltólista: a kiküldő IP (45.13.137.47) és a domain tiszta. A Gmail nem utasított el (csak 5× 5.1.1 nem létező cím).
- A levél mérete (553 KB, inline hero-PNG) a jó időszakban is ilyen volt.

## Mellékes
- A BCC-másolatot (olasz.ferenc@citoviso.com, Zoho) a Zoho greylisteli: 11-19-én 52 visszapattant, 8 ment át.

## Élesítés
- Main: `845a62f8` (fix) + `bf46c027` (`-s ours` merge a `hotfix/dkim-20261119`-ről). Éles: `b42012fe` = `8c7f190e` + fix,
  `prod/20261119-1425`, tulaj „land után mehet élesre”. Élesben próba (helyi csapda, valódi kulcs, DNS-kulccsal ellenőrizve):
  header-sig VALID, body-hash VALID.
- Tanulság: a `land.sh` rebase-e a `-s ours` merge-et kisimítja (a hotfix nem kerül a mainre, és a cherry-pick kontextusa
  egy duplikált MEMORY-sort hozott be) → a hotfix-merge-et közvetlen ff-pusht-tal, `merge-base --is-ancestor` igazolással kell feltenni.

## Módosított fájlok
- `src/email/sender.ts`, `MEMORY.md`, `_planning/memory/2026-11-19_hideg_sav_dkim_javitas.md`

## Nyitott
1. 11-20 reggel: javul-e a Gmail-nézés az aláírt levelekkel (azonos 3 órás ablakkal).
2. Lassabb felfutás megfontolása (a domain 11-18-i).
3. BCC-másolat greylisting a Zohónál.

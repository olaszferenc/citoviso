# 2026-11-27 — HR honlap nélküli leadek elérhetősége: jegyzék-forrás + döntő honlap-ítélet (SUB `cit2031c8a8`)

Koordinátor `cit9b4690e3`, brief `~/rc-briefs/hr-honlapnelkuli-email-20261127.md`, döntés: ADR-0502 (jegyzék + v2).

## Elvégezve
- Diagnózis (éles, olvasva): a 850 GYANUS = böngészős NINCS lefokozva (Brave 402 óta); a 961 ellenőrizetlen friss lead, az átfutás a szűk keresztmetszet (Startpage-tiltás, közös IP a tömeges kontaktgyűjtővel).
- Forrás-mérés: portál-hirdetés 0 e-mail, OSM 15 lead, TZ-listák 17 iroda (~2000 cím) → `kontakt/jegyzek.py` + `jegyzek.sh` (lánc 0j lépés), lexikon `chainKontaktDirectories`.
- Vak kör 229 leaden: 16/21 helyes → 3 új szabály (kártya-fej, menü-település, telefon-ütközés) → 10/10. 2. vak kör: `kontakt/vak-jegyzek.sh <időpont>` az új leadekre.
- Honlap v2 (`honlapcheck/web_check.py`): domain-alapú VAN, telefonos 2. keresés, döntött ítélet; igazság-minta fut (`kereso/minta2`, kapu `gate.txt`).

## Fájlok
- repó: `src/countryLexicon/hr.json`, `src/countryLexicon/hu.json`, `_planning/decisions/XXXX-honlap-nelkuli-lead-elerhetosege-jegyzek-es-dontott-honlap-itelet.md`, `MEMORY.md`
- lánc (`~/rc-briefs/uj-lanc-hr`, git): `kontakt/jegyzek.py`, `kontakt/jegyzek.sh`, `kontakt/vak-jegyzek.sh`, `lanc.sh`, `honlapcheck/{web_check.py,classify.py,kor.sh,hc-cand.sql}`, `atallas-jegyzek.sh`

## Nyitott
- `atallas-jegyzek.sh go jegyzek` — a koordinátor futtatja; `go honlap` csak `gate.txt` „KAPU: ÁTMENT” után.
- Telefon nélküli leadek (a no_site ~40%-a) telefonja az apartmanija-hirdetésből → több telefonos jegyzék-egyezés (nem készült el).
- HR leadek magyar településnévvel (Verőce, Szentgyörgyvár, Kamarcsa) — a felderítés hu-locale-ja, nem javítva.

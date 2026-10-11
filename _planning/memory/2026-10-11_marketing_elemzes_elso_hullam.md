# 2026-10-11 — Marketing-elemzés: az első megkeresési hullám (177 link, 0 rendelés)

**Kérés (brief `~/rc-briefs/eddigi-rt-kel-s-20261010-214540.md`):** átfogó marketing-elemzés az eddig kiküldött leadekről, lehetőség/hiba elemzéssel.
**Kimenet:** Artifact-riport — https://claude.ai/artifact/SHT95LinYrdgMCsSf8Z7jH (privát). Kód nem változott, élesen semmi nem íródott.

## Módszer
- Éles gépen, olvasási módban a `getReportData(0, dim)` minden dimenzióra (ideiglenes szkript `/tmp`-ben, futás után törölve), `sudo -u citoviso` a peer-auth miatt; a stdout 64 KB-nál csonkol `process.exit` mellett → fájlba írni, utána `cat`.
- Közvetlen SQL: `outreach_reply` (+`_send`), `mms_outbox`, `lead.raw` (city/region/material/contactChannel/websiteStatus), `pricing_config`.

## Fő számok
- 177 kiküldés (10-04–10-08) → 62 megnyitás (35%) → 42 ≥50% görgetés → 30 visszatérő (11 háromszor+) → 6 panel-megnyitás (5 lead) → 1 domain-lépés (Melinda) → 0 rendelés; 0 leiratkozás.
- Megnyitás: medián 59 perc a kiküldéstől, p90 17 óra; 79% mobil; idő a lapon medián 45 mp.
- Kilépés: 30/62 a térképnél (lap alja), 16 a szolgáltatásoknál.
- Csatorna: e-mail+SMS+MMS 44%, SMS+MMS 22%, csak e-mail 17%. Szegmens: nincs honlap 38%, elavult 28%. Kedd/szerda 9 óra a legjobb.
- Panelben: Körtefa 4× csomagleírás, Mangolia teljes/ajánlott leírás, Sétány éves díjra váltott, Vörös-Cser semmi; csomagot senki nem váltott. ⚠️ A `section_seen: pricing` a szállás SAJÁT áraival kitöltött blokk, NEM a mi havidíjunk.
- Válaszok: Melinda (árat kérdezett, „megválaszolt” jelölés küldés nélkül), Gemini (más iparág), Krisztina + Villa Eszter (rossz címzett), Marana Tha (elutasítás).
- MMS: 154 leadnek, 11 „Unresolvable recipient” (vezetékes); 141 lead nélküli MMS a tulaj-másolat (10-08-án kikapcsolva). 10-09 óta nincs új kiküldés.

## Nyitott kérdések / következő lépés
- Melinda Apartman: kapott-e konkrét havi összeget (ha nem, ő a legforróbb lead).
- Lap alji döntési blokk (egy összeg + „nincs más költség” + fő gomb + „Kérdésem van”) — §2b terv-kapu, tulaj-döntésre.
- Próba-kampány (ADR-0348) sorrendje az elköteleződés szerint: 30 visszatérő → többi megnyitó → nem megnyitók.
- Kontakt-ellenőrzés kiküldés előtt (vezetékes szűrés az MMS-ből, portál-kontakt egyeztetése a névvel).
- Nincs ellenőrizve: kiírja-e a lebegő „Itt rendelheti meg” gomb a havidíjat.

## ADR-XXXX — Ország-réteg 3/4: a CRM és a kommunikáció a lead országának telefon-rendjén, nyelvén, időzónáján és ünnepnapjain fut

**Státusz:** ELFOGADVA (tulaj 2026-11-16, „Mehet a CRM”; brief `orszag-reteg-3d-crm-20261116.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437 (ország-réteg), ADR-0450 (`normalizePhoneIn`, CZ/PL trönk), ADR-0454 (riportok), ADR-0340 (válasz-javaslat), ADR-0421 (partner-szál), ADR-0419 (Vera négy szabálya) ·
**Forrás:** `_planning/RESEARCH-2026-11-12-orszag-reteg-potlo-diagnosztika.md` 4. szakasz.

### Kiváltó

A leadkezelés magyar-kötött volt: az ikerszűrő névkulcsa csak `[a-z0-9]`-et tartott meg, így minden cirill/görög
név üres lett, és a 250 m-en belüli (vagy koordináta nélküli) leadek EGY leaddé olvadtak; a bejövő válasz, a
partner-szál és a telefon-ikerkapu a magyar `normalizePhone`-nal olvasta a számot, ezért a nemzeti alakban tárolt
külföldi számhoz érkező válasz elveszett; Poe, Vera és Neo magyar nyelvet, magyar mobilt, magyar portált, `.hu`-t
és budapesti időt feltételezett (egy külföldi lead Veránál mindig TARTVA maradt); a partner csendes órái és a
válasz-küldés ablaka budapesti idő szerint futott.

### Döntés

① **Ikerszűrő** (`scraper/dedupe.ts`): a névkulcs NFKD + ékezet-levétel, minden írásrendszer betűje és számjegye
marad; üres kulcs SOHA nem egyezik. A latin és a cirill/görög írású azonos név NEM olvad össze (két írás nem
bizonyíték); az új lead `scriptTwinOf`-ot kap a 250 m-en belüli tárolt párja nevével (jelölés, nem összevonás).
Mérve a dev DB-n (7393 lead): 1 kulcs változott (egy kínai írásjeles név), csoport-változás 0.

② **Telefon a lead országában:** a válasz-párosító (`replies/store.ts`) minden megkeresett kontaktot a SAJÁT
országa szabályaival olvas (`normalizePhoneIn`), és a feladót is azzal: a nemzeti és a `+CC` alak egyaránt
párosul; a partner-szál (`console/partnerMessages.ts`) a partner/lead országában (címzettek, bejövő üzenet); a
telefon-ikerkapu (`outreach/autoDispatch.ts`, `sharedContactGate.ts`) a nem magyar tervű ország számát előbb
E.164-re olvassa, a magyar terv és a sor nélküli lead a régi `phoneKey`-t kapja (HU bitre azonos).

③ **Idézett előzmény** (`replies/quoteMarkers.ts`): a levelezők idézet-jelölői nyelvenként ADATKÉNT (en, hu, de,
hr, sl, sk, cs, pl, it, ro, bg, sr, mk, el, fr, es); a `stripQuoted` ebből építi a mintáit, nyelvenkénti `if` nincs.

④ **Válasz nyelve:** `outreach_reply.lang` (0139, additív) = a lead nyelve (mockja, különben országa) a
beérkezéskor; ismeretlen ország = NULL (nincs HU-fallback).

⑤ **Poe:** a jegy (`scripts/replies-collect.mts`) nem magyar beszélgetésnél „Nyelv:” sort kap, az aláírás a
lead nyelvén (`T(lang, "A Citoviso csapata")`, Bábel-csomagból; hiányában magyar forrás, amíg Bábel le nem
fordítja); ismeretlen országnál Poe nem ír javaslatot. A válasz-küldés ablaka (`replies/answer.ts`,
`crm/countryClock.ts`) a LEAD zónájában, munkanapjain (hétköznap, `country.public_holidays` nélkül) — az ablak
órái változatlanok (`MOCK_OUTREACH_WINDOW`). Ismeretlen ország = a válasz nem ütemezhető. A tulaj-jóváhagyás
változatlan (Poe javasol, az operátor küld).

⑥ **Vera / Neo charter:** a mobil-előtag, a hívószám, a helyi portálok és a saját-honlap TLD-k a lead országának
sorából; egy külföldi lead nem TARTVA azért, mert nem magyar. Eszköz: `npx tsx scripts/lead-country.mts
--country <ISO>` (csak olvas); kód-oldali ítélet: `crm/leadContact.ts leadPhoneVerdict`.

⑦ **Jóváhagyási sor** (`console/approvalQueue.ts`): minden tétel hordozza a lead országát; ország-chip és a
sorban ország-kód CSAK többországos sornál — a csak-magyar sor a mai lap (a meglévő chip-minta kiterjesztése).

⑧ **Partner csendes órák:** 22–07 a partner zónájában (tenant → `tenant.time_zone`, különben a partner
országának sora; egyik sem → a cég zónája).

⑨ **Prospect-visszajelzés:** hiányzó nyelv → a lead országának nyelve; ismeretlen ország → nincs lap (404 / a
leiratkozás áll, a válasz „OK”).

⑩ **Ünnepnapok:** `country.public_holidays` (0139, additív): „MM-DD” (minden évben) vagy „YYYY-MM-DD” (egyszer).
A HU-sor a mai listát kapja, ami ÜRES (a tulaj szabálya: csak hétvége) — a magyar ablak bitre azonos.

### Ami NEM változott

A HU-működés: ikerszűrés (mérve), válasz-párosítás, Poe magyar jegye és ablaka (az őr két hétnyi, DST-váltáson
átívelő 20 perces söpréssel méri a régi budapesti ablakkal és csendes órával az egyezést), Vera/Neo magyar
szabályai. Az operátori riasztások csendes órája (a tulaj telefonja) budapesti marad. A kiküldés (mobil-csatorna,
SMS/MMS/messenger külföldre) a következő kör (3/5).

### Mérés

- `scripts/country-layer-check.mts` ⑧ (pre-commit): a CRM-fájlokban nincs régi `normalizePhone`, Budapest-óra,
  `"hu"`-fallback (ALLOW indoklással), a bekötések élnek, a névkulcs és a HU-óra ellenőrizve.
- `scripts/country-crm-e2e.mts` (scratch DB, HU + BG + CZ): 8 pont, 40 ellenőrzés zöld.

### Visszafordíthatóság

🔄 — két additív oszlop; a kód a HU-soron a régi értékeket adja. Visszaállítás = a commit visszavonása.

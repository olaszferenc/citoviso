## ADR-0468 — Nemzetközi C: konverzió, fizetés, számla, domain, szállás-admin és üzem országfüggően + öt új ország

**Státusz:** ELFOGADVA (tulaj-jóváhagyás 2026-11-22 a koordinátoron át, `cit9b4690e3`; brief
`nemzetkozi-C-konverzio-uzem-20261122.md`, SUB `cit5664e772`) · **Épít:** ADR-0437, ADR-0443, ADR-0457,
ADR-0458, ADR-0461, ADR-0464, ADR-0465. **Felülírja:** ADR-0457 „a vendég-kritikus csak magyar lapon fut”.

### Döntés

① **Öt új ország-sor (IT, ES, PT, FR, BG) + ár-réteg** (`0150`, additív, piac ZÁRVA): valós master-adat
(EUR mind az öt — Bulgária 2026-01-01 óta; csak e-mail; ablak 8–17; IFA-modell `none`, mert az adó
településenként/régiónként más; ünnepnapok 2026+2027; PT számlanyelve `en`, mert a Számlázz.hu nem ír
portugálul). Ár-réteg = a HR (0149) egyszeri euró-másolata: Alap 7 / Ajánlott 13 / Teljes 18 €, alapdíj 5 €,
modulok 1 € (szobák, vélemények, foglalás 2 €), többnyelvű 13/16/21 €, saját domain `.com` csomag-tartalom.
Olasz vezetékes szám a generic tervvel nem olvasható (a 0 a szám része) — az A SUB telefon-gazdájáé.

② **Céges vevő nemzeti azonosítóval** (tulaj: ENGEDVE): az ország jogi sémája (`LEGAL_LOCAL.taxIdCheck`)
nevezi meg az azonosítót és az offline ellenőrzését — IT P.IVA (Luhn) / codice fiscale (ellenőrző betű),
ES NIF/NIE/CIF, PT NIF (mod 11), FR SIREN/SIRET (Luhn), BG ЕИК (kétlépcsős mod 11), HR OIB marad.
EU-adószám nélkül nincs VIES, nincs fordított adózás → magánszemély-út (AAM, az OSS-számlálóba megy). A HR
3/10 szabálya marad (OIB akkor is kötelező, ha van EU-adószám). A konfigurátor ugyanebből a listából mutatja
a mezőt (`CFG.billing.nationalIds`).

③ **Nincs csendes HU:** hiányzó vevő-ország hiba; az előtöltés az ország-alias → ISO, különben a régió
egyetlen országa, különben üres (a vevő választ); partner ország nélkül nem jön létre; a sor nélküli
(ismeretlen) ország nem kap HU jogi csomagot (a kód és a sor külön — csak a teljesen ország nélküli, régi
tenant marad magyar).

④ **Pénz:** a Barion tételnév/leírás a vevő nyelvén; **euró-tárca**: a bolt tárcájának számlái üzemi tény,
`BARION_WALLET_CURRENCIES` (alap: `HUF`; a mock-átjáró beállítás nélkül mindent tart) — tárca nélkül a
pay-link zár érthető okkal, az Országok lap ár-lépésén piros „Fizetési tárca” tétel (zár; új oszlop nincs).
A megrekedt-rendelés riasztás a pénznem tizedes-szabályával ír (13,00 €, nem „1300 Ft”).

⑤ **Számla:** a nem-magyar számla tételei, fizetési módja és megjegyzése a számla nyelvén (T(), Bábel-mag);
ha egy szöveg nincs lefordítva, a számla VÁR (újrapróbálás), magyar sor nem kerül rá. A magyar számla
bájtra a régi. Az OSS 80 %-os riasztása már élt (`ossAlert.ts`, billing-cycle).

⑥ **Csatorna:** SMS/MMS csak oda, ahol a szám országának sora engedi — központi őr a két küldőben
(`sms/countryChannel.ts`, a szám hívókódjából; sor nélküli ország → nem megy); a próba-értesítő, az
eszkaláció és a felszólító ledger/napló okkal „kimarad”, a levél megy. HU bitre a régi.

⑦ **Domain:** a nem bontható latin betűk átírása (đ, ł, ø, ß, þ, ħ, ı …: „Đurđa” → `durda`); nem-magyar
szállásnál az ország keresőszavai a típusszavak, és minden kínált végződés (HR: `.com`) megkapja a
névváltozatokat. A regisztrátor .com-ot HUF-ban mér (minden új régió .com-ot kínál).

⑧ **Szállás-admin:** IFA-kérdés csak `tourist_tax_model = hu` országban; a nem-forint mintaárak a pénznem
nagyságrendjében; a Segítő promptja a nem-magyar szállásnál az ország pénznemét, IFA-szabályát és igazolt
portáljait kapja (a magyar prompt bájtra a régi). A naptár-szinkron kártyáinak országfüggő szűrése
(HR: Booking + Airbnb) felület-kapu kivételre vár — patch: `~/rc-briefs/nemzetkozi-c-felulet/`.

⑨ **Idő:** a vendég-ajánlat határideje a szállás órájával; az előfizetés kezdőnapja a tenant zónájában.

⑩ **Mock:** a vendég-kritikus a lap nyelvén fut (anyanyelvi vendég + szerkesztő; a magyar rendszer-prompt
bájtra, a nyelvi blokk a felhasználói körben); a magyar determinisztikus lintek csak magyar lapon. Az angol
portál-szobanév → típus a lap nyelvén változás felület-kapu kivételre vár (ugyanaz a patch). A próba-telefon a lead
országában (szerver + kliens). A kliens többes száma: `trn()` a konfigurátorban, a számos `tr()`-hívások
`trn()`-re (a runtime-ban is).

### Nem része (irány / adat)
- A citoviso.com főoldal honosítása (Ft-os kalkulátor) — az egész lap magyar marketing-oldal (ADR-0464 nyitott).
- Minta-felszereltség és prózából vett szobanevek nem-magyar lapon — országonkénti szókincs kell (az A SUB szótára).

### Mérés
`scripts/nemzetkozi-c-e2e.mts` (scratch DB) · `country-layer-check` ⑬ · `country-hr-e2e` / `country-hr-fix-e2e`
(az új feliratok a `scripts/lib/babel-pending-nemzetkozi-c.mts` Bábel-jegyen).

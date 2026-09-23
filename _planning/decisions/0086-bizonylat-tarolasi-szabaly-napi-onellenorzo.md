## ADR-0086 — Bizonylat-tárolási szabály + napi, önellenőrző éles mentés

**Dátum:** 2026-08-30 · **Státusz:** ELFOGADVA (tulajdonosi jóváhagyás: „deal menjünk így") ·
**Kapcsolódó:** ADR-0053 (verzió-deploy), ADR-0084 (Dokumentumok fül), 0030/0031 migrációk.

**A kiváltó kérdés (tulaj):** „a kimenő számla alapból a számlázz.hu-n él… mi csak tároljuk…
mi a legjobb megoldás?" A vizsgálat közben kiderült, hogy a valódi kockázat nem a tárolás
HELYE, hanem hogy **nem volt mentés**.

**① Saját példányt tartunk — nem alku kérdése.** A megőrzési kötelezettség a KIBOCSÁTÓÉ,
vagyis a miénk; a Számlázz.hu szerződéses szolgáltató, nem garancia (váltás/felmondás után a
hozzáférés kérdés, a kötelezettség marad). Gyakorlati ok is van: a tenant-admin nem hívhat
külső API-t minden PDF-megnyitásnál (késleltetés, kulcs, rate limit, kiesés).
**A Számlázz.hu így a MÁSODIK példány** — helyreállítási út, nem az elsődleges tár.

**② A bájtok helye: EGY szabály, két ág, kimondott küszöbbel.** Eddig két, egymásnak
ellentmondó indoklás élt (0030: DB-ben base64; 0031: fájlrendszeren, mert „a DB-ben lassít").
Az ellentmondás abból lett, hogy sehol nem volt leírva, MIÉRT más a kettő. A szabály:

> Amit MI generálunk, kicsi és kevés (kimenő számla PDF-je) → **DB** (`invoice.pdf_base64`).
> Amit FELTÖLTENEK, nagy és tetszőleges mennyiségű (beszkennelt bejövő bizonylat) → **fájl**
> (`accounting_document.document_file`).
> **Küszöb:** ha az invoice-PDF-ek összmérete ~1 GB fölé nő, a kimenő ág is fájlba költözik.

Miért így: a DB-ág tranzakciós (nincs árva fájl és nincs hiányzó fájl), a `pg_dump` egy
mozdulattal viszi, és nincs útvonal- meg jogosultság-kezelés. Mérve 2026-08-30-án: a teljes
kimenő PDF-állomány **26 KB**; 1000 tenanttal is ~300 MB/év. A DB-ág tehát évekig kényelmes.

**③ A tényleges hiányzó darab: a MENTÉS.** Mérve: a gépen **nulla** ütemezett mentés volt.
Az egyetlen dump akkor készült, ha épp futott egy migráció (`deploy-prod.sh` GATE 3) — egy
nyugodt hónapban egy sem. Az utolsó 4 napos volt, miközben 419 lead, az élő tenant, a
bizonylatok és a `sites/` fa mind EGYETLEN lemezen állt. Ehhez képest az, hogy a PDF a DB-ben
vagy fájlban van, jelentéktelen.

**④ PULL, nem push.** A mentést a dev gép HÚZZA le (`scripts/backup-pull.sh`). Ha az élest
feltörik vagy a lemez elszáll, a mentés ne legyen elérhető onnan: az élesnek nincs kulcsa a
dev géphez, fordítva van. Az éles oldalon a művelet CSAK OLVASÁS (`pg_dump` + `rsync`), tehát
a §0 deploy-doktrínát nem sérti.

**⑤ A mentés ELLENŐRZI MAGÁT — visszaállítással, nem proxyval.** Egy néma, csonka mentés
rosszabb a semminél, mert biztonságérzetet ad. Ezért minden futás visszaállítja a dumpot egy
eldobható adatbázisba, és **táblánként összeveti a sorszámot az élessel**; a `sites/` fa
meglétét is méri. A tábla-lista SZÁRMAZTATOTT (az élesen létező `public` táblákból), nem kézzel
felsorolt — az első futás pont ezen hasalt el (a dev előrébb járt egy táblával), és egy kézi
lista a fordított esetben NÉMÁN hagyna ki egy új, sosem mentett táblát.
**Pirosra tesztelve:** csonka dump → bukik; hamis sorszám → bukik; hiányzó `sites/` → bukik;
ép mentés → zöld.

**⑥ Retenció:** 14 napi + 12 havi (a hónap első sikeres mentése promótálódik). A rotáció CSAK
sikeres mentés után fut, hogy egy bukott futás sose egye meg az utolsó jó másolatot. A mentés
`.env`-et is visz (enélkül a visszaállítás nem tudná újraindítani a szolgáltatást) — ezért a
mentés-könyvtár 700, a titkot tartalmazó fájl 600.

**Nyitva (későbbre):** a Számlázz.hu felőli újraletöltés bekötése azokra a sorokra, ahol a
`pdf_base64` hiányzik — olcsó biztosítás, és egyben visszamérné, ha a saját példányunk elveszne.

**Visszafordíthatóság:** 🔄 a mentés hozzáadás, semmit nem ír felül; a küszöb és a retenció
szabadon hangolható.

> **ADR-0083 kiegészítés (2026-08-30, tulaj-rendelet):** ① EGYGOMBOS indítás — a draft-oldalon a
> két kártya fölött sáv indítja MINDKÉT csatornát (levél szinkron + páros háttérben, eredmény
> csatornánként); csak akkor látszik, ha mindkét csatorna ténylegesen indítható. ② TÖBB-RÉSZES
> SMS-hiba javítva: a `gammu-smsd-inject` `-len` nélkül EGY szegmensre (70 unicode karakter)
> VÁGJA a szöveget — a pár kísérő SMS-e a tulaj telefonján szó közepén csonkult, miközben a
> küldés „sikerként" könyvelődött. A `-len <hossz>` a közös `injectViaGammu`-ba került (dunning,
> relay és páros is ezt hívja); valódi telefonon újra-igazolva. A dunning-szövegek rövidsége
> miatt a hiba ADR-0080 ⑦ óta lappangott.

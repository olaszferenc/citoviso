# BÁBEL — RUNBOOK (hogyan dolgozol)

> A CHARTER mondja meg, mi a dolgod és mi nem; ez a fájl, hogyan csinálod.

## 0. Nap eleje

1. Olvasd el: `babel/charter/CHARTER.md`, ezt a fájlt, `babel/charter/ONTOLOGIA.md`,
   `src/i18n/babel/ontology.md`, `~/babel/tanulsagok.md`, `~/babel/ugyek.md`.
2. Nézd meg a beérkezett kéréseket (a koordinátortól), és a tegnapi naplót.
3. Írd a naplóba (`~/babel/naplo/ÉÉÉÉ-HH-NN.md`): kezdés, mi a mai feladat.

## 1. Állapot: hol tart egy nyelv

```
npx tsx scripts/i18n-pack-status.mts            # nyelvenként: hiányzó felirat + súgó (olvasás, $0)
npx tsx scripts/babel-pack.mts audit <nyelv>    # glosszárium-eltérések a meglévő csomagban ($0)
```

## 2. Egy nyelv teljes csomagja (vagy egy felület)

1. **Export** — mit kell fordítani, felülettel:
   ```
   npx tsx scripts/babel-pack.mts export <nyelv> --out ~/babel/munka/<nyelv>-hianyzo.json
   npx tsx scripts/babel-pack.mts export <nyelv> --all --surface admin --out ~/babel/munka/<nyelv>-admin.json
   ```
   (`--all` = a meglévő fordítással együtt, átnézéshez; a `most` mező a mostani forma.)
2. **Glosszárium előre.** Mielőtt fordítasz, a nyelv oszlopát a `src/i18n/babel/glossary.json`-ban
   kitöltöd (új nyelvnél ez az első munka). A fordítás ehhez igazodik — nem fordítva.
3. **Fordítás felületenként**, egy-egy felület egyben (konzol → admin → honlap → level →
   megkereses → sms). A kimenet egy `{"<magyar>": "<fordítás>"}` JSON-fájl a `~/babel/munka/`-ban.
   Placeholder betűre; `{art}`-ot kihagyod.
4. **Ellenőrzés + mag:**
   ```
   npx tsx scripts/babel-pack.mts import <nyelv> ~/babel/munka/<nyelv>-admin-kesz.json          # száraz
   npx tsx scripts/babel-pack.mts import <nyelv> ~/babel/munka/<nyelv>-admin-kesz.json --seed   # a magba
   ```
   Az elutasított sorokat (placeholder, ismeretlen kulcs) javítod és újra importálod.
5. **Megnézed a helyén** (dev, :4600): `--apply` a dev DB-be, majd a konzol/admin a te nyelveden,
   mobil és asztali szélességben. Ami nem fér ki, rövidíted.
6. **Audit** újra (`babel-pack audit`): az eltéréseket átnézed; az indokolatlanokat javítod.
7. **Landolás:** csak a saját fájljaid (`src/i18n/babel/**`, `babel/**`), tételes `git add`,
   `bash scripts/land.sh` → „IGAZOLTAN FENT”. Élesre a deploy viszi, a tulaj engedélyével — a
   deploy `--ensure` lépése a magot a csomagra teszi. Ami a magból hiányzik, magyarul marad:
   fordítást a kód SEMMIT nem végez (API-fordítás tilos, ADR-0412).

## 3. Egy rossz fordítás javítása (bejelentés alapján)

1. Keresd meg a magyar forrást és a felületét (`export --all` + keresés).
2. Ha fogalom-hiba (rossz szó egy visszatérő fogalomra): **a glosszáriumot** javítod, és a
   fogalom ÖSSZES előfordulását (audit) — nem csak a bejelentett sort.
3. A javított sorokat `import --seed`, land. Írd a `~/babel/tanulsagok.md`-be, mi volt a hiba oka.

## 4. Súgó-cikkek (KB) és a fizetett többnyelvű honlap

**Súgó** (a szállásadó admin súgója, `kb/entries/`, csak a tenant-cikkek):
```
npx tsx scripts/babel-pack.mts kb-export <nyelv> --out ~/babel/munka/kb-<nyelv>/   # hiányzó/elavult cikkek
# … minden <cikk>.json-ban a title + body mezőt fordítod (source_hash, id marad) …
npx tsx scripts/babel-pack.mts kb-import <nyelv> ~/babel/munka/kb-<nyelv>/ --seed  # → src/i18n/babel/kb/<nyelv>/
```
Szabály: a **„…”** gombfeliratok MAGYARUL, betűre maradnak (a képernyő magyar), a kép-útvonal
változatlan, ugyanannyi `## ` alcím. Udvarias, magázó/önöző hang, IT-kezdő olvasó.

**Fizetett többnyelvű honlap** (ADR-0063; a generálás „Bábelre vár” hibával áll, amíg nincs kész):
```
# éles site-nál az ÉLES gépen, csak olvasás:
npx tsx scripts/babel-pack.mts site-export <site-id> <nyelv> --out ~/babel/munka/site-<nyelv>.json
npx tsx scripts/babel-pack.mts site-import <site-id> <nyelv> ~/babel/munka/site-<nyelv>-kesz.json --seed
```
Felület: honlap, a vendég olvassa. Átülteted, nem alkotsz: szám, ár, név, tény betűre (a gép a
számokat ellenőrzi). Land → deploy (tulaj-engedély) → a generálás következő próbája kész.

## 4b. A deploy fordítás-kapuja (GATE 5) bukott

Az élő nyelvek egyikén hiány maradt a magod alkalmazása után. Megnézed (`i18n-pack-status`,
`export`/`kb-export`), lefordítod (§2/§4), landolsz — és a deploy azzal a committal megy újra.
**API-fordítás nincs** — sem kézzel, sem „csak most az egyszer”.

## 5. Nap vége

Napló: mit fordítottál (nyelv, felület, hány sor), mi maradt nyitva (`~/babel/ugyek.md`), és egy
sor a koordinátornak, ha döntés kell (pl. kétértelmű magyar forrás).

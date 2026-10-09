# Felmérés — egy VALÓS oldal erőforrásigénye + a nulla konverzió mért tölcsére (2026-10-09)

> Kiváltó (tulaj, 2026-10-09): „közel kétszáz kiküldésből nulla előfizetés… az okát nem tudjuk" +
> „mielőtt a 2 hetes ingyenes próba vonalában továbbmennénk, mérjük fel, milyen erőforrásigénye van
> egy VALÓS honlap elkészítésének — API-költség, tárhely."
>
> **Minden szám alább MÉRT**, a forrása (parancs / tábla / fájl) ott áll mellette. Ahol becslés, kimondva.

---

## 1. TÁRHELY — egy valós oldal

### 1.1 Amit a lemez mond (16 valós dev oldal, `/home/citoviso/citoviso/sites/`)

| tétel | mért érték | forrás |
|---|---|---|
| `index.html` | 192–242 KB | `sites/<uuid>/index.html` |
| `adatvedelem.html` + `impresszum.html` | 21 KB + 14 KB | ua. |
| HTML összesen, fotó nélküli oldal | **172–270 KB** | 23 oldal a 29-ből ennyi |
| HTML szobaoldalakkal | max 2,1 MB (1 oldal: `71b04e9d`) | szobánként +260 KB |
| fotó / darab (normalizálás után) | **200–240 KB** | `sites/*/uploads/` |
| fotók száma oldalanként | 2–24 (cap 24) | 6 oldalon van feltöltött fotó |
| **tipikus valós oldal** | **2,5–3 MB** (250 KB HTML + 10–12 fotó) | `4b27db3b` 3,2 MB / 12 fotó |
| **legrosszabb eset (24 fotó)** | **6,1 MB** | `2fd4453c` 6,1 MB / 24 fotó |

### 1.2 A 11 MB-os oldal nem a jövő, hanem a múlt

`a122ab93` 10,6 MB — benne két 4000×2252-es (2,8 + 2,4 MB) telefonos nyers fotó és egy 2,2 MB-os PNG.
Ezek **2026-09-27 előtt** kerültek fel; aznap landolt a feltöltés-normalizálás
(`ed651fdc`, `src/tenant/photoUpload.ts`: max 2560 px él, mozjpeg q82, alfánál WebP, böngésző-oldali
előzsugorítás is).

**Mérés (ugyanazon 10 fájlon, a mai `normalizeUpload` paramétereivel):**

```
10 kép: 10,09 MB -> 1,77 MB (82% megtakarítás)
  4000x2252  2838K -> 453K
  4000x2252  2385K -> 313K
  1179x2556 PNG 2203K -> 187K
```

⇒ a ma feltöltött fotóknál ez a 10,6 MB-os oldal **2,0 MB** lenne. A már 2560 px alatti, tömörített
fotókon a normalizálás nem nyer (`2fd4453c` 24 képe: 5,71 MB → 5,71 MB) — tehát a 240 KB/kép a valós
plafon, nem csökkenthető tovább érdemben.

### 1.3 Adatbázis

| tábla | per-oldal méret | forrás |
|---|---|---|
| `site` (`edited_site_data`) | ~1,2 KB átlag, max 3,9 KB | `citoviso_dev` |
| `mock_artifact` (`inputs`) | 7,7 KB átlag, max 14 KB | ua. |
| `site_unit` | <1 KB / szoba | ua. |
| **egy oldal DB-lábnyoma** | **~20 KB** | összeg |
| `site_visit` (növekvő) | **20 B / látogatás** | 8249 sor / 3,6 MB |
| `mock_view` + `mock_event` | 35 B / megnyitás + 180 B / esemény | ua. |

**Kép a DB-ben nincs** — a fotók kizárólag fájlrendszeren (`sites/<uuid>/uploads/`, `src/tenant/assetStore.ts`).
Kivétel: `mms_outbox` élesen 11 MB / 296 sor (37 KB/sor) — az MMS képe a DB-ben ül, de ez outreach, nem valós oldal.

### 1.4 Kapacitás — a tárhely NEM korlát

Éles VPS (`df -h /`): **38 GB, 5,9 GB használt, 30 GB szabad**; 2 vCPU / 3,8 GB RAM; 20 TB/hó forgalom;
€5,49/hó nettó (ADR-0024, Hetzner CX23).

- 3 MB/oldal → a szabad 30 GB **~10 000 valós oldalt** fogad be.
- Az ADR-0024-es becslés (10 MB/tenant átméretezéssel, 100 tenant = 2–15 GB) **felülmérte**: a mért
  valóság 2–3 MB/oldal, vagyis 100 tenant ≈ 0,3 GB.
- Forgalom: 20 TB/hó mellett egy ~2 MB-os első oldalletöltés gyakorlatilag ingyen van.

### 1.5 ⚠️ Ami MA tényleg fogyasztja a lemezt — és nem valós oldal

Élesen **0 `tenant`, 0 `site`** — valós oldal élesen még nem létezik. A 606 MB-os éles `sites/` tartalma:

| tétel | méret | darab | egységár |
|---|---|---|---|
| `_outreach-shots/_photos` (portál/Places fotó-cache) | **444 MB** | 1649 | 276 KB |
| outreach PNG-k (`heroShot`) | **141 MB** | 621 | 232 KB |
| `_pay-shots` | 248 KB | — | — |

**585 MB / 191 megkeresés = 3,1 MB per lead** — vagyis EGY kiküldött megkeresés annyi lemezt eszik,
mint egy teljes valós oldal. Takarítás nincs (`src/outreach/heroShot.ts`-ben nincs unlink/prune).
Nem sürgős (30 GB szabad), de 10 000 leadnél ez 31 GB, és ezzel a lemez ELFOGY — miközben maguk a
valós oldalak elfértek volna.

---

## 2. API-KÖLTSÉG — egy valós oldal

### 2.1 A generálás (már a mock-fázisban kifizetve) — ÉLES MÉRÉS

`mock_artifact.inputs.aiUsage.costUsd`, éles DB, 549 mock = **$60,37 összesen, átlag $0,110, medián $0,000**:

| nap | mock | összeg | átlag/mock | út |
|---|---|---|---|---|
| 2026-10-04 | 41 | $26,96 | **$0,658** | AI-szöveg + őrök |
| 2026-10-05 | 150 | $32,47 | **$0,216** | AI-út, prompt-cache után |
| 2026-10-06 | 188 | $0,00 | **$0,000** | kurátori (Poe) út |
| 2026-10-07 | 52 | $0,00 | **$0,000** | ua. |
| 2026-10-08 | 116 | $0,00 | **$0,000** | ua. |

⇒ az utolsó **356 mock AI-költsége nulla** (ADR-0329: a kurátori és kézi szövegen Vera ítél, nem AI-őr).
374 mock a 549-ből $0,00-s. Egy drága mock lebontása (`guestCritic` $0,176 + `briefAndCopy` $0,150 +
`verifyMarketRelevance` $0,133 + `guestCriticRewrite` $0,099 + `verifyFactuality` $0,092 = $0,649)
mutatja, hol volt a pénz: az őrökben és a vision-inputban.

### 2.2 A mockból valós oldal (`convertLead`) — $0 AI

`src/conversion/provision.ts`: a már legenerált pillanatképet rendereli ki a `sites/<uuid>/`-be,
új AI-hívás nincs. **A valós oldal elkészítése AI-költséget nem ad a mockhoz.**

### 2.3 A többnyelvűség az EGYETLEN per-oldal AI-költség — MÉRVE

`src/tenant/multilangGenerate.ts`: `claude-opus-4-8`, 20 string/köteg, lépés `translateSiteBatch`.

Mért string-mennyiség (16 valós dev oldal, `collectTranslatableStrings`): **átlag 21 string / 836 karakter / 2 köteg per nyelv**.

Valódi API-hívással mérve (`boroka-haz`, 34 string = átlag feletti, DE → német):

```
batch 1: 20 string, in=546 out=556
batch 2: 14 string, in=228 out=183
EGY NYELV EGY OLDALRA: $0,0223 (2 hívás, 774 be / 739 ki token)
```

⇒ **$0,02 / nyelv / oldal**; 5 nyelvvel egy valós oldal **~$0,11**.

A UI-csomag (`language_pack`) ezzel szemben **GLOBÁLIS nyelvenként**, nem per-oldal (kulcs = `lang`,
1 sor élesen) — egy új oldal nem fizet érte. Élesen 10-07 óta mérve: `translation_spend` 5 hívás = $0,132.

### 2.4 Üzemeltetés — per-látogató AI-költség NINCS

Az élő oldal statikus render (`src/engine/render.ts`), nincs chat, nincs per-látogató vagy
per-foglalás AI-hívás. Ami pénzbe kerül üzemelés közben:

| tétel | díj | forrás |
|---|---|---|
| Barion tranzakció | 1,15–1,75% | `RESEARCH-2026-07-billing-hosting.md` §1 |
| saját domain | **€15/év plafon** (őr), havi díj 1 000 Ft | ADR-0093 ④, ADR-0109 |
| aldomain (`<címke>.citoviso.com`) | $0 (Cloudflare wildcard) | ADR-0024 |
| TLS | $0 (Cloudflare, első 100 custom hostname ingyen) | ADR-0024 |
| postafiók | ~$1/fő/hó (Zoho Lite) | ADR-0024 |
| SMS/MMS | helyi SIM, nem API | `docs/mms-send.md` |
| VPS | €5,49/hó nettó az EGÉSZ flottára | ADR-0024 |

---

## 3. A 2 HETES INGYENES PRÓBA ÖNKÖLTSÉGE

| tétel | önköltség |
|---|---|
| tárhely 2 hétre | 2–3 MB (a 30 GB szabadból) |
| AI a konvertáláskor | **$0** |
| AI, ha többnyelvű is | $0,02 / nyelv |
| infra (VPS/forgalom/TLS/aldomain) | elenyésző (fix €5,49/hó az egészre) |
| **közvetlen gépi önköltség / próba** | **≈ $0, azaz nulla forint** |

⇒ **A gépi erőforrás NEM korlátja az ingyenes próbának.** A próba valódi erőforrásigénye
**operátori munkaidő**: a tulaj fotóinak/szövegeinek bekérése és bevitele, beállítás, support,
és a próba végén a leállítás/átállás kezelése. Ezt NEM mértük — ez a következő mérés tárgya.

---

## 4. A NULLA KONVERZIÓ MÉRT TÖLCSÉRE — az ok nagyrészt már az adatban van

Éles DB, 2026-10-09 reggel:

| lépés | darab | az előzőhöz | forrás |
|---|---|---|---|
| prospect (mock létrehozva) | 191 | — | `prospect` |
| kiküldve (`sent`+`opened`+`engaged`) | 177 | 93% | `prospect.status` |
| ebből e-mail / SMS / MMS (átfedéssel) | 132 / 153 / 154 | — | `prospect.*_sent_at` |
| **megnyitotta** | **60 lead** (105 megnyitás) | **34%** | `mock_view` |
| végiggörgette / szekciót látott | 76 / 95 megnyitás | — | `mock_event` |
| visszatért (≥2 megnyitás) | 28 lead | 47% | `mock_view` |
| árszekciót látott (`pricing`) | 58 megnyitás | — | `section_seen` |
| **rendelés-panelt nyitott** | **5** | **8% a megnyitókból** | `panel_open` |
| időszakot választott | 1 | — | `period_select` |
| checkout-lépésre jutott | 1 | — | `checkout_step` |
| **megrendelési szándék** (`order_intent`) | **0** | — | `order_intent` |

**A szivárgás NEM a megrendelési folyamatban van.** A 34%-os megnyitási arány jó, a 47%-os
visszatérés kiváló — a lapot megnézik, végiggörgetik, az ÁRAT IS LÁTJÁK (58 megnyitás), és
**55-ből 55 megnyitó hozzá sem ér a rendelés-panelhez**. A „bizalmatlanság / túl bonyolult" közül
a „bonyolult" kizárható: odáig el sem jutnak. A kérdés az, mi hiányzik a „szép lap" és az
„ezt akarom" között.

Eszköz-bontás: 79 mobil / 26 desktop megnyitás.
Szekció-sorrend látogatottság szerint: `hero` 66, `amenities` 66, `booking` 60, `rooms` 58,
`pricing` 58, `gallery` 47, `map` 42, `poi` 41, `usp` 30, `services` 23, `contact` 19, `about` 8.

### 4.1 Öt beérkezett válasz — a vevő szó szerinti hangja (eddig nem volt összeolvasva)

`outreach_reply`, 5 sor (2,8% válaszarány 177 kiküldésre):

1. **SMS, +36 30 527 9272 (10-07, megválaszolva):** „érdeklődni szeretnék hogy a weboldal elkészítése
   mennyibe kerülne, és vannak-e további költségei az üzemeltetésnek, fenntartásnak" →
   **meleg lead; az árat a lap nem adta át** (noha a `pricing` szekciót látták).
2. **SMS, +36 70 627 7604 (10-07, megválaszolva):** „Rossz helyre küldték" → téves címzés.
3. **E-mail, Eszter Varga (10-07, megválaszolva):** „ez nem a mi apartmanházunk. **Volt honlapunk, de
   nem vált be**, ezért nem tartunk igényt honlap szolgáltatásra." → téves címzés + a
   **legfontosabb kifogás: „a honlap nem hoz semmit"**. Erre a termék LÁTHATÓSÁG-fele a válasz
   (Maps/GBP + SEO, CLAUDE.md: „a honlap szükséges, de nem elegendő") — a megkeresés viszont honlapot ígér.
4. **SMS, +36 20 433 2780 (10-08, ⚠️ MEG NEM VÁLASZOLVA):** „Csak szállás­hellyel kapcsolatos honlapot
   tudnak készíteni vagy más szegmens részére is?" → **meleg lead, és a válasz IGEN** (a motor
   iparág-agnosztikus, a szállás csak a pilot-vertikum).
5. **SMS, +36 20 371 5007 (10-08, ⚠️ MEG NEM VÁLASZOLVA):** „nem tartunk rá igényt".

Kiküldési hibák: `mms_outbox` 295 `sent` / 11 `failed` (3,6%) / 1 `unknown`; `sms_outbox` 273 `sent`,
0 hiba. Leiratkozás: **0**. `prospect_feedback`: **0 sor** — a lapon ma nincs út, amin a tulaj egy
kattintással megmondhatná, mi a baj.

---

## 5. Következtetések

1. **Tárhely: nem korlát, és nem is lesz.** 2–3 MB/valós oldal, 30 GB szabad → ~10 000 oldal.
2. **API-költség egy valós oldalnál: gyakorlatilag nulla.** A generálás a kurátori úton ma $0,00,
   a konvertálás $0, a többnyelvűség $0,02/nyelv. **Az ingyenes próbát gépi költség nem tiltja.**
3. **A próba valódi költsége operátori idő** — ezt még nem mértük.
4. **A konverzió-szivárgás helye MÉRT:** a megnyitók 92%-a a rendelés-panelig sem jut el.
   A hiányzó információ nem „miért nem fizet", hanem **„miért nem kezd el érdeklődni"**.
5. **Van már vevő-hang, csak nem volt összeolvasva:** 5 válaszból 2 meleg lead konkrét kérdéssel,
   1 pedig a termék legfontosabb kifogását mondja ki („volt honlapunk, nem vált be").
   **Kettő ma is megválaszolatlan.**
6. **A leadenkénti 3,1 MB outreach-szemét** hosszabb távon több lemezt eszik, mint maguk az oldalak;
   takarítás nincs bekötve.

## Nyitott kérdések (tulaj-döntésre)

- A 2 megválaszolatlan válasz (meleg lead!) — ki és mikor válaszol?
- Az „inkább ingyenes próba, mint kedvezmény" ajánlat 2 hétre: mi a próba végén az automatizmus?
- Kell-e egy kattintásos visszajelzés-út a kiküldött lapra (`prospect_feedback` ma üres)?
- Az outreach fotó-cache + screenshot takarítása mikortól kell?

---

**A mérés eszközei** (egyszeri, `assets/design-refs/_drafts/eroforras/`, gitignore-olt):
`measure.mjs` (fotó-normalizálás előtt/után), `multilang-cost.mts` (string-mennyiség),
`multilang-measure.mts` (valódi API-hívás egy nyelvre).

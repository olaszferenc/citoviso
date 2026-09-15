# 2026-09-15 — 17 párhuzamos szál az Elek-leletekből, négy őr-kör, és egy élesítés

**Státusz:** LEZÁRVA. Éles = `origin/main` = **`331aae5`** (tag `prod/20260915-1720`).
Ez a jegyzet nem egy javításról szól, hanem a KÖRRŐL: hogyan lett ~172 nyitott Elek-leletből
16 javító-szál + 1 záró szál, és mi derült ki közben a saját eszközeinkről.

## Miből indult

A tulaj kérdése: „milyen hiányzó, javítandó tételek jöttek a felszínre Elek utolsó futásából?"
⛔ **Nem a korábbi összefoglalót idéztük vissza** ([[feedback_inventory_line_is_not_a_measurement]]):
öt felmérő végigolvasta mind a 12 kör `LELETEK.md`-jét, és **minden leletet a MAI kódon**
ellenőrzött. Eredmény: ~**172 nyitott** · ~10 bizonytalan · ~40 igazoltan javítva.

A tulaj 16 szálat kért: **A1–A8** (nyolc doktrína-sértés, pontszerű) + **B1–B8** (nyolc
képernyő-kör, §2b terv-kapuval). A tervek begyűjtve, egy körben eldöntve.

## Amit szállítottunk

**~90 commit** a nap során, ebből **22 ment ki** ebben az élesítésben (a többi 67 a reggeli,
Barion-bírálati deployjal már kint volt). Kiemelve: a fizetőoldal megmondja, MIT fizetsz · a
fagyasztott lap egy dologról szól · kézi terhelés-újrapróbálás (súgóval) · a `/pay/done`
500-asa · az útbaigazítás NÉV, nem IRÁNY · ~10 új ADR (0149, 0155–0184 között).

Három lelet, amire senki nem indult el, és mégis előjött:
- ⛔ **a hírlevél-modul fizetős, és a semmibe küld** (`/api/hirlevel` nem létezik) → a tulaj
  döntése: lekerül a polcról;
- ⛔ **olasz/angol kezelőnél a `confirm()` SOHA nem fut le** (aposztróf töri a JS-t), vagyis a
  visszafordíthatatlan mock-törlés megerősítés nélkül ment;
- ⛔ **318 szövegelem a 4,5-ös kontraszt-küszöb alatt** 1074-ből — nem egyedi hibák, hanem a
  saját tokenjeink (linkek 2,41).

## A négy őr-kör — a kör legfontosabb tanulsága

A `deploy-prod.sh` **GATE 1c** blokkolt, mert a tudásbázis-őr FLAG-elt. Négy független őr futott
egymás után, és **mindegyik mást talált — mindig szűkebbet az előzőnél**:

| # | Lelet | Honnan jött |
|---|---|---|
| 1 | Új tenant-folyamat (kézi terhelés-újrapróbálás) **súgó nélkül** ment be | a javító körök |
| 2 | A `kb-shot` **kiürített egy súgó-képet** (640×2020 → 640×126) | **az 1. javítás mellékterméke** |
| 3 | `pl`+`sk` fordítás **elavult maradt** — a fordítás-kör a szerkesztés ELŐTT futott | **a 2. javítás mellékterméke** |
| 4 | A fordítás magyarul hagyja a gombfeliratokat (217-ből ~199 eltér) | **PRE-EXISTING**, nem ebből a tartományból |

⭐ **Ha a javító szál ítélhette volna meg magát, a 2. lelet kiment volna élesre** — és a súgó
csendben elveszti a lead-lista teljes oszlop-magyarázatát. Az ADR-0132 H szabálya („a javítást
ne az ítélje meg, aki csinálta") pontosan azt fogta meg, amiért van.

⛔ **Mindhárom új rés ugyanabba az osztályba tartozott:** a meglévő kapuk *más kérdésre
válaszoltak*. A `kb-check` a hivatkozás épségét, a `kb-freshness` az mtime-ot, a
lefedettség-kapu a `source_hash`-t nézte — **egyik sem azt, hogy VAN-e tartalom a képen**, vagy
hogy a szöveg a LÁTOTT képernyőt írja-e le.

## ⛔ A kapunak nincs kivétel-módja

A 4. FLAG **pre-existing** hibára szólt (mérve: a `kbPacks.ts` változatlan a 22 commitban, és a
szabály már az élesben futó `fd4ec5e`-ben is benne volt). A tulaj a tényállás ismeretében úgy
döntött, hogy a 22 commit kimegy, a felirat-kérdés külön kört kap.

**De a `kb-gate.mjs` csak `pass`-t ismer.** Egy FLAG-et `pass`-ra írni pontosan az a hamis zöld,
ami ellen ez az egész nap szólt. A megoldás: a verdikt SZÖVEGE mondja ki, hogy ez **nem tiszta
PASS, hanem kimondott tulajdonosi kivétel**, megnevezve a FLAG okát és a négy nyitott tételt.
**NYITOTT: a kapu kapjon valódi kivétel-módot**, hogy ne kelljen a `pass` mezőt igazmondásra
kényszeríteni.

## ⛔⛔ A legnagyobb operatív hiba: a tulaj üzenetei SOHA nem értek célba

**Mind a 16 szálon beküldetlen draft ült** — a tulaj a webes felületen gépelt válaszai ott
maradtak a beviteli mezőben. Három külön körben összesen **~30 utasítás**, köztük olyanok,
amiket épp külön kérdezni készültem („a lead-lap B változat nyert", „a panelnél az A"), és
olyanok is, amik új feladatot adtak.

- A puszta `Enter` **nem kézbesít**; a felhő-oldal ráadásul **visszaírja** a draftot.
- A működő eljárás: `C-u` (törlés) + `send-keys -l "<tartalom>"` + `Enter`, majd
  **ellenőrzés**, hogy a szál tényleg elindult-e.
- ⚠️ A `❯` után **NBSP** áll, nem szóköz — az első keresőmintám ezért 15 draftot NEM talált meg.

**Következmény a munkamódra:** párhuzamos szálaknál az orchestrátornak **minden körben végig kell
pásztáznia mind a 16 bemenetet**. Aki a webes mezőbe ír, annak az üzenete elveszhet.

## ⛔ Amit én magam rontottam el (mind mérésből)

1. **Az élesítési premisszám hamis volt.** Végig `b029db8`-at írtam élesnek — közben **ma 09:27-kor
   élesítés történt** (`fd4ec5e`, Barion-bírálat). Nem 85 commit ment ki, hanem 22. A
   deploy-szkript száraz futása mondta meg. ([[feedback_my_own_summary_line_can_be_the_false_premise]])
2. **A `git reset --hard` alatt a watchdog GC elvitte a worktree-met** — `retired: true` esetén a
   `used_ok` kikapcsolja a „van user-üzenet" védelmet. 5 gitignore-olt futás-mappa odalett.
3. **Az `rc-new.sh` az ÉN fámba indította a pilotot**: az örökölt `RC_PROJ` veri a
   könyvtár-paramétert. 16 szálnál kölcsönös felülírás lett volna. Azóta minden indítás után
   `pane_current_path`-ot ellenőrzök.
4. **Vak nyilazás a kérdés-TUI-ban** rossz opciót jelölt ki (a kötelező indoklás helyett az
   „elég egy kattintás"-t), és egyszer a **submit elnyelt egy választ**. Azóta minden választás
   előtt kiolvasom a kurzort, és submit után visszaellenőrzöm, mi rögzült.
5. **Téves riasztás:** a `fagyasztottkartya` képeit hibalapnak néztem — a `TERV-KESZ.md` helyett
   **tippeltem egy fájlnév-mintát**, és egy elhagyott próbálkozás maradékát nyitottam meg.
6. **A figyelőm háromszor mért rosszul:** a próza-kérdést „késznek" olvasta (a B2 így majdnem
   ütközött a B6-tal ugyanazon a javításon) · a landolatlan commitot „késznek" vette · a
   sentinel-törlés nyolc kész tervet újra bejelentett. Mindhárom ugyanaz az osztály, mint a
   terméken: **a mérőeszköz más kérdésre válaszolt, mint amit hittem róla.**

## Mechanika, ami bevált

- Szálanként **saját worktree** (`rc-wt-prepare.sh <slug>`, kötőjel-tilos), **explicit `RC_PROJ`**,
  és indítás utáni könyvtár-ellenőrzés.
- A megbízás **fájlban** megy (`BRIEF.md` a fa gyökerében), nem tmux-on át — megbízhatóbb, és
  egyben GC-fék is.
- A megbízás **név szerint sorolja azt is, amit a felmérés CÁFOLT**, hogy a szál ne javítson ki
  nem létező hibát; és megmondja, melyik tétel tartozik MÁSIK szálhoz.
- A §2b terv-kapunál a szálak **megállnak és `TERV-KESZ.md`-t írnak** — a tulaj EGY körben dönt
  mindről, a szálak nem várnak rá szétszórva.
- ⚠️ **A `land.sh` törli a `_drafts`-ot** (ADR-0077): három szál elvesztette a jóváhagyásra váró
  mockját, mert előbb landolt egy apró javítást. Az ADR indoklása („egy paranccsal
  újragenerálható") itt nem állt, mert a generátor is a `_drafts`-ban volt.

## Nyitva maradt

1. **A felirat-kérdés** (4. őr FLAG-je): a fordított súgó magyar gombneveket idéz, miközben az
   admin a tulaj nyelvén fut (ADR-0067). Négy résztétel: a `kbTranslationValid()` szabálya · a
   `kbPacks.ts` hamis fejléc-megjegyzése · őr a LEFORDÍTOTT feliratra · nem-magyar screenshotok
   (33 entry, mind csak `assets/hu`).
2. **A `kb-gate` kivétel-módja** (lásd fent).
3. A `payResultPage` / `payUnknownRefPage` feliratainak drift-védelme.
4. **Tulaj-tennivaló:** Zoho-alias az `info@citoviso.com`-ra — enélkül a fizető ügyfél válasza
   sehová nem érkezik, és ez a cím MA ment ki élesre.
5. Az FK-006 újrafuttatása (a park ELEK-tenantja hiányzik; valódi LLM-költség).

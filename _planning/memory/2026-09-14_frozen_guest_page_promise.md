# 2026-09-14 — A fagyasztott honlap VENDÉG-lapja: nem ígérhet visszatérést (ADR-0157)

**Szál:** `wt/adr0119vendeg` · **Kiváltó:** Elek FK-006a GYANÚ-2 + GYANÚ-4 (2026-09-13-i
teljes futás) · **Élesítés NINCS** (§0.3).

## A bejelentés premisszája részben HAMIS volt — és ez a legfontosabb tanulság

A BRIEF úgy szólt: „az ADR-0119 megsértve maradt a vendég-oldalon". **Megmérve: nem
sértés, hanem HATÁLY.** Az ADR-0119 ③ *és* a jóváhagyott terv (`freeze-state/README.md`
5. pont) **SZÓ SZERINT előírta** a kifogásolt mondatot, tulajdonosi választásként
(2026-09-11: „a vendég-lapon a »nézzen vissza holnap« szöveggel"). Sőt az FK-006a
`cél:` sora is ezt várta el: „és hogy **mikorra várható a visszatérés**".

Vagyis a kód **teljesítette** a kontraktust. Amit javítani kellett, az egy tulajdonosi
döntés — azt pedig nem én írom felül. Ezért a kód átírása ELŐTT kérdés ment a tulajhoz,
**három renderelt változattal, mindkét méretben** (mobil 390 + asztali 1280), a termék
SAJÁT render-függvényével gyártva. Választás: **„B — csak a tény"**.
→ Ha ezt elmulasztom, pontosan az a hiba születik újra, amit a
`feedback_approved_draft_is_the_contract` rögzít.

## Amit a lap hamisan állított (3 osztály, a renderelt kimeneten mérve)

| Mondat | Miért hamis |
|---|---|
| „**Dolgozunk rajta**" | Nem dolgozunk semmin. Kitalált szereplő, és elterel attól, ami segíthet: a szállásadó telefonszámától. A fagyás `applyRenewalPaid`-del oldódik, webhookra, azonnal. |
| „**nézzen vissza holnap**" | Időpont, amit nem tartunk kézben. Egyetlen ágban igaz: ha a tulaj 24 órán belül fizet. |
| „**átmenetileg**", „**Addig is…**" | Visszatérés-ELŐFELTEVÉS. Ha a fizetés nem jön, a 30. napon a honlap VÉGLEG lekerül — ekkor visszamenőleg mindkettő hazugság volt. |

**A mérce egy mondatban:** *ami a lapon áll, maradjon igaz abban az ágban is, ahol a
tulaj SOSEM fizet.* A `Retry-After: 86400` marad — az a KERESŐNEK szóló gépi jelzés,
nem a vendégnek tett ígéret; a lap a kettőt szétválasztja.

## Miért nem fogta meg az ADR-0119 ⑧ őre: a KORPUSZ, nem a módszer

A `frozen-claim-check.mts` már ÁLLÍTÁST mért, nem szavakat — és mégis átengedte, mert
**a korpusza a tulaj-admin volt, egyedül**. A fagyás szabálya a VENDÉGRŐL szól, mégis
épp a vendég fele maradt mérés nélkül: **három napig** azt ígérte neki, hogy nézzen
vissza holnap. Szerkezeti ok is volt: a lap a `public.ts`-ben ült, aminek az importja
**szervert indít** — tehát fizikailag kizárta, hogy őr rendereljen belőle.

**Javítás:** a lap saját, tiszta modulba költözött (`src/server/suspendedPage.ts`,
adat be → HTML ki, se DB, se szerver). Az őr korpusza a vendég-lap **három állapota**
(név+elérhetőségek · név elérhetőség nélkül · névtelen), és két olyan osztályt ismer,
amire a tulaj-oldalnak nincs szüksége: **visszatérés/időpont-ígéret** és **hamis
szereplő**. ⚠️ Ezek **alany nélkül** mérnek — a „Dolgozunk rajta" és a „nézzen vissza
holnap" egyikének sincs alanya, alany-követeléssel pont a mért mondat csúszott volna át.
A tulaj-oldalra NEM vonatkoznak: a tulajnak IGAZAT mondunk a mechanizmusról
(„Fizetés után a honlap automatikusan, azonnal visszakapcsol").

## ⛔⛔ A saját őrömben HÁROM szabály halott volt — és a zöld önteszt elfedte

A JS `\b` szóhatára `[A-Za-z0-9_]`-en értelmezett: **szóköz és „á" között NINCS határ**,
ezért a `/\bátmeneti/` magyar mondatban soha nem illeszkedik. Így indult az `átmenetileg`
és az `újra elérhető` szabály — némán, sosem tüzelve. Az összesített önteszt mégis ZÖLD
volt, mert **ugyanazon a mondaton más szabályok pirosra mentek és kitakarták őket**.

A javítás nem a regex, hanem a MÓDSZER: minden osztály visel egy saját `proof` mondatot,
és az önteszt kimondja, hogy **mind a 13 illeszkedik a sajátjára**. Ez azonnal kibuktatott
egy **harmadik** halottat: `48 órán belül` — a magyar tőváltás miatt az `óra` nem fedi az
`órán`-t, tehát fix egységlista helyett „N ⟨szó⟩ belül" kell.
⭐ Ugyanezt az ASCII-`\b` csapdát egy PÁRHUZAMOS szál is elkapta aznap
(`2026-09-14_admin_voice_and_chip_counts.md`) — nem egyedi elírás, hanem visszatérő
osztály magyar szövegre írt őröknél.

**Az önteszt mindkét félre külön bizonyít:** a visszarontás nem beírt ál-lap, hanem a
VALÓDI renderbe helyettesített 2026-09-11-es szöveg — és ha a helyettesítés nem illeszkedik
(mert a termék szövege változott), az önteszt HANGOSAN bukik, nem mér csendben mást.
Plusz kikényszeríti, hogy **mindkét fél** pirosra menjen (tulaj 18, vendég 13) — különben
a tulaj-oldal pirosa elrejtene egy vak vendég-mérőt.

## GYANÚ-4 — és a lelet, ami MÖGÖTTE volt

A bejelentés: „a felfüggesztési lap csak magyarul renderel". **Pontosítva: az elsődleges
nyelven**, mert a fagyás-ág a `/<lang>/` útválasztó ELŐTT fut. Aki 14 900 Ft-ot fizetett
három nyelvért, annak az angol vendége — a könyvjelzőzött vagy indexelt `/en/` URL-en
érkezve — az elsődleges nyelven kapta a lapot. Javítva: az útvonal-előtag dönt, de CSAK
ha a pillanatkép tényleg létezik (kifizetett + legenerált nyelv); egyébként elsődleges
nyelv, **nem kitalált fordítás**. Őr: 7 eset, és a régi viselkedésen bizonyítottan 3-at
buktat.

⛔ **De a javítás önmagában ÜRES lett volna.** Mérve: a `public.ts` **SOHA nem volt** az
`I18N_SOURCES` listán, tehát a lap `T(lang, …)` stringjei **egyetlen nyelvi csomagba sem
kerültek be** — egy német tenant vendége magyarul kapta a lapot, MINDEN kapu zöldje
mellett. Ez ugyanaz a hibaosztály, amit az ADR-0067 megjegyzése ír le a levél-láncról,
csak egy fájllal odébb. A `suspendedPage.ts` felvéve a listára (2552 → 2556 string).
⚠️ A `public.ts` maga NEM került fel (2 800 sor, tele belső literállal) — ezért is jó,
hogy a vendég-lap önálló modul: a lint hatóköre pont akkora, mint a vevőnek szóló felület.

## Amit a felirat-csere eltört volna (grepelve, §feedback_label_change_breaks_its_quoters)

A saját grepem **négyet** talált: a jóváhagyott kontraktus két fájlja (`freeze-state-A.html`
+ `README.md` 5. pont), az Elek `FK-006a` két `várd:` sora és a `cél:` sora, plusz az
i18n-katalógus.

⛔⛔ **És a grepem NEM volt elég — a pre-commit kapuk még HÁRMAT találtak, kettőt a
TERMÉKBEN:**

1. **`elek/scenarios/FK-006b-thaw-and-expiry.md:13`** — egy MÁSIK forgatókönyv idézte a
   régi szöveget (`nem látható "átmenetileg nem érhető el"`). A grepem a *„Az oldal
   átmenetileg nem elérhető"* (cím) alakra ment, a törzs-töredékre nem → átcsúszott.
   Az `elek-label-drift-check` fogta meg.
2. **`src/server/adminViews.ts:357` és `src/email/billingEmail.ts:192`** — a tulaj-admin
   fagyás-kártyája ÉS a felfüggesztés-levél **IDÉZŐJELBEN idézi a vendég-lapot**:
   „A vendégek most egy udvarias, **»átmenetileg nem elérhető«** lapot látnak…". A csere
   után a tulaj idézőjelben kapott volna egy mondatot, amit a vendége soha nem lát.
   ⭐ **Az idézet is FOGYASZTÓ — a forrásával együtt mozog.** Ezt egyetlen doc-grep sem
   adta volna: a termék két másik rétegében ült.
   ⚠️ Az `adminViews.ts` a §2b felület-kapu alatt van; kivételt **magamnak nem adtam**
   (ADR-0068) — a tulaj adta meg, előtte-utána bemutatás után, és a `surface-gate.mjs`
   naplózza. A fagyott ág renderelve ellenőrizve (az új idézet benne, a régi nincs);
   ⚠️ ÉLŐ képet nem tudtam csinálni róla: a KÖZÖS park nincs fagyasztott állapotban, az
   időutazó pedig tiltott ebben a szálban.
3. **`internal-ref-check`** kidobta az ADR-számaimat a forgatókönyv `cél:`/`kézi:`
   soraiból (azok a futásban EMBERNEK megjelenő szöveggé válnak) — a `kontraktus:` sorban
   maradhatnak.

**Az FK-006a három tiltó `várd:` sort kapott — de csak KETTŐ maradt.** A
`nem látható "Dolgozunk rajta"` sort **eltávolítottam**: a szöveg már sehol nincs a
termékben, tehát az állítás **vakon zöld** lenne, sosem tudna bukni (ezt is a
felirat-őr mondta ki). A renderelt mérést a `frozen-claim-check` végzi. A „holnap" és az
„átmenetileg" viszont ÉL máshol a termékben (kimenő SMS, dunning-levél), ezért azok a
tiltások értelmesek.

## Módosított / létrehozott fájlok

- **ÚJ** `src/server/suspendedPage.ts` — a vendég-lap tiszta render + `suspendedLang()`
- `src/server/public.ts` — a render kiemelve; a fagyás-ág nyelvet választ az útvonalból
- `scripts/frozen-claim-check.mts` — vendég-korpusz, 13 állítás-osztály, szabályonkénti
  `proof`, 7 nyelv-eset, kétoldali piros önteszt
- `scripts/i18n-sources.mjs` — `suspendedPage.ts` felvéve · `src/i18n/catalog.json` (+4)
- `hooks/pre-commit` — az őr triggerei (⚠️ rebase-konfliktus: egy párhuzamos szál
  ugyanide tette a `^scripts/frozen-claim-check` triggert — IKER-javítás, mindkettő bent)
- `_planning/DECISIONS.md` — **ADR-0157**. ⚠️ A szám KÉTSZER csúszott, és a második a
  LAND pillanatában: íráskor a 0150–0152 volt elkelve, ezért 0153-at foglaltam `git fetch`
  után, közvetlenül írás előtt — mire a landolási rebase lefutott, a **0153–0156 is elkelt**
  (a 0153-at egy másik szál vitte el). Tehát a „fetch után, közvetlenül írás előtt" NEM
  elég: a számot a land UTÁN is igazolni kell. A közös doksit ilyenkor az `origin/main`-ről
  ÉPÍTETTEM ÚJRA + a saját blokkom, nem hunk-szintű konfliktus-feloldással, és a saját
  hivatkozásaimat csak a SAJÁT fájljaimban írtam át (előbb megmérve, hogy egyikben sincs
  idegen ADR-0153).
- `assets/design-refs/console/freeze-state/{README.md,freeze-state-A.html}` — a
  kontraktus 5. pontja átírva, a fejléc kimondja, MI változott és miért
- `elek/scenarios/FK-006a-dunning-frozen.md` — `cél:` + 2 módosított + 3 új `várd:`

## Nyitott

1. **A `public.ts` 4 vendég-stringje lefedetlen marad** az i18n-katalógusban:
   „Túl sok próbálkozás…" (840), „Ismeretlen szállás." (852), „A közzétételhez az Ön
   hozzájárulása szükséges…" (869), „Nincs megjeleníthető honlap." (2728). Mindegyik a
   VENDÉGNEK szól, `guestLang`/`lang` argumentummal — tehát magyarul megy ki egy német
   szállás vendégének. Külön kör: vagy modulba emelni őket (mint a vendég-lapot), vagy
   a lint hatókörét a `public.ts`-re vinni és végigvinni a következményeit.
2. Az FK-006a újrafuttatása a parkban nem történt meg (a `elek-timetravel-fk006.mts`
   tiltott ebben a szálban — a KÖZÖS parkot tolná).

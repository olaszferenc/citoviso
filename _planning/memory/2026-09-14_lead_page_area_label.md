# 2026-09-14 — A lead-LAP kimaradt az ADR-0143-ból: a „lezárva" egy még nyitott osztályra szólt

**Kiváltó:** Elek FK-003b L15 (a 2026-09-13-i teljes futásból, ~250 lelet). BRIEF: „A3 — A lead-LAP
»Régió« sora nyers azonosítót mutat".

## Amit MÉRTEM (nem becsültem)

- **Nem 3 lead, hanem MIND az 595.** A BRIEF (és a saját első feltevésem) úgy szólt, hogy a
  besorolatlan területek szivárognak. A `ui-shot` KÉPE cáfolta: a `getLead()` a `region.label`-t
  soha nem kérdezte meg, ezért a lap **minden** leaden a nyers kulcsot írta ki.
  Következmény: az ADR-0143 ① utószálának forrás-javítása (a hamis „Balaton északi part" →
  „Balaton") **erre a felületre el sem jutott** — egy balatonlellei (DÉLI parti) lead a saját
  lapján továbbra is `balaton-north`-ot viselt.
- **Terület-megoszlás (dev DB):** `balaton-north` 529 lead (címke „Balaton"), `badacsony` 63,
  és `bs` / `Balaton` / `_test` 1-1 lead **terület-rekord NÉLKÜL**.
- **A legmegtévesztőbb eset a `Balaton` kulcs:** hibátlan helynévnek látszik, közben nincs mögötte
  rekord, és a lapon minden más mező „–" (nincs ország, város, cím) — a régió viszont
  határozottan állít valamit.
- **Ugyanez a kulcs ugyanezen a lapon, három sorral lejjebb:** az artefaktum-kártya meta-sora a
  nyers és az emberi felet egymás mellé írta — `… · region=Balaton · regionId=balaton-north · …`
  (3 artefaktumból 2, saját `psql`-méréssel újraellenőrizve, nem idegen összefoglalóból).

## Amit szállítottam

- `src/console/data.ts` — `LeadDetail` megkapja a `regionLabel` + `regionKnown` párost (ugyanaz a
  kettő, amit a `LeadListRow` visz); a `getLead()` **LEFT** joinnal oldja fel a `region.label`-t
  (inner join kidobná a besorolatlan leadek lapját — a hiányzó besorolás megnevezendő ÁLLAPOT,
  nem ok a lead elrejtésére).
- `src/console/views.ts` — `areaValueHtml()` **kiemelve egy helyre**, a lista cellája és a lap
  adat-sora is ezt hívja; a lap felirata és magyarázó mondata a lista `columnLabel` /
  `columnMeaning` forrásából jön; a fejléc-alcím **MEGNEVEZI** a második értéket
  („Balatonlelle · Terület: Balaton"); a meta-sorból kikerült a `regionId` (a tárolt `inputs`-ban
  MARAD, mert a `persist.ts` és a `rerender-mock.mts` abból dolgozik).
- `scripts/lead-page-area-label-check.mts` — új őr, `hooks/pre-commit`-be bekötve.
- `_planning/DECISIONS.md` — **③ UTÓSZÁL az ADR-0143-hoz** (nem új sorszám: párhuzamos szálak
  számoznak, és ez ugyanannak a döntésnek a végigvitele).

## Az őr, és mit bizonyít

35 zöld állítás; négy eset (besorolt · „valódi helynévnek látszó" besorolatlan · fejlesztői kulcs ·
rövid kulcs), valódi DOM, DB nélkül.

- **Gépi horgonyon mér** (`data-fact="region"`, `data-cit-area`), nem a magyar feliratra illesztve
  — különben egy átnevezés némán elvinné az állítást ([[feedback_label_change_breaks_its_quoters]]).
- **Nem kölcsönzi a tárgyát:** a tiltott kulcsok halmaza a FIXTURE saját azonosítóiból jön, nem a
  vizsgált helperből ([[feedback_guard_must_not_borrow_its_subject]]).
- **Önteszt: 18 piros**, mindhárom felszínen (adat-sor, fejléc-alcím, meta-sor) + a visszavont
  „Régió" feliraton.
- **És a kapu a VALÓDI visszarontásra is megáll:** kontrollált próbával visszaírtam a hibás sort,
  a hook-blokk `set -e` alatt rc=1-gyel elhasalt, a blokk utáni sor nem futott le. (A
  DOM-mutációs önteszt csak azt bizonyítja, hogy a MÉRÉS tud pirosra menni.)

## Két saját hiba, mérés közben

1. A `data.ts` kommentjébe azt írtam, hogy „3 lead szivárog, 592 a nevet mutatja" — a KÉP
   cáfolta. Helyesbítve a kódban is. A kép a mérce, nem a feltevés.
2. A meta-sor állítása **vakon zöld** lett volna: egy semmit sem fogó szelektor is 0 sértést
   jelent, ugyanúgy, mint egy tiszta lap. Az őr ezért előbb BIZONYÍTJA, hogy tényleg azt a sort
   olvassa (a címke-fél jelenlétével) — [[feedback_fixture_must_prove_its_own_path]].

## Nyitott / átadva

- ✅ **LEZÁRVA ugyanaznap → ADR-0163** (tulaj-döntés: „hagyja el a régió-fordulatot").
  A `resolveRegion()` `?? id` fallbackja ismeretlen azonosítónál **a kulcsot adta címkeként**
  (`bs` → `"bs"`, `_test` → `"_test"`).
  ⛔⛔ **HELYESBÍTÉS a fenti első változatomhoz:** ide azt írtam, hogy ez a
  `render.ts:81/154/161/170/211` sorokon megy a vevő lapjára — **mérve azok a sorok a
  `generateMock()`-hoz tartoznak, amit MA SENKI NEM HÍV** (a konzol a `generateEngineMock`-ot
  hívja; hívási hely: 0). A hibát a helyes irányba jelentettem, de a BIZONYÍTÉKOM halott ágra
  mutatott — **másodszor ugyanabban a szálban** (előbb a „3 szivárog / 592 rendben", amit a kép
  cáfolt). Az ÉLŐ út más és rosszabb: a címke a **copywriter promptjába** és a **tény-kapu
  forrás-listájára** ment, az utóbbi pedig LICENC („amit felsorol, azt a lap állíthatja"),
  tehát a kapu ÁLDÁSÁVAL került volna ki. ⚠️ Kirenderelt lapon egyik úton sem figyeltem meg.
- ⚪ `superseded_by:<uuid>` (`data.ts:568` → a kártya „Döntés:" sora): nyers UUID az operátor
  előtt. Nem hamis, de cselekvésre kész tartalma nincs.
- **Nem mértem:** lead CSV-export (nem találtam ilyet), tenant-admin felületek.

## Kapu-eljárás (§2b)

A `views.ts` a felület-kapu alá esik, és a token ZÁRVA volt. A kivételt **nem magamnak adtam**
(ADR-0068): legyártottam a négy ELŐTTE-képet (mobil + asztali, két leaden), megküldtem a
pontos szöveg-diffel, és a tulaj választott — „mintakövető hibajavítás". A token az ő szavával
naplózva. Utána a négy UTÁNA-kép is elment. Élesítés NINCS (§0.3).

# 2026-09-15 — A jelzés-szín nem felirat-szín: a döntő gomb legyen olvasható

**Forrás:** tulajdonosi kérés az előző kör „mért, de nem javított" tételére. **ADR-0173.**
Élesítés NINCS (§0.3). Kontraktus: `assets/design-refs/console/semantic-contrast/`.

## A kiváltó és ami mögötte volt

Az ADR-0156 körében megmértem a kép-kapu „Vállalom" gombjának kontrasztját: **3,91** —
küszöb alatt. Kimondtam, de nem javítottam (13 helyen használt gomb-stílus, házon átívelő
szín-döntés). A tulaj kérte a külön kört.

⭐ **A kör a bejelentésnél SOKKAL nagyobb osztályt talált.** A ház a JELZÉS-színeket
FELIRATNAK is használja, és világos háttéren egyik sem olvasható:

| token | kontraszt | hol |
|---|---|---|
| `--citui-cyan-500` | **2,41** | **minden link** a konzolon |
| `--citui-info` (= cián) | **2,15** | `.pill.generated`/`.sent` a saját tintjén |
| `--citui-warn` | **2,52** | `.q-mid`, „elavult" jelvény |
| `--citui-ok` | **2,72–3,00** | **„Fizetek ▸"**, **„Jóváhagyás"**, `.q-good` |
| `--citui-bad` | **3,35–3,91** | `button.bad`, `.pg-head`, `.q-bad` |
| `--citui-muted` | 4,36–4,81 | másodlagos szöveg — a küszöb HATÁRÁN |

⛔⛔ **A két legrosszabb érték a DÖNTŐ gombokon ült:** a vevő „Fizetek ▸" gombja és a
kurátor „Jóváhagyás" gombja **3,00**-n — miközben a gépi „látható-e" próbák IGAZAT
mondtak. Azok a DOM-ot kérdezik, nem a szemet (az `isVisible()`/`elementFromPoint`
tilalom folytatása, harmadszor).

## Tulajdonosi döntés

① **„A — sötétebb felirat":** a HUE marad ott, ahol JELZÉS (keret, háttér, pötty, ikon),
csak a FELIRAT sötétedik. A destruktív gomb nem lesz hangsúlyosabb.
⛔ **A kézenfekvő „legyen tömör gomb" NEM olcsóbb:** mérve a fehér felirat a mai zöldön
szintén **3,00** — tömör gombhoz is sötétebb árnyalat kellene.
② **Hatókör: a jelentés-vivő színek mind** (gomb + állapot-feliratok + linkek).
③ **A `--citui-muted` MARAD** — átütne a tenant-adminra és a vendég-oldalra.

## Amit szállítottam

- 4 szöveg-token a dizájn-magban (`--citui-*-ink`), minden TÉNYLEGES háttérre megoldva,
  **tartalékkal** (≥5,3). ⚠️ Az első megoldásom 4,51–4,59-et adott — „még éppen átment",
  vagyis a következő érme-feldobás; a tulaj által jóváhagyott árnyalatok tartalékosak.
- 48 `color:` deklaráció a konzol-CSS-ben + **23 BEÉGETETT inline szín** a nézetekben.
  ⛔ Ez utóbbi megkerülte a CSS-t (egy szabály két példányban) — nélküle a javítás
  felerészben zöldet mutatott volna egy pirosra.
- ⛔ Az ikon nem felirat: a cián akcent-pötty a ház kézjegye (ADR-0021 ①), marad. Az első
  cserém átírta; a hatókör-döntés visszavette.

## Ami a küszöb ALATT MARADT (tételesen — a tulaj kérése)

Az utolsó mérés: **4224 szöveg-elem, 10 útvonal, 390 ÉS 1280 px.**

1. **`--citui-muted` `rgb(96,116,139)` — 165 elem**, 4,36–4,81 (a háttértől függően).
   Tulajdonosi döntéssel marad. Elemek: `.sv` forrás-bélyegek (a legtöbb), `.mut`,
   `.pr-tier__*` árazás-magyarázók, `li` súgó-sorok, `.pr-input__u` mértékegységek.
2. **2 szándékosan TOMPÍTOTT elem** — `span.ctbl-clear` („✕ Szűrők törlése"), `opacity
   .42` + `pointer-events:none`, amikor nincs mit törölni. Látott 2,55, **tompítás nélkül
   15,72**. A ház saját szabálya, hogy a tiltott nézzen ki tiltottnak.
   (Ugyanide esik 2 `--citui-muted` elem, amit a kikapcsolt modul sora tompít 0,45-re →
   a szem 1,83-ot lát rajtuk — ezt az őr KÜLÖN kiírja, nem nyeli el a szín-kivételbe.)
3. **Nem mértük, és kiírjuk:** `<option>` (a legördülőt a böngésző saját felülete festi,
   a DOM-háttér átlátszó — mérve) és a gradiens hátterű elem.

⚠️ **A lefedettség ALSÓ BECSLÉS, nem teljes.** A lead-lap tartalma a KÖZÖS parktól függ:
két futás között **44 elem jelent meg, ami az elsőben nem is renderelődött** — és mind a
négy osztály VALÓDI lelet volt (`.cp-chip.used` 3,82 · `.hp-sc.low` fehér száma a piroson
2,85 · `.cp-bar .b1` **fehér a mai zöldön 3,00** · `.cp-chip.miss` 3,31). A kitöltött
jelvényeknél a HÁTTÉR kapta a sötétebb változatot (ott a felirat ÜL a színen) — ugyanaz a
mérés, ami a „tömör gomb" változatot megbuktatta. Az őr ezt a korlátot KIÍRJA.

⛔ Ami NEM maradt: a jelentés-vivő körből **0**. Az őr öntesztje (nyers színek
visszaállítva) **702 elemen** megy pirosra — ennyi felirat volt a küszöb alatt.

## Az őr

`scripts/console-contrast-check.mts` — a RENDERELT konzolon mér, valódi Chromiumban,
10 útvonalon, MINDKÉT méreten, **alfa-kompozitálva** (a féligáttetsző háttér ÉS az
ős-`opacity` is számít). Három KIMONDOTT csoport: ① engedett szín (megszámolva) ·
② szándékosan tompított, olvasható alapszínnel · ③ minden más = bukás.
⛔ **A tompítás nem kiskapu:** csak akkor engedjük, ha a felirat TOMPÍTÁS NÉLKÜL átmenne.

## Saját hibák és csapdák

⛔⛔ **A `color-mix()` `color(srgb 0..1)` alakban jön vissza**, a többi `rgb() 0..255`-ben.
A vázlatom parsere összemosta a kettőt, és a mai értéket adta minden változatra. A skálát
a SZINTAXIS dönti el, nem a szemem. (Ez a memóriámban RÖGZÍTETT csapda volt — és újra
beleestem.)

⛔⛔ **A gombokon `transition` van (220 ms):** a váltás után AZONNAL olvasott computed
color még az ÁTMENET közepe. Az „A" változat 3,00-t mutatott, vagyis a MAI értéket. A
mérés a PIXELRE várjon, ne az órára (ADR-0147) — és a poll a VÁLTÁS ELŐTTI állapothoz
kötődjön, különben két azonos képkockát talál még az átmenet indulása ELŐTT.

⛔ **A gradiens nincs benne a `backgroundColor`-ban** (`rgba(0,0,0,0)`), ezért az
elsődleges, fehér feliratú gombra 1,00-t mértem volna — látványos hamis piros egy
tökéletesen olvasható gombra. Amit nem tudunk megmérni, arról nem állítunk semmit.

⛔⛔ **A SAJÁT előző őröm bukott a saját javításomon:** a `mock-photo-gate-check` beégetett
`rgb(229, 72, 77)`-et hasonlított. Az állítás SZÁNDÉKA az volt, hogy a `.con button`
(0,1,1) ne írja felül az osztály-szintű színt — ezt most egy token-PROBE mondja ki, nem
egy szám. („A felirat átírása eltör mindent, ami IDÉZI" — a saját osztályom.)

⚠️ **A hatókör-mérőm először VAK volt:** a gradiens ősöknél mindent eldobott (5 elemet
mért 1074 helyett), és csak a „direkt szöveg-gyerek + pontos szín-egyezés" szűrő után jött
elő a valódi kép. A háttér az ELSŐ átlátszatlan ősig keresendő, és ott meg kell állni.

## Infra

⛔ **Munka közben HÁROM ÚJ nyers feliratszín érkezett párhuzamos szálaktól** (`.con-wf__v`,
`.con-imgdet summary`, `.con-imgwarn`) plusz egy negyedik a rebase után (`.con-livewarn`,
3,31). Mind az őr fogta meg — pont ezért kell. A rebase-konfliktus unió volt (egy szál a
`:not(.con-btn2)` szelektort bővítette, én a színt).

⚠️ Egy commit-kör a KÖZÖS park idegenkulcs-ütközésén hasalt el (`ri_ReportViolation`), nem
a kódomon — újrafuttatásra átment.

## Módosított / létrehozott fájlok

- `public/assets/ui/citui.css` (4 új token) · `public/assets/ui/citui-console.css` (52 szabály)
- `src/console/views.ts` · `src/console/partnerViews.ts` · `src/console/testLogViews.ts` (23 inline)
- `scripts/console-contrast-check.mts` (ÚJ őr) · `scripts/mock-photo-gate-check.mts` (token-probe)
- `hooks/pre-commit` · `assets/design-refs/console/semantic-contrast/` (kontraktus)
- `_planning/DECISIONS.md` (ADR-0173) · `_planning/memory/INDEX.md` · `MEMORY.md`

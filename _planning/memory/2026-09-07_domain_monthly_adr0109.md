# 2026-09-07 — ADR-0109: a saját cím havi díjas + a CRM-legördülő, ami sosem látszott

## Ahogy indult: „HÁT KURVÁRA NEM"

A tulaj a Haus Elisabeth konfigurátorán nézte az éves domain-árat, és két dolgot vetett fel:
(a) az árazás logikája rossz, (b) az ADR-0102-vel a CRM alá költöztetett árazás „eltűnt".
Mindkettőben igaza volt, de egyikben sem úgy, ahogy én először hittem.

## 1. A CRM-legördülő: nem tűnt el — SOHA nem is látszott

A menü technikailag rendben volt: markup ott, CSS ott, `display:block` hover után, a
Playwright `isVisible()` igazat mondott, a kattintás a `/pricing`-re navigált. **Mégsem
festődött ki egyetlen pixel sem.**

Ok: a `.con-nav` egy vízszintesen **görgő doboz** (`overflow-x:auto`, a tulaj telefonos
fejléc-javításából, `3c670c1`), és egy overflow-os ős **levágja** az abszolút pozicionált
leszármazottat — a 36 pixeles menüsávra. Az ADR-0102 session ebbe a dobozba tette a
legördülőt, és a mockjában (ahol nincs görgő menüsor) tökéletesen működött.

**A mérés, ami eldöntötte:** `document.elementFromPoint()` a legördülő doboz KÖZEPÉN a
mögötte lévő `<p>`-t adta vissza. Ahol semmi nincs festve, ott a `getBoundingClientRect`
és a `display` számított értéke egyaránt hazudik.

Javítás: a telefon-töréspont FELETT a menüsor nem görgő doboz (`overflow:visible` +
`flex-wrap:wrap`, hogy keskeny asztali ablak se rejtsen el menüpontot). Landolva `5501bcf`.

⚠️ Mellékesen kiderült: a `scripts/ui-shot.mts` a `/` célt FÁJLNAK hiszi (`existsSync("/")`
igaz) → a gép gyökérkönyvtárának fájllistáját fotózta le, és én ebből jelentettem ki, hogy
„fent van". A bizonyítékom nem a konzolról szólt.

## 2. Az árazás: a 6 000 Ft/év-et SOHA nem a tulaj mondta ki

Session-átirat-régészet (a legfrissebbtől visszafelé) derítette ki:
- a `41be6c89` session (09-06) a tulaj hibajelzésére megépítette az élő díj-feloldást, és
  **önmagát jelentette zöldre** — a konkrét összeget és a modellt senki nem hagyta jóvá;
- a `CUSTOM_DOMAIN_YEARLY = 6900` egy **2026-07-27-i placeholder** volt („owner sets it"),
  onnan sétált a felületre, a rendelésbe és a számlába;
- a tulajnál elhangzott „hatezer forint" az átiratban a **VÉTELI ÁR-PLAFON** kontextusában
  szerepelt, nem eladási árként.

### Az új modell (ADR-0109, a tulaj szavaival)

- **1 000 Ft/hó**, nem 6 000 Ft/év. Minden számlázási ciklus tétele.
- **Belépési feltétel: 7 000 Ft/hó feletti csomag** — nem ingyen-kapu. Alatta a saját cím
  nem olcsóbb, hanem **nincs**.
- **A küszöböt a LISTAÁR dönti el, kedvezmény nem számít bele** („kedvezmények nélkül”).
  Időszakos engedmény nem vehet meg tartós jogosultságot.
- **Nincs ingyen-ág** (az ADR-0093 ② kivezetve).
- 12 hó hűség, változatlan ADR-0094 kötbér-modell (padló = 7 000, hátralévő hónapok +
  vételár CSAK ha viszi a nevet).
- **A hűség letelte után se kötbér, se csomag-padló** — csak a havidíj fut tovább.

### Amit a kód szintjén tanultunk

**A HAZUDÓ NÉV a hiba forrása, nem a hazudó érték.** A `custom_domain_yearly` és a
`domain_free_min_monthly` oszlopnév mindkettő hamis lett az új modellben, ezért ÁTNEVEZTÜK
(`custom_domain_monthly`, `domain_min_package_monthly`) — nem csak átértékeltük. Egy
placeholder pontosan azért tud a vevő képernyőjéig sétálni, mert a neve közben végig
hitelesnek látszik.

## 3. §2b kapu: C2 változat jóváhagyva

Két kör: először A/B/C (zárt kapu / feltétel-kártya / csak-ha-jár) → a tulaj **C**-t
választotta, de „sokkal szembetűnőbb" legyen. Második kör C1/C2/C3 → **C2**.
⛔ A hangsúly kerettel, ikonnal, valódi példanévvel és **haladás-sávval** született, NEM
nagyobb betűvel (`size_inflation_is_not_design`). Kontraktus:
`assets/design-refs/configurator/domain-monthly/` (plan.html + README + 2 kép).

## 4. Négy hiba, amit KIZÁRÓLAG a végigkattintás fogott meg

1. **`[hidden]` nulla specificitású** → a `.dopt { display:flex }` felülírja, a „rejtett" sor
   LÁTSZIK. Előbb a mockban, majd — külön — az ÉLES CSS-ben is. Ugyanaz a csapda kétszer.
2. **Leváló csomópont:** a kártya gombjaira kötött figyelők egy újrarajzolt szekció régi
   példányán ültek → a kattintás némán nem csinált semmit. Delegált figyelő a panelen.
3. **A saját szerkesztő-szkriptem** a `setDomainOpt` **törzsébe** injektálta a bekötést (az
   első horgony-találat oda esett) → a függvény csendben elromlott, `node --check` mégis
   zöld volt. Azóta: szintaxis-ellenőrzés + a beszúrás helyének visszaolvasása.
4. **A kapu ÁG-SORRENDJE:** a Webcím fülön a jogosultsági kaput a `st.picked` (2. lépés) ág
   ALÁ tettem → egy `?d=valami.hu` URL a nem jogosult tenantot egyenesen a „Fizetés és
   megrendelés" gombig vitte. A kapu csak akkor kapu, ha MINDEN ág fölött áll, ami
   megrendelést tud mutatni.

## 5. Amit még a nézés talált (tulaj: „nézzük meg!")

A tenant-admin **Webcím** fülén a küszöb alatti tenant a TELJES név-választó űrlapot látta,
alatta apró szürkével a feltétellel. Ez §I-sértés (bait-and-switch): felkínáltuk
megrendelésre, amit nem adnánk el neki. Most külön képernyő: feltétel + jelenlegi cím +
„Csomag bővítése" út, űrlap nélkül.

## 6. Díjcsomagok az árazás-lapon (külön tulaj-kérés)

„Legyen benne, mi az egyes díjcsomagok díja és milyen modult tartalmaznak. Szabály: ami az
alacsonyabb csomagban benne van, az benne van a magasabb csomagban is."

- A szabály **szerkezetbe kötve**: `ESSENTIALS = [...MINIMAL, …]` — egy tömb átírása nem
  tudja csendben elrontani. A legfelső szint a katalógusból számol, ezért mellette gépi őr
  fut (`configurator-price-check`), ami megnevezi, MELYIK modul esett ki MELYIK csomagból.
  Negatívan futtatva bizonyítottan piros.
- A kártyák a beágyazást **mutatják**: örökölt modulok szaggatottan/halványan, a saját
  többlet tömören („Ebben jön még").
- ⚠️ **Az ár azt mutatja, amit a vevő ténylegesen megvehet:** az eladásból kikapcsolt modul
  (ma: email) kimarad az összegből. Enélkül a lap 10 380 Ft-ot írt volna a Teljesre,
  miközben a konfigurátor 9 990-et — két képernyő, egy csomag, két ár.
- A magyar névelő-döntő (`huArticle`) kikerült a hideg levél builderéből a közös
  `src/hu.ts`-be: a konzol enélkül nyers **„a(z)"**-t írt volna, amit az ADR-0101 ① tilt.

## Landolt commitok

| commit | mit |
|---|---|
| `5501bcf` | CRM-legördülő: a görgő menüsor levágta |
| `77a273b` | ADR-0109 döntés rögzítve |
| `cbac0a4` | C2 terv jóváhagyva + befagyasztva, listaár-szabály kimondva |
| `4feb80a` | ADR-0109 implementáció (migráció, ár-mag, számlázás, konfigurátor) |
| `c800398` | Díjcsomagok blokk + beágyazási szabály + őr |
| `895db23` | Webcím fül §I-javítás + vevő-súgó a havi modellre |

## NYITVA

- A `DECISIONS.md`-ben az ADR-0093/0100 szövege részben elavult; az ADR-0109 kimondja, hogy
  felülírja őket, de a régi ADR-ekbe nem írtam vissza.
- Az `ui-shot.mts` `/` → gyökérkönyvtár félreértése javítatlan.
- Ötlet a tulajtól jövő logikából: a „UI ígéri, a szerver elutasítja" párost érdemes lenne
  géppel keresni a többi fizetős úton is.

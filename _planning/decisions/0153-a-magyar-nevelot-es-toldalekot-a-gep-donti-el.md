## ADR-0153 — A magyar névelőt és toldalékot a GÉP dönti el, nem az olvasó (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** ELFOGADVA ·
**Kapcsolódó:** ADR-0101 ① (a „a(z)"-tilalom), ADR-0144 ② (a vevő dátuma sosem gépi alakú),
ADR-0036/§B.18 (i18n), ADR-0045/§J.24 (a súgó a képernyőt idézi).

**Kiváltó (mérve, Elek FK-002 E1 · FK-005b E-11 · FK-006a/b ZAVAROS-6, 2026-09-13).** Az
ADR-0101 ① 2026-09-06 óta tiltja a „a(z)"-t, és a megoldás (`src/hu.ts › huArticle`) azóta
a kódban van — a gépi kézi-tesztelő mégis HÁROM külön körben hozta vissza. A tilalom
prózában élt: **semmi nem mérte.** Ugyanennek a hibaosztálynak a másik fele a toldalék: a
bérlői Előfizetés lap Fordulónap-cellája „minden hónap 10-a/-e"-t írt.

**A közös mag.** Mindkettőben TUDJUK a helyes alakot, csak nem számoltuk ki, és a döntést az
olvasóra hagytuk. A hibaosztály tehát nem két sztring, hanem egy MULASZTÁS — az őr ezt méri.

**Hatókör (mérve, nem a bejelentésből).** A bejelentés három helyet nevezett meg. A teljes
sweep — kis- ÉS nagybetűs alakra, mert az első grepem csak a kisbetűsre futott, és **ez maga
volt a mérési hiba** — **17 emberi felületre kerülő** előfordulást talált 15 fájlban: bérlői
admin (Fordulónap, modul-leváltás, webcím-vásárlás és -elszámolás, foglalás-naptár),
VEVŐI levél és SMS (felfüggesztés-figyelmeztetés, „a webcím elkelt", lemondás-elszámolás),
a VENDÉGNEK szállított generált oldal no-JS foglalás-kártyája, valamint operátor-felületek
és riasztó-levelek. Az őr építése közben **egy tizennyolcadik** is előkerült, másik alakban:
„melyik elrendezés(ek)re generáljuk a mockot".

**A döntés.**
① **Névelő:** ahol a mondat névelőt kér egy NÉV elé, a `huArticle()` / `huArticleLower()`
dönt, és a felirat `{art}` / `{Art}` placeholderrel megy a katalógusba (a minta a
`console/views.ts` már meglévő hívása). Idegen nyelvi csomagban a fordító eldobhatja.
② **A hónap napja:** egyetlen közös formázó, `src/text/day.ts › formatMonthDay()` — a
31 nap végződése ZÁRT TÉNY (1-je; 2/3/6/8/13/16/18/20/23/26/28/30 → „-a"; a többi „-e"),
nem heurisztika. Idegen csomag a puszta számot kapja: a toldalék magyar hangrendi szabály.
③ **⛔ Amit szándékosan NEM érint:** a `console.*` fejlesztői napló és a `throw new Error()`
kivétel-szöveg (pl. `domains/registrar/websupport.ts` 13 helye). Azt fejlesztő olvassa; a
CLAUDE.md §4 tiltja a nem kért működő kód módosítását. A határ STRUKTURÁLIS (a literál egy
`console.*` híváson belül van-e), nem kivétel-lista.

**Kapu:** `scripts/hu-machine-form-check.mts` (pre-commit: `--fast`, ~15 mp). Három réteg,
mert mindegyik ott vak, ahol a következő lát: ① a VALÓDI bejelentkezett lapok `innerText`-je
+ a vendég-oldal minden sablonja, ② a csak hibás ágon előálló VEVŐI üzenetek és a
kapu-ok-sorok, ③ statikus iker (TS-AST literálok, i18n-katalógus, migrációk ÍRT szövege, KB).

**Amit az önteszt és a piros ág hozott ki — és amit a zöld futás elrejtett volna.**
- ⛔⛔ **Az első lefedettség-tanúm ZÖLDEN VÉDTE a vakfoltot.** A körbejárás „11/11 lap
  megmérve"-t írt, a tanú a „Fordulónap" szót meg is találta — csakhogy a tenant-admin
  **SÚGÓ fülén**, a KB-cikkben: az Előfizetés kártya meg sem jelent, mert a közös parkban
  **NULLA `subscription` sor** van. A tanú ezért a termék KIMENETÉNEK alakjára illeszkedik,
  a kártyát pedig a ② réteg a VALÓDI `modulesSection()`-ből állítja elő — **mind a 31 napra
  × 2 ütemre (62 render)**, park-függetlenül és kimerítően.
- ⛔ **Az általános „zárójeles toldalék" minta a nyers forrás-literálokon 189 HAMIS leletet
  adott** — a `<script>` blokkok JS-hívásaira (`forEach(function(el){…}`). Egy őr, ami
  szigorúbban mér, mint a mért rendszer, hamis leletet gyárt: a szabály ezért csak EMBERI
  szövegen fut (renderelt lap, előállított üzenet, `T()`-argumentum).
- **Piros ág, kétszer bizonyítva:** a javítást visszarontva a `--fast` futás 190 leletet ad,
  köztük a RENDERELT kártyáról („Fordulónap minden hónap 1-a/-e"), és `bash -c 'set -e; …'`
  alatt rc=1 — vagyis a commit-kapu tényleg megáll. Negatívan is mérve: 13 helyes alak
  (`Ft/hó`, `7/24`, `be-/kikapcsolás`, `Alap/Bővített`, ISO-dátum, `Ptk. 6:78. §`) nem sül el.

- ⭐ **A LANDOLÁS MAGA BIZONYÍTOTTA A KAPUT.** A rebase egy PÁRHUZAMOS szál ugyanaznapi
  bekezdés-átírásával ütközött (`loginHelpPage`, tegezés → magázás + i18n-csomagolás) — és az
  az átírás **ÚJRA behozta a tiltott alakot**. Iker-javítás: az ő újabb, becsomagolt szövegük
  maradt, rajta az én javításommal. Pontosan ez a visszaesés az, ami ellen a kapu készült;
  kapu nélkül némán landolt volna, ugyanazon a napon, amikor javítottuk.

**A súgó együtt mozdul.** A `kb/entries/admin-subscription` és `admin-modules-booking`
idézte a régi, gépies feliratot — egy javított képernyő mellett a cikk hazudott volna
(§J.24 szelleme). Javítva ugyanebben a körben.

**Visszafordíthatóság:** 🔄 felirat- és formázás-szintű; adatmigráció nincs, a tárolt alak
változatlan.

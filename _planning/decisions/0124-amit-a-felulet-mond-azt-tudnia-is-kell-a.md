## ADR-0124 — Amit a felület MOND, azt tudnia is kell: a kurátor-lap négy néma pontja (2026-09-11)

**Kontextus.** Az Elek FK-003b kör a lead-lap kurátori felén négy mért hibát talált, és
mind ugyanannak a hibaosztálynak a példánya: **a felület állít valamit, ami nem igaz, vagy
elhallgat valamit, amit tud.** ⛔ Egyik sem „szépséghiba": a nyitókép, a mock szövege és a
jóváhagyás dönti el, mi megy ki a leadnek.

① **A nyitókép-választó VAKON döntetett.** A cián kerettel kiemelt NYITÓKÉP csempe teljesen
üres volt, a négy bélyegből hármon a böngésző törött-kép ikonja állt „nem ítélt" felirattal,
és egyedül az a kép rendelt, amelyik a `reklámbanner` címkét viselte. Mérve (`curl`,
referer-rel és anélkül): a portál (hovamenjek.hu) azóta **letörölte a fotókat, mind 404**. A
felület viszont a VERDIKT hiányáról beszélt („nem ítélt"), miközben a baj a FORRÁS volt — két
teljesen különböző állítás, és a kurátor pont a lényeget nem tudhatta: hogy ezek a képek a
LEADNEK kiküldött lapon is törötten jelennek meg.

② **A percekig futó generálás néma volt ott, ahol a kurátor néz.** A fejléc végig
„mock: approved"-ot mutatott (egy két perce meghaladott állapotot), a „folyamatban" chip a
3014 px-es lap y≈2560-ánál bujkált, eltelt idő sehol, a bukás oka pedig csak a szerver-logba
került.

③ **Ugyanaz a lap KÉT különböző listát adott ugyanarra a kérdésre.** Fent „3 dolgot nem
említ", lent „4 igazolt tény kimaradt a szövegből" — más szám ÉS részben más tételek,
ugyanabból a `marketMissed`-ből. A szöveg-panel leszűrte (amit a próza már megnevez, az nincs
kihagyva), a forrás-panel nyersen írta ki.

④ **Az előnézet felirata nem volt igaz a képre.** „A kijelölt kinézet mintája (valós adattal)"
— a képen egy MÁSIK szállás mockja („Csend és kilátás a hegy tetején"). A felirat önmagára
igaz volt, és pont ettől olvasódott a saját lead előnézeteként.

⑤ **Egy leaden két „approved" mock állt.** A jóváhagyás csak a saját sorát írta át; a lap
fejléce, a nyitókép-panel és a megkeresés viszont egyes számban gondolkodik („a jóváhagyott
mock") és `active[0]`-t vesz — vagyis a képernyő egy tetszőlegesen kiválasztott mockot nevezett
A jóváhagyottnak.

**Döntés.**

1. **A konzol kép-proxyn át tölt** (`src/console/photoProxy.ts`, `GET /photo?u=&s=`).
   Nem kényelemből: így **ugyanaz a kérés dönt, amit a felület megmér és amit a böngésző
   megjelenít**. Közvetlen `<img src>` mellett a kettő eltérhet (hotlink-védelem a referer
   alapján tilt: a szerverünk 200-at kap, a böngésző 403-at), és akkor a panel „betölthető"-t
   állítana egy törött csempe alatt. Az URL-t a nézet HMAC-kel **aláírja** — aláírás nélkül a
   konzol tetszőleges URL-t lekérő ugródeszka lenne (SSRF), operátor-munkamenet ide vagy oda.
   A proxy a SAJÁT nevünkben kér (`citoviso-bot`), nem böngészőnek álcázva: ha egy host tiltja
   a botunkat, az VALÓDI ok, amit a kurátornak látnia kell, nem valami, amit megkerülünk.
2. **A „nem ítélt" és a „nem tölthető be" két külön állítás, és mindkettő ki van írva.**
   A verdikt marad a helyén; a betöltési hiba saját, piros sort kap az OKKAL
   („Ez a kép már nincs meg a forrásnál — 404-et ad (hovamenjek.hu)."), a csempén pedig egy
   magyarázó helyettesítő kép áll, nem a böngésző törött-kép ikonja. ⚠️ A részletes ok NEM az
   SVG-be megy: 96 px-es bélyegre skálázva a betűje ~4 px, vagyis pont annyit érne, mint a
   törött ikon. **Ha van ilyen kép, összegző sor mondja ki, hogy ezek a LEADNEK kiküldött
   lapon is törötten jelennek meg** — a néma csonkítás „mindent kiszállítottunk"-nak olvasódik.
3. **A futó háttérmunka állapota a lap tetejére kerül, eltelt idővel** — jóváhagyott „A"
   változat, kontraktus: `assets/design-refs/console/gen-running/README.md`. A fejléc nem
   mondhat „approved"-ot, amíg fut; a fül lüktető pöttyöt kap; és **ugyanaz a sáv mondja el a
   bukást is, az okkal**. A `generating` Set→Map(start-idő) + TTL + kimenet-tár lett, a
   `recopying` 2026-09-07-i leckéje szerint (egy beragadt Set-elem minden későbbi POST-ot
   némán eldobott).
4. **A „mi maradt ki" listának EGY forrása van** (`views.missedAmenityGroups`), és a SZŰRT
   lista a közös igazság — a nyers azt kérné, tegyünk bele valamit, ami már benne van.
5. **A sablon-előnézet a lead SAJÁT adatát rendereli** (`GET /lead/:id/tpl-preview`), AI és
   DB-írás nélkül, a meglévő pillanatképből. Pillanatkép hiányában marad a minta-kép, de a
   felirat KIMONDJA, hogy másik szállás mintája.
6. **Leadenként egy jóváhagyott mock.** Jóváhagyáskor a többi approved visszakerül
   `generated`-be, naplózva (`curator_decision`, `superseded_by:`), és a felület kimondja.
   ⚠️ Kivéve, amit **már kiküldtünk** — a mérce a `prospect.sent_at`, nem a prospect-sor
   létezése: mérve mindkét duplikátum alatt ült egy prospect-sor, de egyik sem ment ki, és egy
   meg nem írt levél nem „megajánlott ajánlat". A meglévő párokat a `0064` migráció bontja fel.
   **Nincs unique index:** a §I-kivétel miatt két approved legálisan is együtt élhet (egy
   kiküldött + egy új), és egy vak megszorítás ilyenkor magát a jóváhagyást utasítaná el.

**Őrök (mindkettő negatív kontrollal, pre-commitban):**
`scripts/missed-list-check.mts` a **KIRENDERELT lapból** szedi ki mindkét listát — nem a közös
segédfüggvény kétszeri hívásából, mert az önmagával hasonlítaná össze magát, és akkor is zöld
lenne, ha az egyik panel visszatérne a nyers listához. Élesben mérve: a hibát visszaállítva
7 leadből 6 pirosra vált. `scripts/one-approved-check.mts` a nem-kiküldött approved többletet
méri. ⚠️ A `missed-list-check` első önteszt-fixture-je egyszerűsített markupot használt, és a
mérő emiatt csak az ELSŐ chipet látta — a negatív kontroll a ROSSZ okból lett volna piros; a
fixture azóta a valódi markupot állítja elő.

**Következmény.** A kép-proxy ÚJ hálózati út a konzolban (aláírt, operátor-mögötti,
cache-elt); a lead-lap egy kérésnyivel többet indít (`photo-health`), de a lap-render nem vár
rá. A `curateArtifact` visszatérési értéke megváltozott (`{ superseded }`).

**Visszafordíthatóság:** 🔄 — felület- és kapu-szintű; az egyetlen adat-mozdulat a `0064`
státusz-visszaminősítés, ami kézzel visszaadható.

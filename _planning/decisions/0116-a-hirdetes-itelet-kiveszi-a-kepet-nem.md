## ADR-0116 — A HIRDETÉS-ÍTÉLET KIVESZI A KÉPET, NEM HÁTRASOROLJA (2026-09-11)

**Státusz:** ELFOGADVA · **Kód:** ÉL lokálban · **Élesítve:** NINCS (§0.3)

**Kontextus — a tudás megvolt, mégis kiment.** A kiszállított `ELEK-TESZT` tenant-lapon egy
másik cég reklámbannere ült (Mirabella Camping, `balaton.hu/…/MIR_640_360.png`, a cég neve
MAGÁRA A KÉPRE égetve) KÉT helyen: a galériában `alt="<a szállás neve> … fotó 2"` felirattal,
és a JSON-LD `image` tömbjében — vagyis a Google felé is a szállás képeként. A nyitókép
védve volt; ez nem hero-hiba.

⚠️ **A legfontosabb tanulság nem a szabály, hanem hogy MIÉRT NEM FUTOTT.** Két külön ok, és
mindkettő visszatérő házi hibaminta:

**① A zöld teszt egy MÁSIK forgatókönyvet mért.** A `photo-quality-check.mts` pontosan erre az
esetre volt zöld, szó szerint a „Mirabella-banner" szóval — csak `portalHost: "szalas.hu"`-t adva
a balaton.hu-s képhez (idegen bannert ágyazó szalas.hu-s adatlap). A VALÓS adatban viszont a
profil MAGÁRÓL a balaton.hu-ról jött: kép-host === portál-host, tehát a cross-site szabály
**szerkezetileg nem tud tüzelni**. A teszt a saját forgatókönyvére IGAZ volt — az sosem állt elő.
A fixture neve („Mirabella-banner") elhitette mindenkivel, hogy az eset le van fedve.
→ **A kapu ott mérjen, ahol az adat TÉNYLEG kimegy.**

**② A megvett tudást eldobtuk.** A látás 2026-09-09 óta HELYESEN ítélte `ad_banner`-nek
(score 0, indok: „a képre szöveg és logó van ráégetve … amely reklám"), és az ítélet ott ült a
`photo_hero_score` cache-ben. A `NEVER_HERO` viszont szándékosan csak HÁTRASOROL — a kód
kommentje ki is mondta: „(A kép a galériában marad — csak hátulra kerül.)" Fizettünk a
válaszért, majd a lap aljára tettük a hirdetést és kiszállítottuk.

**Döntés ① — két külön halmaz, két külön kérdés.**
- `NEVER_HERO` = „ez ne a lap teteje legyen" (budi, parkoló). A szállásé, csak nem kirakat →
  **marad, hátul.**
- `NEVER_SHOWN` = „ez NEM EZÉ A SZÁLLÁSÉ" (ma egyedül az `ad_banner`) → **kiesik a fotó-halmazból.**
  Nem sorrend kérdése: semmilyen sorrendben nem igaz róla, hogy a szállás fotója.

⛔ Szándékosan SZŰK. A „ráégetett feliratú, de SAJÁT épület" (pl. `VILLA PÁTZAY PANZIÓ` tábla)
`exterior` marad alacsony pontszámmal: az a szállásé, tehát hátrasorolandó, NEM eldobandó —
a szűrés nem vehet el valódi szállás-fotót (mérve: az ELEK-lap 4 hovamenjek.hu-s képe maradt).
**Verdikt nélkül a kép MARAD:** a mi kimaradásunk (nincs kulcs, hálózati hiba) nem lelet a fotóról.

**Döntés ② — a kizárás EGY halmazon dől el, négy úton kikényszerítve.** A fotó-lista a közös
igazság: ha ott nincs benne, egyik felület sem tudja kirakni (galéria, JSON-LD `image`,
og:image, szoba-kártya, egység-aloldal, e-mail-grounding). Mérve: a fotók NÉGY úton érnek a
lapra, és a generálás-idejű szűrés magában hármat kihagyott volna — a `mock_artifact.inputs.siteData`
**befagyott lista**, amit az élesítés és a tenant-admin újrarenderel:
`generate.ts` (generálás) · `provision.ts` (élesítés) · `tenant/editor.ts::assembleEffective`
(tenant-mentés ÉS a tulaj előnézete) · `heroOverride.ts` (operátori újrarendezés).
A pillanatkép-utak CACHE-ből olvassák az ítéletet — ingyen, hálózat és API-hívás nélkül.

**Döntés ③ — a szűrő-ablak a KISZÁLLÍTOTT halmazhoz igazodik (költség-növekedés vállalva).**
A `HERO_SCORE_CAP` 12 volt, mert a verdikt csak a sorrendet döntötte el („a hero úgyis az
élmezőnyből kerül ki"). Amint a verdikt azt is eldönti, hogy a kép LÁTSZIK-E, a 12 kevés:
a nem-nézett kép nem semleges, hanem **szűretlen**. Mérve a mock-korpuszon: 61 pillanatképből
**23 (38%) 16 fotót visz**, vagyis a 13–16. helyen ülő banner sosem kapott volna ítéletet.
Új érték: **24** (= `PORTAL_PHOTO_CAP`, a galéria felső korlátja). Ára ~$0,0177 → ~$0,035/lead
(egy batch, cache-elve másodszor ingyen) — egy idegen cég reklámja a fizető ügyfél lapján
ennél többe kerül.

**Enforce — `scripts/ad-banner-render-check.mts`, a KISZÁLLÍTOTT fájlon.** Végigmegy a
`sites/**` alatti HTML-eken (fő lap, nyelvi változatok, egység-aloldalak), kiszedi MINDEN
csatorna kép-URL-jét (`<img src>`, `srcset`, `og:image`/`twitter:image`, CSS `url()`, JSON-LD
`image`/`logo`/`photo`/`thumbnailUrl`), és a `photo_hero_score` `ad_banner` sorai ellen méri.
Két beépített önkontroll, mert **egy vak őr is zöld**: ① negatív önteszt (a kivonatnak a saját
próba-HTML-ből galériából ÉS JSON-LD-ből is elő kell ásnia a képet), ② csatorna-számláló —
ha a korpuszban nem talál sem galéria-képet, sem JSON-LD image-et, **BUKIK**, mert akkor a
„nincs hirdetés" állítás megalapozatlan. Mérve: 81 HTML · 995 kép-hivatkozás ·
524 galéria / 361 JSON-LD / 66 og:image / 44 CSS.
**Negatívan futtatva:** a javítást szándékosan visszarontva a javított lapon újra megjelent a
banner mindkét csatornán, és az őr pirosra ment (exit 1) — majd visszaállítva zöld.

**Nyitva:** ① a `photo_hero_score` `subject` mezője ma csak az `ad_banner`-t használja
kizárásra — ha a látás új „nem a szállásé" kategóriát kap (pl. `stock_photo`), az ide jön;
② a 24-es ablakon TÚLI kép (ha valaha lesz 24-nél több kiszállított fotó) továbbra is
szűretlen — a `PORTAL_PHOTO_CAP` és a szűrő-ablak együtt mozogjon.

# 2026-09-09 — Mozgás-réteg (ADR-0115) + három új sablon a referencia-oldalakból

## Miből indult
A tulaj három referencia-honlapot küldött minőség-mércének — lasalaplazahotel.com,
palazzosogni.com, thebendclub.com —, és kimondta: „ami fontos és nálunk konkrétan
sehol nincs: ANIMÁLÁS". Mérve igaza volt: a 16 korábbi sablonból hétnek volt egyetlen
dísz-`@keyframes`-e, görgetés-vezérelt felfedés SEHOL.

## Mi készült el (main-en, ÉLESÍTVE NINCS — §0.3)
- **`src/engine/motion.ts`** — deklaratív mozgás-réteg: `data-cit-motion` horog +
  ~40 soros motor, külső könyvtár nélkül. Két nyitány-fajta: a névből növő kép
  (0,6×, elmosásos képváltás) és a halk névfelirat. **Tíz fail-safe szabály**, mind
  valódi mért hibából, a fájl fejlécében indokolva.
- **Három sablon**: `tilted-gallery` (Lasala), `arch-frames` (Palazzo),
  `wordmark-grow` (Bend) — saját fejléccel, saját nyitánnyal, saját modul-elrendezéssel.
- **Kapuk**: `template-pick-check`, `template-diversity-check` (pixel, önkontrollal),
  `template-preview.mts` (bármely sablon valós lead tárolt adatán).
- **ADR-0115** a `DECISIONS.md`-ben.

## ⛔ A nap fő tanulsága — a tulaj dühe jogos volt
A jóváhagyott vázlatokat **a motor meglévő közös vázába erőltettem**: közös
`mastheadHtml()`, közös szekció-sorrend, és — miután ő az „elmosás + 0,6"-ot
jóváhagyta — ugyanaz az intro mind a háromban. Ettől **az első ~6 másodperc
identikus** lett, a lapok 69–84%-a pedig amúgy is közös modul-blokk. A tulaj
egyetlen dizájnnak látta a hármat, és a düh a szívklinikáig fajult.
A rendszer szabályát a jóváhagyott terv fölé helyeztem, és ezt nem kérdeztem meg.

Javítva: három külön fejléc, három külön nyitány (nincs overlay / halk névfelirat /
névből növő), a NÉV visszakerült mindhárom heróba, a névtördelés a szóköznél vág,
és az intro a sablon saját hero-képén áll meg.

## ⛔ A második tanulság: a saját őröm vak volt
A `template-diversity-check` először 24×16-os szürkeárnyalatos bélyegképeket
hasonlított. Az elrendezést láthatóan átírtam, a szám 90,8%-ról 90,6%-ra mozdult.
64×40 + `normalise()` érzékeny rá (66–77%), és kapott **önkontrollt**: ugyanaz a
sablon önmagával 100% — enélkül alatta minden szám értelmetlen.

## Kapu-leletek (mind gépi őr fogta, nem a szemem)
nyelvváltó takarva mobilon · vendégvélemény-modul nem jutott el az oldalra ·
hiányzó galéria- és szoba-horgony (a konfigurátor minta-kártyát injektált) ·
hiányzó `--cit-modsec-*` tokenek · a `centredModsecCss` a body-osztályra köt
(elgépelt osztálynév → némán nem fogott) · hero-kontraszt 1,11:1 (az introt mérte,
nem a fotót) · üres boltívek az előnézeti képen (fullPage a görgetés előtt) ·
`[hidden]` + `display` ütközés · clip-path deadlock (a rejtés blokkolta a saját
felfedését) · reflow nélkül nem futott átmenet.

## Nyitott
1. **A boltíves nyitány nincs jóváhagyva** — a palazzo-vázlat HTML-je elveszett a
   `_drafts` takarításból (ADR-0077), a tulaj sem találta; mérésből rekonstruáltam.
2. A lap **69–84%-a közös modul** → a lapok közepe hasonló marad; a rács és a
   szedéstükör már sablon-függő, a tartalom nem.
3. Az intro hossza élesben (0,6× ≈ 5,8 mp) hideg megkeresésnél sok lehet.
4. `heroPhoto()` nem tud „fekvő képet előnyben" — a `SiteData.Photo` nem hordoz
   méretet (a portál-rekordban megvan).
5. A mozgás-réteg a régi 16 sablont nem érinti (opt-in).

## ⚠️ ADR-sorszám
Az **ADR-0111 közben elkelt** (PIAC-KAPU, párhuzamos szál), a legmagasabb 0114 volt
→ ADR-**0115**. Hat fájlban kellett átszámozni; a piac-kapu tíz fájlja érintetlen.
A `git fetch` utáni, közvetlenül írás előtti ellenőrzés fogta meg.

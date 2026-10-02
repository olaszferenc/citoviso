# Sablon-szöveg és fotó-feliratok — újság-KINÉZET, szállás-SZÖVEG (SZ-3 „A” + L-3 „2”)

**Jóváhagyva:** 2026-10-02 (tulajdonosi döntés a koordinátoron át: „egyetértek”), §2b terv-kapu.
Változatok: SZ-3 0 / **A** / B / C, L-3 0 / 1 / **2**, a valódi Muschel (élesről olvasva) és Három Huszár mockon.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** Döntés: ADR-XXXX. Forrás-lelet: Elek élesi jelentése (2026-10-01), SZ-3, SZ-6, L-3.

A tulaj mércéje: „Hol írnám ki ilyet egy honlapra? Nincs normális ember, aki ilyet kiír.” — egy valódi panzió oldala.

| fájl | mi ez |
|---|---|
| `terv.html` | a jóváhagyott, működő terv: SZ-3 (0/A/B) és L-3 (0/1/2) változatváltóval, Mobil/Asztali váltóval; a változatokat a `m3-variant.js` futtatja a valódi Három Huszár mockon (`huszar.html`) |
| `editorial-mobil.png` · `editorial-asztali.png` | a MEGVALÓSÍTOTT editorial (menü, nyitókép, cikk, foglaló-blokk, lábléc) a Három Huszár tárolt adatából renderelve |
| `feliratok-mobil.png` · `feliratok-asztali.png` | a megvalósított galériák: editorial, brutalism, artdeco, dark-luxury |
| `terv-elotte-utana-mobil.png` | a döntési kör képe: ma ↔ A (menü, foglaló-blokk, szakasz-fejléc, lábléc) |
| `terv-feliratok-0-1-2-mobil.png` | a döntési kör képe: a három felirat-változat |

---

## Amit a terv KÖT

### ① Editorial: a kinézet marad, a szavak egy szállásé (SZ-3 „A”)
- Az újság-kinézet MARAD: vonalak közti fejléc, nagy talpas cím, polaroid-galéria, szaggatott keretes foglaló-blokk.
- Menü és lábléc: **„Szolgáltatások”** · **„Képek”** · **„Vélemények”**; a lábléc oszlopai **„Az oldalon”** és **„Elérhetőség”**.
- NINCS: „Szerkesztőség”, „Rovatok”, „Képes krónika”, „Vezércikk”, „No. 1/2/3” szakasz-szám, „Foglalási szelvény”,
  „Nyomtatva a világhálón”, „Levelek a vendégkönyvből”.
- A főcím NEM idézet: idézőjel nélkül áll (senki nem mondta). A valódi vendég-vélemény idézőjele marad.
- NINCS díszbetű (`::first-letter`): a lebegő első betű az „A Muschel…” szöveget „AMuschel”-lé olvasztotta
  képernyőolvasón és másoláskor — és minden editorial mock „A …” szóval kezdődött.
- A foglaló-blokk címe **„Szabad szoba kérése”**; a blokkon belüli második „Foglalás” cím nem látszik.
- **„A ház számokban”** csak KÉT vagy több szám fölött áll; egyetlen értékelés-szám cím nélkül, magában.
- Ha a recept nem ad felső sort, a cikk felett **„A házról”** áll.
- A vélemény-kártyákon NINCS csillagsor (a vélemény nem hordoz saját értékelést); az átlag sora EGYSZER áll, a
  vélemény-szakasz címe alatt, a valódi értékelés mellett.

### ② Fotó-felirat: csak ha mond valamit, és sosem a képen (L-3 „2”)
- Az `alt` MINDIG marad az `<img>`-en (akadálymentesség). Látható felirat csak akkor van, ha mond valamit:
  - a gépi „‹név› — N. kép” nem látszik;
  - a csak a nevet, a települést, a szállás típusát vagy a csillagot ismétlő forrás-felirat
    („Suzy 3*”, „Három Huszár Köveskal Vendégház Köveskál”) sem látszik.
- Ha marad felirat, a kép ALATT áll, nem a kép alsó negyedén (az editorial nyitóképén eddig rajta ült).
- Hatókör: editorial, brutalism, artdeco, dark-luxury, és a recept nélküli régi út két galériája
  (kontakt-lap: felirat a kép alatt; teljes szélességű sáv: látható felirat nincs, az `aria-label` marad).
- Egy szabály, egy helyen: `src/engine/photoCaption.ts`.

## Amit a terv NEM köt
- Az AI-írta szöveg (felső sor, cím, bevezető — pl. a tegező „AMIT ITT KAPSZ”): azt a vendég-kritikus javítja (ADR-0292).
- A többi 18 sablon játék-szövege, csillagsora és az archFrames vélemény-címe: az M4 szál (ugyanabban az őrben).

## Őrök
- `scripts/template-copy-check.mts` — a sablon-szöveg EGY őre (M3 editorial + M4 szakasz): a renderelt editorial (3 arculat ×
  mock/éles), piros ikrekkel; a csillagsorok száma 1 és 3 véleménnyel azonos.
- `scripts/photo-caption-check.mts` — mind a 19 sablon + a primitív galériák szövege; Chromiumban 390 és 1280 px-en a
  felirat doboza nem fedi a fotóét; piros ikrekkel.

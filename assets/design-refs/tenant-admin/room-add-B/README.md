# KONTRAKTUS — új szoba felvétele: a döntés a gomb mellett, a néma „Hozzáadás” megszűnik (B)

**Jóváhagyta:** a tulaj, 2026-09-28 („①B + szoba mindenhol”) · **Változat:** **B** — a kérdés a
gomb fölött, az új szoba űrlapja alapból csukva (az A: ugyanez nyitva; a C: a kérdés fent marad —
elvetve) · **Terv:** `plan.html` (a MAI képernyőre rakott változatok, kattintható; a jóváhagyott
a „B” gomb) · **Képek:** `terv-mobil.png`, `terv-asztali.png`, `terv-mobil-hiba.png` ·
**Hatókör:** `src/server/moduleConfigViews.ts` · `src/server/adminViews.ts` · `src/server/bookingViews.ts` ·
**Őr:** `scripts/room-add-form-check.mts`.

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A terv képein még „egység”
szerepel: a tulaj ugyanebben a döntésben kérte, hogy a tenant-admin MINDEN felirata „szobát”
mondjon (lásd lent) — a megvalósítás és az alábbi idézetek már az új szót viselik.

## Kiváltó ok (mérve, éjszakai kör FK-013, 2026-09-27)
Egy szobánál (a vásárláskor létrejött „A szállás egésze”) a KÖTELEZŐ „egész szállás?” kérdés a
mezők FÖLÖTT, 390 px-en a képernyőn kívül állt: a tulaj kitöltötte a nevet, a férőhelyet, az
árat, megnyomta a „Hozzáadás”-t — és nem történt semmi. A lapon két hasonló űrlap állt egymás
alatt, az első kísérlet a meglévőbe írt.

## KÖT
1. **Egy űrlap látszik nyitáskor.** Az új szoba űrlapja egy szaggatott keretes sávba van csukva:
   **„Új szoba felvétele”**. Koppintásra kiemelt dobozként nyílik (cián keret), a fejlécében
   ugyanez a cím, alatta: **„Adja meg a nevét, férőhelyét és alapárát — a vendég a honlapon külön
   kártyán látja.”** Ugyanez a komponens a Szobák képernyőn (egy és több szobánál) és a Foglalás
   képernyőn.
2. **A meglévő sor felirattal áll:** **„Meglévő szobája”** / **„Meglévő szobái”**.
3. **Minden döntés a mezők UTÁN, a gomb FÖLÖTT:** név · férőhely · alapár · „Nem adok meg árat”
   pipa · (egy szobánál) az „Az egész szállást is kiadja egyben?” kérdés · **„Hozzáadás”**.
4. **Hiányzó döntés = kimondott hiba, nem csend:** a gomb alatt piros sor —
   **„Még egy döntés hiányzik: kiadja-e az egész szállást egyben is? Válasszon, és nyomja meg újra a „Hozzáadás”-t.”**
   —, a kérdés pirosan kiemelve, és a lap odagörget. Mentés-kérés NEM megy ki. Választásra a sor
   eltűnik.
5. **JS nélkül** a rádió `required` marad (a böngésző saját jelzése); JS-sel az `invalid` eseményt
   vesszük át, így a többi mező natív ellenőrzése (férőhely 1–50) megmarad.

## Felirat-csere (tulaj, 2026-09-28) — „egység” → „szoba”
A tenant-admin Szobák, Foglalás, Árak és Fotók felületén, a hibaüzenetekben és a visszajelzésekben
(pl. **„Szoba törlése”**, **„Melyik szobához?”**, **„Másik szoba foglalása”**). A tulaj tudatosan
vállalta: a termék iparág-agnosztikus, egy kempingnek a „szoba” idegen lehet — a szállás-típushoz
igazodó szó később ráépíthető. ⚠️ A 6 nyelvi csomag (de/en/hr/it/pl/sk) érintett szövegei a
cserétől a **nagy deploy előtti újrafordításig magyarul** jelennek meg (a tulaj döntése: „deploynál
csak”) — deploy-lista tétel.

## Nem része
A vendég-oldal szövegei (pl. a szoba-aloldal „Amit ez az egység kínál” címe) — azokat a
`hu-voice-check` őrzi, és ez a döntés nem érintette őket.

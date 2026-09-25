# KONTRAKTUS — az „egész szállás” VÁLASZTHATÓ egység (B változat)

**Jóváhagyta:** a tulaj, 2026-09-25 (§2b terv-jóváhagyási kapu; a tulaj szava: „B) … igen jó ötlet.
Mehet így”) · **Változat:** **B — külön kártya a rács fölött** (az A — pipa a szerkesztő Alapok
lapján — elvetve) · **Terv:** `plan.html` (önhordó, kattintható, MŰKÖDIK; a jóváhagyott D
szoba-szerkesztőből származtatva) · **Képek:** `B-mobil-*.png`, `B-asztali-*.png` ·
**ADR:** ADR-XXXX · **Hatókör:** `src/tenant/units.ts` · `src/server/moduleConfigViews.ts` ·
`src/server/public.ts` · `src/tenant/editor.ts` · **Őr:** `scripts/whole-property-choice-check.mts`.

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.**

## KÖT

1. **Egy egységnél a fogalom láthatatlan:** nincs kártya, nincs „az egész ház” a rácson, a felugró
   fejlécében és a vendég szoba-kártyáján; az utolsó egység nem törölhető (a gomb sincs).
2. **A 2. egység felvételekor kérdés** — a felvevő űrlapban (Szobák ÉS Foglalás képernyő), KÖTELEZŐ
   rádió: „Az egész szállást is kiadja egyben?” · „Igen, az egészet is kiadom egyben” · „Nem, csak
   külön egységeket adok ki”. Mindkét válasz kimondja a következményt. *(A terv felugróként
   mutatta; a termékben az űrlap része, mert az a JS nélküli út — a döntés pillanata ugyanaz.)*
3. **Kártya a rács fölött, 2+ egységnél:** „Az egész szállás egyben” — kapcsoló „Kiadom egyben is” +
   „melyik egység” választó + „Mentés”. Bekapcsolva a szöveg megnevezi az egységet ÉS a
   következményt; kikapcsolva kimondja, hogy a szobák függetlenek. *(A tervben azonnali JS-mentés;
   a termékben form + Mentés gomb, JS nélkül is működik.)*
4. **Bármely egység törölhető** (az egész is) a felugró lábazatában — kivéve az utolsót és az
   elfogadott jövőbeli foglalással bírót (a valódi szöveggel). A törlés arra a képernyőre tér
   vissza, ahol a gomb volt.
5. **Felszereltség a szobánál:** minden tétel kapcsolható; a ház egészénél is bejelölt tétel „a ház
   egészénél is” címkét visel — tájékoztatás, nem zárolás.
6. **Ár:** az egész szállás saját ára; az Árak lapon alatta tulaj-oldali tájékoztató szumma
   („Tájékoztatásul: a szobák külön, együtt X / éj. … Az egész szállás ára ettől független — azt Ön
   adja meg.”), a vendég-lapon SOHA.

## Reprodukció

`python3 assets/design-refs/_drafts/build-egesz-haz.py` (a `room-editor/plan.html`-ből), majd
`npx tsx assets/design-refs/_drafts/check-egesz-haz.mts` (39 állítás × 2 méret, a képek innen).

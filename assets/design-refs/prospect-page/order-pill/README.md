# „Itt rendelheti meg” — a lead-lap rendelő gombja (JÓVÁHAGYOTT TERV, 2026-09-26)

A tulaj bejelentése (2026-09-26 20:02, telefonról, Három Huszár mock): az „állítsa össze” gomb
néha eltűnik, és a színe egyezik a mock saját gombjáéval, ezért nem feltűnő. A §2b terv-körben a tulaj
a **B** változatot választotta, és a gomb helyének **a Foglalás-sáv fölött**-et (kérdőív, 2026-09-26 este;
egy korábbi, azonos tartalmú válasz tévedésből a koordinátortól jött — a tulaj utána maga erősítette meg).
Döntés: ADR-0242. Kód: `assets/runtime/cit-configurator.js` + `.css` (`.cit-cfg-launch`).

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css`

Kattintható terv: `plan.html` (stílus-, méret- és süti-sáv-váltó; a gomb állapotai és színszabálya működnek).

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Felirat:** ~~„Itt rendelheti meg”~~ → **FELÜLÍRVA (2026-10-27, ADR-XXXX):** „Árak és rendelés” + „havi X Ft-tól”, lásd `../arak-gomb/`. A többi pont változatlanul köt.
2. **Mindig kint van**, kivéve, amíg a rendelő-panel nyitva van (ott a panel a lényeg), és amíg a
   döntés-segítő kártya fátyla takarja (annak saját „Megrendelem” gombja van).
   - betöltés: azonnal, 0,3 mp-es beúszással (nem 2,6 mp / első görgetés);
   - lecsukás (fül, mellé-koppintás, Esc) UTÁN visszajön, és UGYANAZT az összeállítást nyitja meg;
     lecsukott állapotban a perem-fül rejtve van (telefonon a gomb alá került volna);
   - bezárás (X) után is kint van.
3. **Szín (B):** soha nem a sablon akcentje (az a mock saját gombjának színe). Platform-cián
   (`#1fb6d6`, sötét felirat, a `--citui-cyan-500`/`--citui-accent-ink` tükre), fehér peremmel és
   pulzáló gyűrűvel; ha a sablon akcentje a ciánhoz 45°-on belül van a színkörön (pl. claymorphism,
   wordmark-grow), **lila** (`#6d4aff`, fehér felirat). A szöveg kontrasztja ≥ 4,5:1.
4. **Hely:** az alsó éle a képernyő aljához rögzített legfelső réteg (a sablon Foglalás-sávja,
   süti-sáv) fölött ül, 10 px réssel. A lappal együtt mozgó gombok fölé NEM mászik fel.
   Ha egy ilyen fő gomb kerülne alá, **oldalt vált** (telefon: jobb → bal; asztal: közép → jobb →
   bal); csak ha minden oldal foglalt, akkor lép feljebb (régi kikerülés). A fő gombot sosem temeti
   be (Elek FK-004b H-3, őr: `lead-page-surface-check` ②).
   A Foglalás-sáv a süti-sávra rétegződik (`bottom: var(--citui-consent-h)`): a pirula mindkettő fölött ül.
   Őr: `lead-mobile-check` R8 (a koppintás pillanatában a pirula egyetlen rögzített alsó réteget sem fed át;
   piros önteszt: a sáv-érzékelés kivágva).
5. Telefonon (≤ 560 px) a jobb sarokban, asztalon középen. **Fekvő telefonon** (≤ 500 px magas, fekvő
   képernyő, pl. 844×390) a jobb alsó sarokban, telefonos méretben (ADR-0377, a tulaj „A” döntése,
   2026-09-29; addig az asztali közép-hely miatt nyugalomban is a hős-címre ült).
6. **A hős-címre nem ül — sehol** (ADR-0377 + ADR-0382, tulaj 2026-10-13: „csináld úgy, hogy jó legyen”):
   minden méreten és állapotban (fekvő, álló, asztali; nyugalomban és süti-sávval) a hős-cím (`h1`) és a
   mellette álló bekezdések SZAVAI akadálynak számítanak, mint egy gomb (a sorköz nem; a betűktől álló
   telefonon és asztalon 6, fekvőn 3 px rés). A pár először oldalt vált (4. pont), aztán a szavak FÖLÉ lép,
   alájuk soha.
7. **Fejlécre és gombra nem tolja a cím-kitérés** (ADR-0382): a fölfelé lépés határa a keretező sáv
   („Ez egy honlap-terv…”) alja és a fejléc LÁTHATÓ vezérlőinek alja (menü-gomb, logó-link SZÖVEGE — a
   link üres doboza nem). Ha a cím fölött nincs hely, a pár a 4. pont helyén marad (a gomb-szabály
   sarka / helye); ha csak néhány pixel hiányzik, a határra áll, ha így a cím résébe legfeljebb 6 px-t
   ér bele, és gombot nem takar.
   Őr: `mock-trial-overlay-check` ⑪ — 21 sablon × fekvő / álló / asztali × nyugalom / süti-sáv: a cím
   betűin nem ül, a keretező sáv alatt marad, hős-gombot nem temet be (fekvőn: jobb sarok); a javítás
   nélküli runtime-on piros.
8. **A hős-képváltó jelzőire sem ül** (ADR-0383): a képváltó jelzősora (legalább két szöveg nélküli kis
   vezérlő egymás mellett, pl. a cinematic három csíkja) akadály, mint egy gomb — a pár oldalt vált vagy
   fölé lép, a 6–7. pont szabályai szerint.
   Őr: `mock-trial-overlay-check` ⑪ — minden sablon × fekvő / álló / asztali × nyugalom / süti-sáv: a pár
   nem metszi a jelzősort; a javítás nélküli runtime-on piros.

## Képek

- `plan-mobil-betoltes.jpg`, `plan-mobil-lecsukva.jpg`, `plan-asztali-betoltes.jpg`: a terv-kör
  tablói (sorok: A / B / C változat, oszlopok: 5 stílus). **B a jóváhagyott.**
- `plan-kozeli-B-valasztva.jpg`: dark-luxury A·B·C, claymorphism A·B, közelről. A claymorphismon
  látszik, miért kell a B: az A cián összecsúszik a türkiz „Foglalás” gombbal.
- A terv-körben a dark-luxury-n a gomb még a hős-gombok fölé, a szövegre mászott; ezt a 4. pont
  váltotta le („a Foglalás-sáv fölé tedd”).

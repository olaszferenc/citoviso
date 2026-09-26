# „Itt rendelheti meg” — a lead-lap rendelő gombja (JÓVÁHAGYOTT TERV, 2026-09-26)

A tulaj bejelentése (2026-09-26 20:02, telefonról, Három Huszár mock): az „állítsa össze” gomb
néha eltűnik, és a színe egyezik a mock saját gombjáéval, ezért nem feltűnő. A §2b terv-körben a tulaj
a **B** változatot választotta, és a gomb helyének **a Foglalás-sáv fölött**-et (kérdőív, 2026-09-26 este;
egy korábbi, azonos tartalmú válasz tévedésből a koordinátortól jött — a tulaj utána maga erősítette meg).
Döntés: ADR-XXXX. Kód: `assets/runtime/cit-configurator.js` + `.css` (`.cit-cfg-launch`).

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css`

Kattintható terv: `plan.html` (stílus-, méret- és süti-sáv-váltó; a gomb állapotai és színszabálya működnek).

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **Felirat:** **„Itt rendelheti meg”** (aria: **„Itt rendelheti meg a saját weboldalát”**), `tr()`-rel.
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
5. Telefonon (≤ 560 px) a jobb sarokban, asztalon középen. A fekvő telefonra is áll (844×390).

## Képek

- `plan-mobil-betoltes.jpg`, `plan-mobil-lecsukva.jpg`, `plan-asztali-betoltes.jpg`: a terv-kör
  tablói (sorok: A / B / C változat, oszlopok: 5 stílus). **B a jóváhagyott.**
- `plan-kozeli-B-valasztva.jpg`: dark-luxury A·B·C, claymorphism A·B, közelről. A claymorphismon
  látszik, miért kell a B: az A cián összecsúszik a türkiz „Foglalás” gombbal.
- A terv-körben a dark-luxury-n a gomb még a hős-gombok fölé, a szövegre mászott; ezt a 4. pont
  váltotta le („a Foglalás-sáv fölé tedd”).

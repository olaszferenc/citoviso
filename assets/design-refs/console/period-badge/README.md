# Kontraktus — Havi az alapértelmezett + markáns „2 hó ingyen” jelvény

**Jóváhagyva:** tulaj, 2026-09-23 — a **C változat** (csillanó jelvény forintos megtakarítással).
**Kiváltó:** tulajdonosi kérés a Villa Suzy Zamárdi konfigurátor-képernyőképén: „itt legyen a havi
fizetés az alapértelmezett… és a 2 hó ingyen legyen markánsabb hirdetés, akár animált is”.
Döntés: ADR-0211 (felülírja az ADR-0090 ② „az éves marad az alapértelmezett” mondatát).

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **A Havi az alapértelmezett kiválasztás** az 1. lépés `.cit-cfg-permat` váltóján (és így a 3. lépés
   `.cit-cfg-period3` váltóján is — egy `period` állapot hajtja mindkettőt). Az Éves egy kattintás.
2. **A jelvény a PÉNZT mondja:** `−{megtakarítás} · {n} hó ingyen`, ahol a megtakarítás =
   havi listaár × `annualFreeMonths` (a kiválasztott szekciókból, modul-kapcsoláskor frissül;
   a domain-díj nem része — az ingyen hónap a szolgáltatásunkra szól, ADR-0109 ⑥).
   `annualFreeMonths = 0` esetén NINCS jelvény és nincs „áráért” sor (nem hirdetünk nullát).
3. **Mozgás:** a jelvényen ~3 mp-enként végigfutó fénycsík + ~5 mp-enként apró billenés.
   `prefers-reduced-motion: reduce` esetén MINDEN animáció áll.
4. **Az Éves kártya zöld keretet visel** kiválasztatlanul is; kiválasztva a közös kék `--on` jelölés.
5. **„Áráért” sor az Éves kártyán:** keskeny panelen (telefon) `{12−n} hónap áráért 12`;
   széles panelen (asztali oldalsáv) kiegészül az éves listaárral (`— {éves ár}/év`). A váltás a
   váltó SAJÁT szélességéhez kötött (`@container`), nem az ablakhoz.
6. **Éves választásnál** az összeg-kártya megnevezi a megtakarítást forintban.
7. A jelvény nem takarja a kártya feliratát (a kártyák felső belső térköze helyet ad neki).

## Referencia
`plan.html` — a három vizsgált változat (A pulzáló · B szalag · **C a kötelező**), Mobil/Asztali váltóval.
⚠️ A vázlatban az asztali „széles” sor a színpad szélességére kapcsolt; az élő panelben a váltó
saját szélessége dönt (asztali oldalsáv ≈ 404 px → széles, telefon ≈ 354 px → keskeny).

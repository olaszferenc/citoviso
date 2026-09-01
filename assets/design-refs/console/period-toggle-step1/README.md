# Kontraktus — Havi/Éves fizetés-váltó az 1. lépésen

**Jóváhagyva:** tulaj, 2026-09-01 — a **B változat** (kártyás választó).
**Kiváltó hiba:** a lead mobilon nem találta, hogyan válthat éves→havi fizetésre;
a `Havi/Éves` váltó a 2. lépésen (a „Tovább a megrendeléshez" után) rejtőzött, míg
a `/ év` ár már az 1. lépésen látszott.

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **A váltó az 1. lépés láblécében van** (`.cit-cfg-foot`), **közvetlenül az ÖSSZESEN
   ár-kártya fölött** — ugyanazon a képernyőn, ahol az ár, mielőtt a lead továbblép.
   A 2. lépésen NINCS többé fizetés-váltó.
2. **Mindig látszik mobilon is:** a lábléc pinnelt (`flex:0 0 auto`), a modul-lista
   fölötte görget — a váltó soha nem úszik a bottom-sheet alá.
3. **Forma = B (kártyás):** két egyenrangú opció-kártya (Havi / Éves), az Éves-en a
   kedvezmény badge-ként kiemelve (`{n} hó ingyen`, ahol `{n}` = `PRICING.annualFreeMonths`).
   A kiválasztott kártya cián/kék kerettel jelölt.
4. **Valós árazás:** a váltó a `src/pricing.ts` szerint számol újra
   (havi = alap + Σ modul; éves = havi × (12 − annualFreeMonths)); a bemutatkozó/eszkalációs
   ajánlat (−%) az ár-kártyán VÁLTOZATLAN marad (egyszeri, a hosszabbítás listaáron).
5. **Az éves marad az alapértelmezett** kiválasztás (tulaj-rendelet 2026-08-23) — a havi
   egy kattintás.

## Referencia
`plan.html` — a jóváhagyott mock (A = pirula és B = kártya egymás mellett; a **B** a kötelező).
Méret-váltóval (Mobil 390 / Asztali). A `_drafts/` forrás a land-eléskor törlődik.

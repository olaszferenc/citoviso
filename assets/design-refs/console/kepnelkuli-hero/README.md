# Kép nélküli és kevés képes lead képei — JÓVÁHAGYOTT TERV (kontraktus)

Jóváhagyva: tulaj, 2026-11-25 („Laza” változat a 2. körrel, kiegészítésekkel). Brief:
`~/rc-briefs/kepnelkuli-hero-megvalositas-20261125.md`. Terv-kör: `~/rc-briefs/kepnelkuli-hero-20261124/ZAROJELENTES.md`.
Az `index.html` a 2026-11-24-i mock, a képek a Wikimedia CDN-ről (hotlink) és a `public/assets/stock/`-ból.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Forrás:** csak szabad licencű kép (CC0, CC BY, CC BY-SA, közkincs), fizetős forrás és API-kulcs nincs ($0).
   Minden képnél tároljuk a licencet, a szerzőt és a forrásoldalt, és a lap kiírja.
2. **Szintek:** ① a település saját képe → ② a koordináta körüli TÁJKÉP, de csak a lead SAJÁT országából
   (a kép koordinátájából eldöntve) → ③ a közigazgatási régió tájképe (országszint kizárva) → ④ nincs kép.
   Ha nincs kép, a lead nem küldhető ki.
3. **Ítélet (Laza):** a CLIP legerősebb címkéje nem tiltott; a tiltott téma <0,25; a témapont ≥0,50; a minőség ≥0,40.
   **2. kör minden változatban:** kültér ≥0,5, tágas ≥0,5, látkép ≥0,3, nem sportpálya ≥0,5, nappali ≥0,4,
   és ha a fájlnak van GPS-e, legfeljebb 15 km-re a településtől. Tartalék-szinten csak táj mehet
   (táj > település-jelleg, település-jelleg <0,3).
4. **Szétosztás:** településenként 3–6 elfogadott hero-jelölt. Egy település leadjei között a gép szétosztja őket,
   és két lead ugyanott nem kapja ugyanazt a képsort.
5. **Helyi galéria:** 4–6 helyi kép (strand, főtér, nevezetesség, táj), ugyanazzal a szabállyal, a forrás feltüntetésével.
6. **Mintaképek:** stílusonként (mediterrán, alpesi, vidéki, városi) szabad licencű szobaképek. A stílust a lead helye adja.
   Minden mintakép „MINTA” jelölést kap, és a galéria alatt egy mondat is szól róla.
   Cél: egy kép nélküli lead oldalán kb. 15 kép, ebből 5–7 valódi helyi.
7. **Minden kép egyszer** szerepel; a hero nem ismétlődik a galériában. (Ez eltér az ADR-0436 4. pontjától.)
8. **1–4 saját kép:** a saját képek elöl, mindegyik egyszer. Saját hero csak akkor, ha a `photoKind` szerint a szállás
   külseje vagy kilátása, és legalább 1200 px; különben a településkép a hero.
9. **Csak e-mailes leadért:** a település képgyűjtése csak akkor fut, ha ott van legalább egy kép nélküli vagy kevés képes
   lead, akinek van e-mail-címe.
10. **Kapuk:** a `mockPhotoGate` a 0 és az 1–4 képes mockot csak akkor engedi, ha a választás verziója és küszöbe aktuális.
    A `mockRenderGate` a mintaképet csak a jelölt galéria- és szobahelyen tűri, a hero-ban és ismétlésként soha,
    és a település-hero-t ugyanazzal a CLIP-szabállyal újraítéli.

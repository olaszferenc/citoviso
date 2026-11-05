# Vélemény-szekció saját vélemények nélkül — „B” kártya (tulaj: „B”, 2026-11-05)

Kiváltó eset: Duna Vibe House élő oldala — a szekció egy kis, kattinthatatlan jelvényből,
egy magáról szóló mondatból („Itt a vendégek véleményei jelennek meg…”) és egy külön,
mindig nyitott űrlap-szekcióból állt. Tulaj: „így nem oké, és nem is nyílik meg”.

Jóváhagyott terv: `B-jovahagyott.html` (+ `B-mobil.png`, `B-asztali.png`).

## Mit KÖT a terv (elvárt viselkedés)

1. Amíg az oldalon nincs saját, jóváhagyott vélemény, a „Vendégek véleménye” EGY szekció.
2. Benne egy kártya: a valós Google-átlag nagy számmal, a lap közös őszinte csillag-szabályával
   (`honestStars`, 4,4 → 4 telt csillag), alatta „{N} vendég értékelte a Google-on”.
3. Két gomb: **„Vélemények a Google-on”** (a hely Google-oldala: Places-azonosítóból a
   reviews-link, felderítői olvasatnál a Maps-helykártya) és **„Én is írok”**.
   Link nélkül csak az „Én is írok”; kikapcsolt gyűjtésnél csak a Google-gomb.
4. Az „Én is írok” UGYANABBAN a szekcióban nyitja az űrlapot a kártya alatt (második címsor
   és üres sáv nélkül), és az első mezőre fókuszál. JS nélkül az űrlap nyitva áll, a gomb nem látszik.
5. A „magáról beszélő” mondat nem jelenik meg, ha van szám vagy űrlap.
6. Ha a sablon saját vélemény-szekciója már kiírja a számot linkkel, a kártya nem ismétli.
7. Saját vélemények megléte esetén minden marad a régiben (sablon-szekció + Google-jelvény + űrlap).

Megvalósítás: `src/engine/moduleSections.ts` (`reviewsPendingBlock`), runtime `initReviewWrite`
(`assets/runtime/cit-runtime.js`).

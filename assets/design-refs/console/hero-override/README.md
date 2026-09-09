# Operátori nyitókép-felülbírálat — jóváhagyott terv (A **és** B, 2026-09-09)

Tulajdonosi jóváhagyás: 2026-09-09 („Mindkettő" + „a kézi választás túlélje a
generálást"). Ez a terv a megvalósítás **KONTRAKTUSA** — elvárt viselkedés, nem
stílus-javaslat. Referencia: `plan.html` (kattintható, valós adaton), `A-*.png`,
`B-*.png`.

## Miért van

A nyitóképet a motor választja (ADR: `src/generator/heroPick.ts` — galéria-sorrend +
vision-pontszám). A gép jó, de nem tévedhetetlen, és a kurátor néha TÖBBET tud a
leadről, mint amennyi a képen látszik. A gép ítélete javaslat; **a döntés az emberé.**

## Hol él — KÉT helyen, ugyanaz az igazság

1. **A változat — „Mock és generálás" fül**, közvetlenül a Nyitókép-ítélet-pirula alatt.
   Nagy aktuális nyitókép + a többi kép bélyegben, **nyitókép-alkalmasság szerint
   sorrendben**, mindegyiken a pontszám. Itt a gyors csere a cél: ott dönt, ahol a
   mockot bírálja.
2. **B változat — „Fotók" fül**, a meglévő rácson. Minden képen pontszám **és a teljes
   indoklás**, alatta „Legyen ez a nyitókép" gomb; az aktuális nyitókép kiemelt
   kerettel és letiltott gombbal („ez a nyitókép"). Itt az alapos válogatás a cél.

A két felület **ugyanazt az állapotot** írja és olvassa — nem lehet A-n mást látni,
mint B-n.

## Mit KÖT a terv

1. **A pontszám és az indoklás LÁTSZIK a képen.** Nem elég a sorrend: az operátor
   lássa, MIÉRT került előre vagy hátra egy kép. 55 pont alatt a jelvény piros.
2. **Kizárt tárgyú kép sem TILTOTT — figyelmeztet.** Ha az operátor fürdőszobát, WC-t,
   parkolót, táblát, portrét vagy reklámbannert választana, megerősítést kér
   („Biztos ez legyen a lap teteje?" + a tárgy és az indoklás), és `Igen, ez legyen` /
   `Mégsem` gombot ad. Az ember a főnök — de tudja, mit választ.
3. **A választás UTÁN újrarenderelés fut, és ezt a felület KIMONDJA.** A mock statikus
   pillanatkép: a puszta DB-írás semmit nem változtatna azon, amit a lead lát. A sáv
   („Újrarenderelem a mockot az új nyitóképpel…") a folyamat végéig látszik.
4. **A kézi választás TÚLÉLI az újragenerálást.** A jelölés a LEADHEZ tapad, nem az
   artefaktumhoz: új sablon, újraírt szöveg után is a kiválasztott kép a nyitókép.
5. **Visszavonható, és a felület megmondja, hogy kézi.** „Kézi nyitókép. Te választottad:
   … (pontszám)" + „Vissza a gépi választásra" — egy kattintás, és újra a motor dönt.
6. **Mobil és asztali is működik.** A bélyeg-rács és a nagy nyitókép 390 px-en egymás
   alá rendeződik (`@container`, nem `@media`).

## Amit a terv NEM köt

A pontos szín-árnyalatok és térközök: minden a `--citui-*` dizájn-magból jön, a
konzol saját komponensei (`.cp-v` pirula, `.lead-photos` rács) mintáját követve.

# Dizájnterv — Három Huszár Apartments, Köveskál

## A — „Meszelt fal, kék ajtó” (szerkesztett, fotó-vezérelt lap)
- Paletta: accent `#33607f` (a 02/08 fotó kék ajtaja) · on-accent `#ffffff` · ink `#1c2326` · muted `#525e65` · bg `#f4f6f5` (hideg meszelt fehér, nem krém) · surface `#ffffff` · line `#d6dcda` · radius `3px` · shadow `0 18px 40px -24px color-mix(ink 45%)`.
- Betűk: Literata (címek, mérsékelt kontrasztú, olvasós serif) + Instrument Sans (szöveg), mindkettő latin-ext.
- Mobil (390): a hős-fotó a képernyő kb. felét adja, alatta ráúszó fehér „falkártya” a címmel és két gombbal; egy hasáb, 2×2-es számrács, galéria 2 oszlopos mozaik (álló reggeli-kép két sor magas); alul fix sáv (Hívás + Ajánlatot kérek), ami a hős-gombok és az űrlap fölött félreáll.
- Asztal (1440): teljes szélességű hős-kép, a falkártya bal alul rálóg; számok egy sorban függőleges elválasztókkal; bemutatás 5/7 arányban ragadós tornác-fotóval; szobák egymás mellett; galéria 6 oszlopos rács eltérő méretű tálakkal; házirend és GYIK két hasábban; űrlap mellett ragadós bevezető.
- Emlékezetes mozzanat: **kapunyitás** — betöltéskor a hős-képet meszelt fal takarja, benne boltíves nyílás (a 06-os terméskő kapu íve); a két falfél szétcsúszik, a kép közben 1,14-ről 1-re lassul. Csak transform. A cím a kártyán végig olvasható, nem takarja semmi.
- Kísérő mozgás (szekciónként más): címek alatti vonal kihúzódik (scaleX), számok balról csúsznak be lépcsőzve, galériatálak enyhe kicsinyítésből ülnek be, szobakártya érintésre megemelkedik, menü lecsúszik, nagyított kép beúszik.

## B — „Séta a kapun át” (osztott képernyő, görgetett történet)
- Paletta: accent `#4a6b34` (a lugas lombja) · on-accent `#ffffff` · ink `#20231d` · muted `#565a50` · bg `#e9eae4` (kavics-szürke) · surface `#f7f7f3` · line `#c9cbc0` · radius `22px` · shadow `0 1px 0 color-mix(ink 14%) + puha alsó árnyék`.
- Betűk: Bricolage Grotesque (nagy, karakteres groteszk címek) + Figtree (szöveg), mindkettő latin-ext.
- Mobil (390): szöveg-elsős hős (óriás cím, rövid bevezető, két pirula-gomb), alatta háromfotós lépcsős kollázs; a „séta” jelenetben a fotó rögzítve tölti ki a képernyőt, és a szöveglapok felette úsznak el; galéria kéthasábos rács; jobb alsó sarokban lebegő Hívás + Ajánlatkérés.
- Asztal (1440): osztott képernyő — hősben bal oldalt szöveg, jobb oldalt kollázs; a sétánál bal oldalt 7/12-es ragadós, lekerekített képpanel, jobb oldalt a lépések nagy címekkel; az értékelések teljes szélességű accent sávon; az űrlap kétlépcsős (Mikor, hányan? → Elérhetőség), mellette ragadós összesítő a becsült összeggel.
- Emlékezetes mozzanat: **séta a házban** — kapu (06) → kavicsos ösvény (05) → tornác (07) → belső udvar (03) → reggeli (10) → kert (04): görgetésre (IntersectionObserver) a ragadós panel képei egymásba úsznak (opacity + 1,08-ról közelítés), egy vékony haladásjelző (scaleY) mutatja, hol tart a vendég.
- Kísérő mozgás: hős-kollázs lapjai egymás után beúsznak, a számok a vonal alól felcsúsznak (translateY, overflow-vágással), a címek oldalról érkeznek, az űrlap lépésváltáskor oldalra csúszik, a galéria-kép nagyításkor a megérintett bélyegképből nő ki (WAAPI, transform).

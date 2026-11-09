# KONTRAKTUS — kép nélküli lead mockja: a település fotója a hősben, tiszta mintaképek a galériában

**Jóváhagyta:** a tulaj, 2026-11-09, szó szerint: „C” (§2b terv-jóváhagyási kapu). A kérése (brief
`k-pek-n-lk-l-20261109-193407.md`): „Képek nélküli leadet nem küldhetünk ki, nagyon gagyi… Hero városról
kép. Minta képek ingyenes, de azért látszódjanak most így is.”
**Terv:** `plan.html` (kattintható, mobil/asztali váltóval) · **Terv-kör:** A = erős vízjel (a 2026-11-07-i könyvtár) · B = tiszta kép + sarokcímke · **C = tiszta kép +
egy felirat a galéria alatt (JÓVÁHAGYVA)**. A vázlat-forrás a fán kívül: `~/rc-briefs/varos-hero/`.
**Képek (a valódi motorból renderelve, 390 px + asztali):** `rozalia-gate-opening-felirat-*` (Rozália
Apartman, Balatonalmádi) · `szabo-parallax-felirat-*` és `szabo-wordmark-grow-felirat-*` (Szabó Vendégház,
Villány) · `galeria-C-mobile.jpg`.
**ADR:** ADR-XXXX (felülírja az ADR-0431 4. pontját: a vízjel a pixelekben).

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük.

## KÖT

1. **Hős = a település fotója**, ha a leadnek NINCS saját képe. Forrás: a település magyar Wikipédia-
   szócikkének vezérképe; ha az nem fotó (címer, térkép, zászló, SVG/PNG) vagy álló, a Wikimedia Commons
   keresésének első fekvő, ≥ 1200 px széles JPEG-je. Csak szabad licenc (CC BY / CC BY-SA / CC0 /
   közkincs). A kép a Wikimedia saját szerveréről töltődik (hot-link, ~1600 px-es bélyegkép), nálunk
   nincs tárolva.
2. **Forrásmegjelölés a láblécben**, minden ilyen mockon: „Borítókép: <település> · Fotó: <szerző>,
   Wikimedia Commons, <licenc>” — a licenc ezt kéri. A szöveg nem állítja, hogy a kép a szállást mutatja.
3. **A településfotó NEM a szállás képe:** nem kerül a tárolt `photos` listába (a képszám a szállás
   sajátja marad), a generáláskor `siteData.townPhoto`-ba kerül, és CSAK a mock renderelésekor lesz hős.
   Élesre soha nem megy.
4. **Galéria:** a településfotó + mintaképek 6 képig (az ADR-0431 szabályai szerint: kategóriák,
   stílus, determinisztikus választás, egy kép egyszer).
5. **Tiszta mintaképek, vízjel NÉLKÜL** — a könyvtár (`public/assets/stock/`) újraépítve vízjel nélkül.
   A jelölés helyett **egyetlen felirat a galéria alatt**, minden mockon, amelynek galériájában mintakép
   van (a 0 és az 1–5 saját képes leadnél is): **„Néhány kép minta: a helyükre a szállás saját fotói kerülnek."**
   A szobakártyák meglévő „MINTA” címkéje marad.
6. **A feltöltő-tilalom marad:** a tiszta könyvtári kép (md5 + dHash) és a korábbi vízjeles változat is
   tiltott tenant-asset (a régi md5/dHash-ek a manifest `retired` listájában).
7. **Kiküldhető:** a településfotós mock nem „kép nélküli” (`nophoto`) — a kapu átengedi; a településfotó
   egy valódi, ellenőrzött kép-hivatkozás a lapon.
8. **Ha nincs településfotó** (nincs szócikk / nincs szabad fotó / hálózati hiba): marad a 2026-11-07-i
   betűs hős (wordmark-grow) a halványított tájjal, és a `nophoto` kapu is marad.
9. **Sablon:** Parallax és Névből növő a településfotóval; Kapunyitás saját második kép nélkül kapu-
   animáció nélkül, sima hőssel renderel (ahogy a terv-képen).

# 2026-09-29 — A 3. telefonos kör apróságai: létszám, „Alapár:” az ajánlaton, két lebegő pirula

SUB-szál (brief: `~/rc-briefs/harmadik-kor-aprosagai.md`), koordinátor: `citded06a5f`. Forrás:
`2026-09-29_harmadik_telefonos_kor_tihany.md` + az ítélet (FK-011/014/016 képek).

## ① Létszám („hat felnőtt” helyett 2 fő) — a FORGATÓKÖNYV hibája, nem termékhiba
- Mérve a kódból: a vendég-widget léptetője (`[data-guests]`, alapérték 2) a `guests` mezőben megy be
  (`cit-runtime.js`), a kérés `guests`-ét olvassa a tulaj-kártya, a levél (`stayRows`) és az ajánlat-lap
  is — egy forrás, nem tud elválni.
- Az FK-014 ⑦ sosem állította a léptetőt. Javítva: külön lépés 4× `[data-step='1']` + `szövege
  "[data-guests]" = "6"` a küldés ELŐTT (a `várd`-ok a `tedd`-ek után értékelődnek — a küldés után a
  doboz már a nyugta). Az FK-016 ② méri: `látható "6 fő"`.

## ② „Alapár:” az egyedi ajánlaton — TERMÉKHIBA, javítva
- Ok: `sendOffer` a `quoteStayFrom`-mal fagyasztja a sorokat, és az ajánlat által árazott éjszakák
  (overlay / dátumos / időtlen alapár — mind `isBase`) a `baseLabel`-t, azaz „Alapár”-t kapták.
  A vendég árlista-árnak olvasta (ADR-0267 óta az ár alapból CSAK arra a kérésre szól).
- Javítás: `quoteStayFrom` új opcionális `labelOn(day)`-je; a `sendOffer` az általa árazott
  (`missing`) éjszakákra „Egyedi ár”-at ad, MINDHÁROM mentési úton (a widget is „Egyedi ár”-nak
  hívja). A már árazott éjszakák a saját címkéjüket tartják (pl. „Főszezon”).
- Őr: `booking-offer-check` S⑦ (5 állítás: DB-sorok mindhárom úton + ajánlat-lap mobil/asztali).
  Piros kontroll: a javítás nélkül mind az 5 bukik (`["Alapár","Főszezon"]`).
- ⚠️ A már kiküldött ajánlatok befagyott sorai (`quoted_lines`) „Alapár”-ok maradnak — tesztadatot nem
  javítunk; az új ajánlatok már „Egyedi ár”-ral mennek.

## ③ Két lebegő pirula — mérve VIEWPORTBAN, döntés a koordinátoré
- **„görgessen — még van adat”:** NEM takar. Saját sávban ül a görgető doboz ALATT (390: doboz alja 486,
  jel 488–511; takart mező 0, három görgetési helyzetben). A látszat oka: a mező a doboz szélén vágódik
  el, közvetlenül a jel fölött. Fekvőn és asztalin nincs jel (egy oszlopban görget). Nem nyúltam hozzá.
- **„Itt rendelheti meg”:** (a Tihany már vásárolt → a lapján nincs pirula; mérve a Laguna Panzió
  arch-frames lapján, :4600)
  - 390 álló, nyugalomban: nem takar (784–828, a cím fölötte). CSAK amíg a süti-sáv kint van: a pirula
    a szerződés szerint (ADR-0242 ④) a sáv fölé ül (661–705) → épp a hős-címre.
  - 844×390 fekvő, nyugalomban is: középen alul a hős-cím tetejére ül.
  - A javítás elhelyezési szabály-változás (a ④ csak GOMBOK elől tér ki, és „a lappal mozgó elemek
    fölé nem mászik”) → új elrendezés-döntés, a briefnek megfelelően a koordinátornak jelezve.
- Az ítélet 03-as képén a pirula a süti-sáv eltűnése UTÁN is fent volt: a runner a lefelé úszás
  (120 ms ütemezés + 0,22 s átmenet) előtt fotózott — nyugalomban lent van.

## Képek (maradandó, a munkafához relatív; gitignore-olt)
`elek/runs/harmadik-kor-aprosagai/`: `elotte-|utana-ajanlat-lap-{390,asztali}.png`,
`pirula-390-suti-sav-kint.png`, `pirula-390-nyugalomban.png`, `pirula-844x390-{suti-sav-kint,nyugalomban}.png`,
`gorgessen-jel-390.png`.

## Módosított fájlok
- `src/tenant/prices.ts` — `quoteStayFrom` `labelOn` opció
- `src/booking/requests.ts` — `sendOffer`: az ajánlott éjszakák „Egyedi ár”
- `scripts/booking-offer-check.mts` — S⑦
- `elek/scenarios/FK-014-guest-live-mobile.md` — létszám 6 fő, külön lépésben mérve
- `elek/scenarios/FK-016-guest-aftermath-mobile.md` — „6 fő” + „Egyedi ár”, nincs „Alapár”

## Nyitott
- A pirula–hős-cím ütközés (süti-sáv alatt álló; fekvőn nyugalomban is): tulaj-döntés kell
  (pl. a ④ kiterjesztése a hős-címre, vagy fekvőn a jobb sarok).
- Az FK-014/016 új állításai a következő tiszta alanyon futnak először.

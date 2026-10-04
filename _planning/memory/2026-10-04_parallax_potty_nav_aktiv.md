# 2026-10-04 — Parallax pötty-nav: görgetéskor a képen lévő szakasz pöttye világít

**Tulaj (a koordinátoron át):** „a Parallax oldalsó pöttysora a foglalási blokknál az első pöttyöt mutatja aktívnak. Javítsuk?” → „igen javítsuk”.

## Mérve (asztal 1440×900, mock / élő ± foglalás)
- A pötty-sor CSAK asztali (1000 px alatt `display:none`) — telefonon nincs mit javítani.
- A régi IntersectionObserver (`threshold:.4`) annak a szakasznak a pöttyét gyújtotta, amelyik UTOLJÁRA lépte át a 40%-ot — a képernyőt ELHAGYÓ szakasz is „intersecting”, a 2 000 px-es „Kiemelt” pedig sosem érte el a 40%-ot. Görgetve 68 lépésben rossz pötty világított.
- A záró foglalási szakasznak (`#cit-booking`) nem volt pöttye.
- Második, javítás közben talált hiba: a közös runtime ADR-0253 ① szabálya (foglalási blokknál nincs ragadó foglalás-gomb) a fix pozíciójú `a[href="#cit-booking"]` pöttyöt is gombnak nézte és eltüntette — pont a foglalásnál.

## Javítás
- `src/engine/templates/parallax.ts`: pozíció alapú aktív pötty (a képernyő 40%-ánál lévő vonal alatti szakasz; a lap alján az utolsó látható); új „Foglalás” pötty `#cit-booking`-ra, ha a foglalási felület renderel (`hasBookingSurface`); a nav `data-cit-secnav` jelet kap.
- `assets/runtime/cit-runtime.js`: a ragadó-foglalás-gomb osztályozó kihagyja a `[data-cit-secnav]` alatti linkeket.
- `scripts/mobile-chrome-check.mts` ①: ugyanez a kivétel (a kapu saját felismerője a pöttyöt ragadó foglalás-gombnak mérte, 36–41 lépésben piros volt); önteszt zöld.
- Kinézeti döntés nem kellett: a meglévő szabály („pötty = minden ténylegesen renderelt szakasz”) szerint jár a foglalásnak is; ugyanaz a pötty-stílus. A hero alatti vékony dokk a hero része (Kezdőlap-pötty).

## Őr
`scripts/parallax-dots-check.mts` (+ pre-commit): egérgörgővel végig, ① pontosan egy pötty világít és egy sem tűnik el · ② a sávon lévő szakasz pöttye világít · ③ a lap alján az utolsó · ④ foglalás-pötty ⇔ `#cit-booking` · ⑤ nincs JS-hiba. Önteszt: a régi observerrel a ② piros. A runtime-javítás nélkül az ① piros (kézzel ellenőrizve).
nav-target-check `--only=parallax` zöld (a foglalás-pötty a csomag-vágással együtt tűnik el).

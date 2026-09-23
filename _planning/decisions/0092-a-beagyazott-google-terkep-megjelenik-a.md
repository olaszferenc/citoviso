## ADR-0092 — A beágyazott Google-térkép megjelenik (a kattintásra-betöltő homlokzat kivezetve)

**Dátum:** 2026-09-01 · **Kiváltó:** tulajdonosi döntés — *„hagyjuk már ezt, hogy nem bírsz Google
Térképen megjeleníteni bármit"*. Felület-kapu: KIVÉTEL-mód, naplózva (`surface-gate exception`).

**Előzmény:** a „Megközelítés" szekcióban a látogató szürke dobozt látott „Térkép betöltése"
gombbal; a Google-iframe csak koppintás után töltött be. Ez adatvédelmi megfontolás volt (a
beágyazás a látogató IP-jét a hozzájárulás előtt továbbítja a Google felé).

**Döntés:** a térkép **egyből renderel**, szerver-oldalon (`primitives.mapEmbed`) — tehát JS
nélkül is működik és nem utólag ugrik be. A tulaj az adatkezelő, és úgy ítélte, hogy egy szürke
téglalap a térkép helyén törött oldalnak látszik, a mock dolga pedig az első másodpercekben
meggyőzni. **A tájékoztatás a helyére került:** új szakasz az adatvédelmi tájékoztatóban (címzett:
Google Ireland Limited, saját adatkezelőként; jogalap: jogos érdek, GDPR 6. cikk (1) f); kérésre
eltávolítjuk, a cím és az útvonaltervezési link enélkül is megmarad).

**Együtt javítva:** a térkép a **GPS-koordinátát** kapja, nem a scrape-elt „címet". Két kódút volt,
és csak a modul-blokk használta a koordinátát; a kompozíciós út a nevet+címet fűzte össze — a
Dencs címe pedig `Ráckevei út 083/2 hrsz. 083/2`, helyrajzi szám, amire a tű a semmibe kerül.

**Visszafordíthatóság:** 🔄 — a homlokzat-ág a runtime-ban bent maradt a régi snapshotok miatt.

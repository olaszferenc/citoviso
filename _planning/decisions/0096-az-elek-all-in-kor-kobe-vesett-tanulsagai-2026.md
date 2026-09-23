## ADR-0096 — Az Elek ALL-IN kör kőbe vésett tanulságai (2026-09-05/06)

**Kontextus:** az ADR-0095 ALL-IN megbízás első teljes végigjátszása (scrape-klón → mock →
kuráció → kiküldés → funnel → vásárlás → tenant-admin → bővítés → bukás-mátrix) 7 zöld
forgatókönyvvel zárult, és menet közben éles-kritikus hibákat hozott felszínre. Az alábbiak
DÖNTÉSEK, nem tanácsok:

1. **Gépi gateway-tiltás:** ELEK_RUN=1 alatt a runner `PAYMENT_GATEWAY=mock`-ot kényszerít —
   a charter „külső fizetés-gateway tilos" szabálya a levél-guard mintájára MECHANIKUS
   (mérve: a futás a valódi Barion sandbox-oldalig jutott; a forgatókönyv-ellenőrzés fogta
   meg, kattintás nem történt).
2. **Verdikt-kapu a gépi kurációban:** Elek jóváhagyás-lépése CSAK zöld „Marketing-őr:
   átment" + „Tényhűség: átment" pill mellett kattinthat (vakon jóváhagyott őr-bukott mockot;
   a KB-elv — kiküldeni csak őr-igazoltat — a gépi tesztelőre is áll).
3. **Kör-jelentés kontraktusa (tulaj-rendeletek sora):** EGY önhordó HTML, a TESZTELT
   FOLYAMAT nevével a fejlécben (nem FK-kóddal), lelet-szám badge-ekkel legfelül (a HIBA nem
   bújhat el), kattintható tartalom-listával, minden lépés proof-képével — a konzol
   `/test-log/<FK>/report` linkjén (fájl-csatolmány telefonon használhatatlan). A jelentés a
   tartós `data/test-log/` tárba publikálódik (a worktree-GC a futás-mappákat viszi).
4. **§B.17 fotó-kapu bővítés:** a listing-oldal registrable domainjétől IDEGEN site képe a
   galériában = beágyazott hirdetés/cross-promo → ejtendő (mérve: Mirabella-banner mock-HERO
   lett egy vouch-olt profilból; CDN-aldomain átmegy; fixture-pár őrzi). Kétség esetén ejt —
   a widget-galéria vesztesége vállalt.
5. **Fulfillment-kapu hatókör:** a „jóváhagyott mock nélkül nincs pay-link" őr CSAK
   `kind=initial` rendelésre fut — élő tenant upsell/multilang/domain vásárlását nem
   ítélheti meg a prospect rég elutasított mockja.
6. **Ár-igazmondás a kuponra:** az ADR-0088 §6 üdvözlő-kupon a vásárlás-felületen LÁTHATÓ
   (áthúzott listaár + kedvezményes ár + százalék) — néma, terheléskori kedvezmény tilos.
7. **Kép-inline szabály a generálásban:** amit a saját letöltésünk nem ér el, azt EJTJÜK —
   plain-URL fallback az API felé tilos (egy blokkolt kép az egész brief-hívást vitte el,
   néma generikus szöveggel).

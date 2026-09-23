## ADR-0063 — „Többnyelvű honlap" modul: egyszeri díjas, 3 nyelvű site-generálás fizetett újrageneráltatással

**Dátum:** 2026-08-23 · **Státusz:** elfogadva (tulajdonosi rendelet) · **Kapcsolódó:**
ADR-0036 (nyelv = paraméter, language_pack), ADR-0044 (modul-config), ADR-0045 (KB-locale),
ADR-0041 (SEO/láthatóság), 03-INVARIANTS §B.17 (tényhűség — a fordítás nem fabrikálhat).

### Probléma (tulaj, 2026-08-23)

A tenant site-ja ma egynyelvű (a nyelv a régió országából dől el, ADR-0036). Külföldi
vendéget célzó szállásnak a többnyelvű honlap közvetlen bevétel-növelő — és számunkra
természetes, közel nulla marginális költségű upsell: a motor determinisztikus, a
fordítás generálási feladat. DE a fordítás pillanatfelvétel: ha a tulaj utána átírja a
szövegeit, a fordítások elavulnak — a frissítés munkát (generálást) jelent, tehát
fizetett esemény.

### Döntés

1. **Új modul: `multilang` — az ELSŐ egyszeri díjas modul.** A katalógus (`ModuleDef`)
   billing-típust kap: a meglévő modulok `monthly` (változatlan viselkedés), a
   `multilang` `once`. Ára NEM megy a havi/éves előfizetés-összegbe; a pricing-admin
   ugyanúgy szerkeszthetővé teszi.
2. ~~**Fix 3 nyelv, egy csomagár** (tulaj-döntés). A tenant az adminban 3 nyelvet választ
   a támogatott készletből (ADR-0036 `LANG_NAME`); a site elsődleges nyelve nem számít
   bele és nem is választható.~~
   ⛔ **FELÜLÍRVA az ADR-0128-cal (2026-09-13):** a készlet 29 nyelvre nőtt, és a fix 3
   helyére **három sáv** lépett (Alap 3 / Bővített 6 / Teljes mind a 28). A site
   elsődleges nyelve továbbra sem választható célnyelvként.
3. **A generálás FIZETETT ESEMÉNY, minden alkalommal azonos áron** (tulaj-döntés):
   első generálás = újragenerálás = nyelv-csere utáni generálás. Fizetés után a teljes
   site (tenant által beírt szövegek + felület + modul-tartalmak) legenerálódik mind a
   3 választott nyelvre. Nyelv-csere = új fizetés, új nyelvkészlet.
4. **A fizetett állapot a horgony (content-hash).** Generáláskor a lefordított
   forrás-tartalom hash-e eltárolódik. A tenant BÁRMELY tartalom-mentése után a hash
   eltér → a fordítások `stale` státuszba lépnek, a tenant ÉRTESÍTÉST kap (admin-banner
   + e-mail), és felajánljuk az újrageneráltatást (fizetős). Generálás előtt a rendszer
   meggyőződik róla, hogy minden menthető tartalom mentve van — a fordítás mindig a
   perzisztált állapotból indul, sosem félkész szerkesztésből.
5. **Az elavult fordítás KINT MARAD** (tulaj-döntés): a kifizetett utolsó fordítás él
   tovább az új fizetésig — az elsődleges nyelvű oldal viszont azonnal frissül (a mai
   ingyenes szerkesztés-út változatlan). Az admin mutatja, MI változott a fizetett
   állapothoz képest.
6. **Render-modell:** nyelvenkénti statikus snapshot (`sites/<tenant_id>/<lang>/…`) a
   meglévő determinisztikus motorból (recipe + fordított siteData + language_pack UI-
   stringek) — SOHA nem új AI-tervezés (snapshot-doktrína: a re-render determinisztikus).
   Nyelvváltó a site-on + `hreflang` alternates a SEO-rétegben (ADR-0041: a többnyelvű
   oldal egyben URL-termelés).
7. **Tényhűség a fordításban (§B.17):** a fordító át-ültet, nem alkot — számot, árat,
   nevet, tényt nem adhat hozzá és nem változtathat. A tenant SAJÁT szövegének
   fordítása tartalmilag hű marad.

### A fizetési út (⛔ mock-út ≠ éles út tanulság)

A meglévő `requestPayment` order_intent-centrikus (prospect-konverzió). A multilang
generálás TENANT-oldali, ismételhető fizetés → saját fizetési rekord (generálási
igény → pay-link → webhook/visszatérés → generálás-futtatás → számla). A Barion-
visszatérés route-ját és a webhook-utat TÉTELESEN ki kell építeni és élesben végig-
járni — a mock-fizetés zöldje nem bizonyíték.

### Visszafordíthatóság

🔄 A modul kikapcsolható (katalógus-elem); a nyelvi snapshotok törölhetők. Az egyszeri
díjas billing-típus bevezetése 🚪 részben egyirányú: a payment/invoice rekordokban
megjelenik, de a meglévő havidíjas modulok viselkedését nem érinti.

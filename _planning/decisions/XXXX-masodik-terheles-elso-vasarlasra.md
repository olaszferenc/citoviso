## ADR-XXXX — A második terhelés egy már kifizetett első vásárlásra: az első nyer, a második kézi rendezés

**Dátum:** 2026-10-10 · **Kontextus:** IT-teszt B1-PAR (BLOKKOLÓ) — két pénztár-fül → két fizetés, két számla, kétszer −25%.

**Döntés**
1. A „már vásárolt” kapu a FIZETÉS BEÉRKEZÉSEKOR is fut (`applyWebhookResult`), minden `initial` rendelésre — próbára és közvetlen vevőre egyaránt.
2. A lead fizetett `initial` fizetései közül az nyer, amelyiknek a `paid_at`-je (döntetlennél az `id`-je) a legkisebb. Zár nélkül determinisztikus: két párhuzamos befutó ugyanazt a sorrendet látja.
3. A második fizetés `paid` marad (a pénz beérkezett — a rekord nem hazudik), de **nem konvertál, nem éget kupont, nem állít ki számlát**. A ház e-mailt kap (`alertHouse`, tag `duplicate-initial`), a teendő: visszautalás a Barion felületén.
4. Új pénzmozgás NEM készül: visszatérítési API nincs bekötve (ADR-0078), ezért a vevőnek sem ígérünk automatikus visszautalást — a `/pay/done` „Ezt a rendelést már kifizette” lapja azt mondja, hogy munkatárs veszi fel a kapcsolatot.
5. A `/pay/go` a még függő testvér-fizetés pénztárát csak a „már az Öné” ellenőrzés UTÁN adja vissza.

**Őr:** `scripts/free-trial-expiry-check.mts` ⑤b (önteszt: az első fizetés `paid_at`-je a második mögé csúszik → piros).

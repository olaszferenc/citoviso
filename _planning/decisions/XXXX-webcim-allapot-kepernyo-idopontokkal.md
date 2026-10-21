## ADR-XXXX — Webcím: állapot-képernyő időpontokkal és várható elkészüléssel a vétel után

**Dátum:** 2026-10-21 · **Döntött:** tulaj (Olasz Ferenc), a „B” változat · **Kontraktus:**
`assets/design-refs/console/domain/allapot-4-webcim-b.html` + `README.md` („Állapot-képernyő a vétel után”)

### Kontextus
Az overseer.hu éles vásárlása (2026-10-21 15:54) után a tenant-admin Webcím fülén ez állt:
„Már intézzük — Önnek nincs teendője”, egy 4 lépéses sáv és „Ez általában néhány percet vesz
igénybe”. A .hu nevet a Nyilvántartónak jóvá kell hagynia (általában 24 órán belül), így a
„néhány perc” nem volt igaz, és sehol nem volt időpont vagy határidő. A tulaj szava: fizetés után
„SEMMI nem történik: nincs állapot, nincs határidő”.

### Döntés
1. A megvett név beállítása alatt (`registered` … `tls_pending`, `setup_retry`) EGY képernyő
   látszik: egy mondat a várható elkészüléssel, három szakasz, és a lépéslista időpontokkal.
   A zárolásos fizetés képernyője (ADR-0251) addig marad, amíg a pénz még nincs lehívva, vagy
   a név még nincs megvéve.
2. .hu név bejegyzés előtt a várható elkészülés = vétel (`waiting_since`) + 24 óra, egész
   órára felfelé kerekítve, a szállás órája szerint.
3. Késésnek számít: `setup_retry`, `stuck_stage ≥ 1` (a 24 órás operátor-riasztás kiment,
   ADR-0372), vagy .hu-nál 24 óra bejegyzés nélkül. Ilyenkor a mondat kimondja: a vártnál
   tovább tart, munkatársunk már intézi.
4. Új oszlop: `domain_provisioning.ns_active_at` (0112) — a dns_pending → tls_pending
   átmenet ideje (.hu-nál a Nyilvántartó jóváhagyása). A többi időpont már megvolt
   (`payment.paid_at`, `waiting_since`, `finished_at`). Rögzítetlen időpontot nem írunk ki.

### Következmény
- A tenant minden pillanatban látja, hol tart a beszerzés, és mikorra várható.
- A „munkatársunk már intézi” ígéret a 24 órás riasztásra épül: azt nekünk kell betartani.
- Őrök: `domain-package-claim-check` ⑤ és `domain-order-single-flight-check` B2 az új szöveget méri.

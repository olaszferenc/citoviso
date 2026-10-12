## ADR-0372 — Saját domain: a `dns_pending`/`tls_pending`-ben ragadt beállítás 24 óránál riaszt, 72 óránál ismét + egy tulaj-levél

**Dátum:** 2026-10-12 · **Kontextus:** Elek „it” ellenőrző kör (2026-10-12), ÚJ-K1; a koordinátor (Elek-teszt
koordinátor FŐ session) döntése. **Kiegészíti:** ADR-0362 ② (`setup_retry`), ADR-0071 (beszerzés-állapotgép),
ADR-0279 (házi riasztó).

### Kiváltó (mérve, mock regisztrátor/DNS, scratch-DB)
T1 megrendelte és kifizette az `elek-teszt-dnsfail.hu`-t (a mock DNS a `dnsfail` címkét örökké „pending”-en tartja):
`dns_pending`, a zárolás lehívva. A resume-futás +1, +7, +30 nappal: mindig `dns_pending`, **0 levél, 0 riasztás**
(`_elek/mail/v-domain-stuck.txt`). Ok: `runDomainProvisioning` a „még nem aktív” zóna/tanúsítvány-választ nem
hibának veszi (helyesen), így a `setup_retry` riasztása és levele sosem indul — és időalapú átmenet nincs.
Élesen: a regisztrátor-oldali NS-delegáció vagy a tanúsítvány nem élesedik; a vevő fizetett, a felülete „2/4 lépés”-en
áll, és senki nem tud róla.

### Döntés
A `setup_retry` mintájára, a várakozás órája szerint, **lépcsőnként egyszer**:
- **24 óra** `dns_pending`/`tls_pending` után: operátor-riasztás a házi riasztón (`domain-setup` címke) — melyik
  lépés áll (NS-delegáció / tanúsítvány), mióta, mi a teendő.
- **72 óra** után: **ismételt** riasztás + **egyetlen, igaz tulaj-levél** — ugyanaz, amit a `setup_retry` küld:
  „A webcím az Öné — a beállítás tovább tart a vártnál … munkatársunk is figyeli. Önnek nincs teendője.”
  Ha a beszerzésre ez a levél már kiment (a `setup_retry` belépésekor), másodikat NEM küldünk.
- Utána semmi: se napi riasztás, se napi levél. A sor nem lép magától tovább (élőt nem hazudunk); az időzítő
  ugyanúgy kérdezi tovább, és ha a delegáció/tanúsítvány megjön, `live` + a szokásos „elkészült” levél.

Mechanika (migráció 0107): `domain_provisioning.waiting_since` (a `dns_pending` belépésekor íródik, a `tls_pending`
alatt is fut, egy közbeeső `setup_retry` nem nullázza), `stuck_stage` (0/1/2 — feltételes UPDATE-tel lép, két
párhuzamos futás sem küld kétszer), `delay_notice_at` (a „tovább tart” levél beszerzésenként egyszer — a
`setup_retry` útja is ezt írja). A migráció a már várakozó sorok óráját a migrációtól indítja (a régi kor nem
ismert; deploy utáni riasztás-zápor nem kell), a már `setup_retry`-ben lévő sorokat értesítettnek veszi.

### Őr
`scripts/domain-order-single-flight-check.mts` „ÚJ-K1” blokk (pre-commit; a 0107 migráció is triggereli): +1 óra
csend; +25 óra EGY riasztás, levél nincs; +30 óra nincs második; +73 óra ismételt riasztás + EGY igaz levél;
+7 / +30 nap semmi új; korábbi `setup_retry`-levél mellett a 72 órás lépcső nem küld másodikat. **A régi kódon: 8 bukás.**

### Visszafordíthatóság
🔄 — a három oszlop és a lépcső-logika visszavehető; a küszöbök (`DOMAIN_STUCK_ALERT_HOURS`,
`DOMAIN_STUCK_NOTICE_HOURS`) kódkonstansok.

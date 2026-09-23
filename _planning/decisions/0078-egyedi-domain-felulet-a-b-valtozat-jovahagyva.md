## ADR-0078 — Egyedi-domain felület: a B változat jóváhagyva; sikertelen beszerzésnél A TENANT DÖNT

**Dátum:** 2026-08-27 · **Státusz:** ELFOGADVA (tulajdonosi döntés) · **Kapcsolódó:**
ADR-0071 (automata domain-beszerzés), ADR-0020 (24 hó), ADR-0041 (slug→domain 301),
ADR-0076/0077 (a kapu csatornája és a működő mock), CLAUDE.md §2b.

**① A felület: B VÁLTOZAT** — külön „Webcím" fül, **3 lépés** (1. Név → 2. Áttekintés → 3. Kész).
Indok a terv-körből: a fizetési döntés önálló pillanatot kap, nem ugyanazon a lapon, ahol a nevet
választják. A jóváhagyott terv KONTRAKTUSKÉNT befagyasztva:
`assets/design-refs/console/domain/` (HTML-ek + `README.md`, ami kimondja, mit KÖT a terv —
elvárt viselkedés, nem stílus-javaslat). A kész felületet EHHEZ mérjük.

**② Sikertelen beszerzés (a nevet a fizetés és a vétel között elviszik): A TENANT DÖNT.**
Nincs automata visszautalás; a tenant másik nevet választ, és a befizetett összeg arra
fordítódik.

⚠️ **A döntés indoka pontosítva — a napló nem hazudhat.** A tulaj feltételezése az volt, hogy a
visszautalás banki integrációt igényel („nem barion spec hanem bank"). Valójában a **Barionnak
van `Payment/Refund` API-ja**, tehát a gateway specifikációjának része. **DE nálunk ebből semmi
nincs megírva** — mérve 2026-08-27: nulla refund-ág a `payment/` alatt. A döntés tehát helyes,
csak az oka más: **nem képtelenség, hanem meg-nem-épített funkció**; ha később kell, a
Barion-adapter bővítése a helye, nem külön banki projekt. Ezt azért rögzítjük pontosan, mert egy
téves technikai indok később rossz döntést alapoz meg (vö. `feedback_szamlazz_barion`: a kód-
komment nem forrás egy külső szolgáltatás KÉPESSÉGÉRŐL).

**Következmény a szövegre (§B.17 magunkra is áll):** a felület NEM ígérhet visszautalást, amíg az
nincs megvalósítva. A sikertelen-képernyő szövege ennek megfelelően javítva: *„A befizetett összeg
nem vész el: egy másik névre fordítjuk."* (A korábbi „visszautaljuk, vagy…" megfogalmazás olyat
állított, amit a rendszer ma nem tud teljesíteni.)

**Visszafordíthatóság:** 🔄 — a refund-ág utólag hozzáépíthető; a felület-döntés a kontraktus-
képhez kötött, változtatása új terv-kört igényel (§2b).

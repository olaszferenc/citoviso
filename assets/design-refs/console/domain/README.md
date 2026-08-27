# Egyedi-domain felület — JÓVÁHAGYOTT TERV (ADR-0071 B blokk)

**Tulajdonosi döntés, 2026-08-27: a B VÁLTOZAT.** Ez a mappa a megvalósítás
**KONTRAKTUSA** — a kész felületet EHHEZ mérjük (§2b 5. pont).

| fájl | mit rögzít |
|---|---|
| `JOVAHAGYOTT-domain-ui-B.html` | a választott felület: **külön „Webcím" fül, 3 lépés** (1. Név → 2. Áttekintés → 3. Kész) |
| `allapot-1-folyamatban.html` | a beszerzés fut (a tulajnak nincs teendője) |
| `allapot-2-kesz.html` | kész — a honlap az új néven él, a régi cím odairányít |
| `allapot-3-sikertelen.html` | a nevet időközben elvitték → másik név választható |

## Amit a terv KÖT (nem stílus-javaslat, hanem elvárt viselkedés)

1. **Három lépés, külön képernyőn.** A fizetési döntés önálló pillanat (2. Áttekintés),
   nem ugyanazon a lapon, ahol a nevet választják.
2. **A jelenlegi cím látszik** (`<slug>.citoviso.com`) — a tulaj tudja, miről vált.
3. **Javaslatok + saját név.** A javaslatok a motor `suggestDomains()` kimenete;
   elérhetőség-jelölő három állapottal: szabadnak tűnik / foglalt / nem tudjuk előre.
   A foglalt nem választható.
4. **A beírt név viselkedése a VALÓDI szabály** (`domains.ts::normalizeCustomDomain`):
   `https://`, `www.`, záró perjel, nagybetű lecsupaszítva; végződés kötelező; csak
   `[a-z0-9-]`. A normalizált alak visszaíródik a mezőbe, hogy a tulaj lássa, mi történt.
   Hibás bemenetre sima magyar indoklás.
5. **Áttekintés-blokk:** választott cím · domain díja (1 év) · **24 hónap vállalás**
   (ADR-0020) · most fizetendő. Kimondva, hogy a régi cím nem szűnik meg, hanem
   automatikusan az újra irányít (ADR-0041 301).
6. **Fizetés után a tulajnak NINCS teendője** — a folyamat magától fut (ADR-0071),
   a képernyő a négy lépést mutatja, és e-mailben jelzünk.
7. **Mobil ÉS asztali elrendezés egyaránt kötelező** (ADR-0076). Keskeny nézetben a
   domain-név nem törhet szó közepén: az elérhetőség-jelölő csúszik a név alá.

## Sikertelen beszerzés — ELDÖNTVE (tulaj, 2026-08-27): A TENANT DÖNT

Ha a nevet a fizetés és a vétel között elviszik: **NINCS automata visszautalás.** A tenant
választ másik nevet, és a befizetett összeg arra fordítódik. A `allapot-3-sikertelen`
képernyő pontosan ezt kínálja.

⚠️ **A tulaj indoka pontosítva (a napló nem hazudhat):** azt feltételezte, hogy a visszautalás
banki integrációt igényelne. Valójában a **Barionnak van `Payment/Refund` API-ja** — a gateway
specifikációjának része, nem bank-kérdés. **De nálunk ebből semmi nincs megírva** (0 refund-ág
a kódban, mérve 2026-08-27). A döntés tehát helyes, csak az oka más: nem képtelenség, hanem
meg-nem-épített funkció; ha később kell, a Barion-adapter bővítése a helye.

**Amit a kód SOSEM tehet:** nem ígérhet a felületen visszautalást, amíg az nincs megvalósítva
(§B.17 — magunkról sem állítunk valótlant), és nem költ automatikusan a tenant helyett.

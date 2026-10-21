# Egyedi-domain felület — JÓVÁHAGYOTT TERV (ADR-0071 B blokk)

> ⚠️ **2026-09-27, ADR-0251:** az elérhetőség-jelölő (3. pont), az Áttekintés pénz-blokkja
> (5. pont), a folyamat-képernyő és a „Sikertelen beszerzés” szakasz **felülírva** — a
> hatályos terv: `../domain-zarolas/` (hiteles elérhetőség + zárolásos fizetés). A három
> lépés és a jelenlegi-cím sáv változatlanul él.

**Tulajdonosi döntés, 2026-08-27: a B VÁLTOZAT.** Ez a mappa a megvalósítás
**KONTRAKTUSA** — a kész felületet EHHEZ mérjük (§2b 5. pont).

| fájl | mit rögzít |
|---|---|
| `JOVAHAGYOTT-domain-ui-B.html` | a választott felület: **külön „Webcím" fül, 3 lépés** (1. Név → 2. Áttekintés → 3. Kész) |
| `allapot-1-folyamatban.html` | a beszerzés fut (a tulajnak nincs teendője) |
| `allapot-4-webcim-b.html` | **2026-10-21, ADR-XXXX — a „B” változat** (a fájlban a „B) Egy mondat + 3 szakasz” fül): a megvett név beállítása alatt látható állapot-képernyő; az `allapot-1` folyamat-képernyőjét felülírja |
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

## Állapot-képernyő a vétel után — ELDÖNTVE (tulaj, 2026-10-21): „B”

Kiváltó eset: az overseer.hu fizetés után a tenant csak annyit látott, hogy „Már intézzük”, és
„ez általában néhány perc”. .hu névnél ez nem igaz (a Nyilvántartó jóváhagyása akár egy nap),
és sehol nem volt időpont vagy határidő. A terv (`allapot-4-webcim-b.html`, B fül) KÖT:

1. **Egy mondat felül**, ami megmondja, MIKOR él az új címen a honlap. .hu név bejegyzés előtt:
   a vétel + 24 óra, egész órára felfelé kerekítve („Várhatóan csütörtök 16:00-ig …”); más
   végződés, vagy már bejegyzett .hu: „Néhány perc …”.
2. **Három szakasz:** Fizetés (és vétel) · Bejegyzés (.hu nyilvántartás / a cím beállítása) ·
   Élesítés. Kész = zöld, folyamatban = cián, késik = figyelmeztető szín.
3. **Késik:** 24 óra után (vagy setup_retry-ban) a mondat kimondja, hogy a vártnál tovább tart,
   és munkatársunk már intézi. A név az övé marad, ezt a mondat ki is mondja.
4. **Részletek időponttal:** a lépéslista, és minden KÉSZ lépés mellett az időpont, amikor
   megtörtént. Ahol az időpontot nem rögzítettük, ott nincs időpont (nem találunk ki).
5. **„Önnek nincs teendője. Amint kész, e-mailben szólunk.”**

A kész állapot (élő név) képernyője változatlanul az `allapot-2-kesz.html`.

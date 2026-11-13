## ADR-0444 — Egységes e-mail aláírás: „Jel + cián vonal” (A), csapat- és névvel aláírt olvasat

**Dátum:** 2026-11-13 · **Döntött:** tulaj (§2b terv-kör, 3 változatból: „A) kell”) ·
**Terv:** `assets/design-refs/console/email-alairas/` · **Kapcsolódik:** ADR-0101 (hideg levél, levélpapír),
ADR-0348/0354 (próba-levél), ADR-0425 (ügyfélsegítő perszóna), ADR-0439 (viselkedés-üzenet), 2026-10-03 K3 (a levél „Citoviso”-val ír alá)

**Kontextus.** A levelek aláírása három szürke szövegsor volt („Üdvözlettel, / Citoviso / citoviso.com · e-mail”),
logó nélkül — a tulaj szerint „nagyon gagyi, nem professzionális”. Öt levél öt külön módon írta alá magát.

**Döntés.**
1. **Egy aláírás-blokk** (`src/email/signature.ts`): balra a kerek Citoviso-jel (CID-képként, 56 px), cián függőleges
   vonal, félkövér sötétkék név, szürke szerep, címkézett elérhetőség (W / E / T). Outlook-biztos táblázat.
2. **Két olvasat, a konfigból:** ha az `OUTREACH_SENDER_NAME` a márka („Citoviso”) → **„A Citoviso csapata · Honlap és
   online láthatóság”**; ha személy → **„<Név> · <OUTREACH_SENDER_TITLE> · Citoviso”** (új env, pl. „alapító”).
   Személynév a kódban nincs. Az ügyfélsegítő-perszóna (ADR-0425) a saját nevével, „Citoviso ügyfélsegítő” szereppel.
3. **Hol:** hideg megkeresés, próba-levél, ügyfélsegítő belépés-levél, viselkedés-üzenet, mock-kész levél.
   A sima szöveges részek változatlanok (a §I-őr a kapuzott szöveget nézi).
4. **Postafiók-aláírás:** ugyanez a blokk beilleszthető HTML-ként (`mailbox-signature-{csapat,nevvel}.html`); a jel
   képe nyilvánosan a `citoviso.com/assets/brand/citoviso-jel-email.png` címen él (a deploy után).

**Visszafordíthatóság:** 🔄 — egy modul; a csapat/névvel váltás env-állítás, kód nélkül.
**Elvetett:** B (sötétkék névjegykártya — erősebb, de nehezebb a levél végén), C (logó felül — könnyebb, kevésbé márkás).
**Státusz:** megvalósítva, landolásra vár; élesen NINCS.

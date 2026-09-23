## ADR-0082 — Csatornánként külön küldés-kapu, és a hideg SMS mint VALÓDI, teljes jogú csatorna

**Dátum:** 2026-08-29 · **Státusz:** ELFOGADVA (tulajdonosi döntés két kérdésre: „kösd be élesen" +
„csatornánként egy-egy"; a kockázati kérdésre: „csak a saját számomra egyelőre") ·
**Kapcsolódó:** ADR-0030 (SMS-csatorna placeholderként), ADR-0080 ⑦ (GSM-relay), 03-INVARIANTS §A/§C.

**A kiváltó (tulaj-mérés, éles teszt).** A tulaj kiküldte a leadnek az SMS-t a konzol gombjával, majd
utána **e-mailt már nem tudott küldeni**: „Nem küldhető — ennek a prospectnek már kiküldtük a levelet
(nincs újraküldés)". A gyökér-ok két, egymást erősítő hiba:
1. **Csatorna-vak kapu.** Az e-mail újraküldés-kapuja a KÖZÖS `prospect.sent_at`-ra nézett
   (`sendBatch.ts`), az SMS-gomb pedig ugyanezt bélyegezte (`markProspectSent`) → az egyik csatorna
   használata VÉGLEG elzárta a másikat.
2. **Egy gomb, ami nem küld, mégis éget.** Az SMS-gomb ADR-0030 óta PLACEHOLDER volt: semmit nem
   továbbított, csak „sent"-re jelölt — miközben a GSM-modem és a küldő-adapter ADR-0080 ⑦ óta ÉL
   (a dunning-lépcső hajtja). A legrosszabb kombináció: nulla érték, teljes mellékhatás.

**A döntés.**
- **Csatornánként külön egyszeri-küldés.** Új oszlopok: `prospect.email_sent_at`, `prospect.sms_sent_at`
  (0042). A `sent_at` marad az ELSŐ ÉRINTÉS bélyege (H1-funnel bázis, riportok érintetlenek), a
  kapuk a saját csatorna-oszlopukból dolgoznak. Egy csatornán továbbra is EGYSZER megy ki hideg
  megkeresés — a másik ettől szabad marad.
- **Az SMS valódi csatorna lett**, a levéllel AZONOS kapu-sorral (`src/outreach/sendOutreachSms.ts`).
- **A felület kattintás ELŐTT mondja meg az állapotot** (csatorna-címke + a használt csatornán nincs
  gomb). A régi viselkedés — „kattints, majd egy piros sávból tudod meg, hogy eleve tilos volt" —
  ugyanannak a hibának a felületi fele.

**A kapu-paritás nem magától lett meg (jog/provenance-őr, ugyanaznap).** Az első verzióm fejléc-kommentje
azt ÁLLÍTOTTA, hogy „the same gates, not fewer" — és NÉGY kapu hiányzott belőle. Az őr FLAG-elte, még az
első valós küldés előtt. Ami hiányzott és most megvan:
| Kapu | Levél | SMS (előtte → most) |
|---|---|---|
| Személy-szintű opt-out | `isEmailSuppressed` (cím) | ✗ → `isPhoneSuppressed` (normalizált szám; újragenerált mock = új prospect-sor, a régi opt-outja is véd) |
| Artifact generáláskori őr-verdiktek (§A) | van | ✗ → van (ugyanazt a mock-linket tolja telefonra) |
| §C-verifier a TÉNYLEGESEN kimenő szövegre | `checkOutreachDraft(body)` | a levél bodyját mérte → `checkOutreachSms(sms.text)` |
| Jogalap-mondat a küldeményben | „jogos érdek" sor | ✗ → benne a szövegben, és a kapu KÖVETELI |
Plusz: a beszélő slug az SMS-linken is (idegen szám + csupasz token = a legerősebb phishing-szignatúra),
kitöltetlen feladó-envnél már nem „Citoviso" fallback, hanem a kaput bukó jelölő, és **küldési időablak
(8–20)**, mert az éjjeli hideg SMS panasz, nem lead.

**Elfogadott maradék-kockázat + a fék rá.** A SIM megosztott a Minerallal (idegen szám a címzettnek) és
nincs bejövő „STOP"-feldolgozás; az opt-out egyetlen útja a link. Ezért a tulaj döntése:
`OUTREACH_SMS_ALLOWLIST` — a teljes út él és tesztelhető, de hideg SMS **csak a listán lévő számokra**
megy ki (ma: a tulaj sajátja). Feloldás = egy env-sor, ha lesz dedikált szám + STOP-kezelés.
⚠️ Nyitva marad: prod `SMS_PROVIDER=queue` esetén a „siker" = SORBA TÉVE, nem kézbesítve — néma
relay-hiba után a csatorna mégis zárul (retry-út nincs).

**Meta-tanulság (a fontosabb).** Egy őr, ami sosem bukik el, dísz: a `MISLEADING_PATTERNS` a
legtermészetesebb magyar mondatot („Elkészült az új **honlapja**!") átengedte, mert csak `…oldala`
alakot ismert — MINDKÉT csatornán, hónapok óta. Nem elemzésből derült ki, hanem abból, hogy az új
kaput szándékosan PIROSRA futtattam. Új őr mellé kötelező a piros próba.

**Visszafordíthatóság:** 🔄 additív (két oszlop + egy modul); a csatorna-szétválasztás visszavonása
viszont adatvesztéssel járna, az SMS-út kikapcsolása egy env-sor.

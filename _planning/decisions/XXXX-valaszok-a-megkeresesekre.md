## ADR-XXXX — Válaszok a megkeresésekre: gyűjtés a dev gépen, tárolás a lead-gazdán, irányítópult-blokk

**Dátum:** 2026-10-07 · **Döntött:** tulaj („nyitó oldalán jelenjen meg: melyik lead küldte mikor mit,
megvan-e válaszolva. ugrás a lead oldalára”; a B terv jóváhagyva), megvalósítás: CIT session

**Kontextus.** 2026-10-07-én három valódi válasz érkezett a megkeresésekre (2 SMS, 1 e-mail), és
egyikről sem tudott a rendszer: az SMS-ek a dev gép GSM-modemjének gammu `inbox` táblájában (a modem
MineREAL-lel KÖZÖS), a levél a Zoho INBOX-ban ült, a sok saját BCC-másolat, DMARC-riport és
visszapattanás között. A tulaj csak véletlenül vette észre őket.

**Döntés.**
1. **Adatút.** A források a dev gépen vannak, a leadek a konzol gazdáján. Gyűjtő a dev gépen
   (`scripts/replies-collect.mts --sms` 60 mp-enként, `--email` 120 mp-enként, systemd timer a FŐ
   fából) → `POST /api/replies/ingest` (bearer) → a szerver PÁROSÍT és tárol (`outreach_reply`,
   migráció 0093) → az irányítópult blokkja ebből él. A csatornánkénti utolsó lekérdezés
   (`outreach_reply_poll`) akkor is íródik, ha nem jött semmi: a csend és a halott gyűjtő így
   megkülönböztethető (a blokk frissesség-sora 10 perc fölött figyelmeztet).
2. **A végpont a PUBLIC szerveren van**, az SMS-relay mellett: a konzolon nincs bearer-út (csak
   operátor-süti), a relay hostja és titka (`SMS_RELAY_URL/SECRET`) már ott van a dev gépen.
   1 MB testkorlát, idempotens kulcs (`sms:<legkisebb gammu ID>` / `email:<Message-ID>`).
3. **Mi számít válasznak — a szerver dönt** (`matchReply`): csak olyan feladó, akinek
   Citoviso-megkeresés ment (telefon E.164 / e-mail cím egyezik a leadével), és csak az első
   megkeresés UTÁN. A nem egyező feladót a szerver ELDOBJA, nem tárolja (MineREAL-ügyfelek SMS-ei).
   Közös számnál a legutóbb megkeresett lead kapja. A gyűjtő csak a nyilvánvaló nem-válaszokat
   szűri (saját BCC-másolat, `mailer-daemon`, DMARC, `Auto-Submitted`).
4. **Csak olvasás.** gammu: `SELECT`, a `Processed` mezőt nem írjuk (a MineREAL-oldal használja).
   IMAP: `EXAMINE` + `UID SEARCH` + `BODY.PEEK` — a `\Seen` jelzés nem változik; az olvasó minden
   más FETCH-et a küldés ELŐTT elutasít. A gyűjtő a fejléceket kéri le előbb, és csak a
   válasz-jelöltek törzsét tölti le: a BCC-másolatok törzse le sem jön.
5. **A `TextDecoded` nem megbízható** (mért, inbox ID 10+11): a többrészes SMS 1. részének
   `TextDecoded`-ja a TELJES üzenetet tartalmazta, a 2. részé ÜRES volt, a szöveg a `Text`
   (UCS-2 hex) mezőben ült — a `Coding=Default_No_Compression` ellenére. Ezért részenként a
   `Text` dekódolva az elsődleges, a `TextDecoded` csak tartalék; a részeket UDH (ref/total/seq)
   fűzi össze. Hiányzó rész legfeljebb 10 percig tartja vissza az üzenetet, utána `partial`-ként
   kimegy (egy elveszett rész nem rejtheti el a választ). E-mailnél a válasz idézett része (a mi
   levelünk) nem a válasz része (`stripQuoted`, a Gmail-HU kétsoros fejlécére is).
6. **Megválaszolva: kézi + automatikus.** „Megválaszoltam” = az operátor neve és ideje;
   „Visszavonás” = vissza nyitottra, és `answer_undone_at` rögzül. E-mailnél az Elküldött mappa
   alapján automatikusan is beáll (`postafiók`), ha a válasz UTÁN levél ment ugyanarra a címre —
   de soha nem egy kézi visszavonás fölé (a kézi döntés erősebb). SMS-nél csak kézi jelölés
   (a jóváhagyott terv szabálya).
7. **Felület (B terv, `assets/design-refs/console/valaszok/`).** Az irányítópult tetején blokk:
   asztalin lista + beszélgetés két oszlopban, mobilon lista VAGY beszélgetés („Vissza”). A
   megválaszolatlanok száma együtt mozog az oldalmenü Irányítópult-során, a „Figyelmet kér”
   sorában és a blokk jelvényén (a jelöléskor a menü 15 mp-es számláló-cache-e ürül); a
   Megkeresések widget „Válaszolt” sora az összes választ számolja. A „Megválaszolatlan” szűrőn a
   KIVÁLASZTOTT, már megválaszolt válasz látható marad — különben a „Megválaszoltam” után eltűnne
   a beszélgetés és vele a „Visszavonás”.

**Őr.** `scripts/outreach-reply-check.mts` (+ `--self-test`, `hooks/pre-commit`): párosítás,
a 10+11-es valódi gammu-alak, Gmail-HU idézet, FETCH csak PEEK-kel, automatika vs. visszavonás,
a blokk szűrő-szabálya.

**Elvetett.** (a) A gammu `Processed` jelzőjének használata „feldolgozva” állapotra — a modem közös,
a MineREAL-oldal folyamatait zavarná. (b) A gyűjtő a lead-adatbázist közvetlenül írja — a leadek a
konzol gazdáján élnek, élesen a dev gép nem lát bele. (c) Minden beérkező SMS/levél tárolása, a
párosítás a felületen — idegen (MineREAL-ügyfél) személyes adatot tárolnánk cél nélkül.

**Visszafordíthatóság.** 🔄 Új tábla + új blokk; a timerek leállításával a gyűjtés megáll, a meglévő
folyamatokat nem érinti.

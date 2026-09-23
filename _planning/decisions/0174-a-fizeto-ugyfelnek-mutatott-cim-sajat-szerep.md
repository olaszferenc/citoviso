## ADR-0174 — A fizető ügyfélnek mutatott cím SAJÁT szerep: nem a megkeresés-feladó, nem az Impresszum (2026-09-15)

**Státusz:** elfogadva (tulajdonosi döntés) · **Kiváltó:** Elek FK-002 · **Cím:** `info@citoviso.com`

### Kontextus

A tenant-admin „Kérdése van a csomagról? Írjon:" linkje és a **belépési súgó** a
`config.outreachSender.email`-ből olvasott. Az a mező a **hideg megkeresés jogilag kötelező
feladó-azonosítása** (§C.2, ADR-0130) — nem support-cím. A dev-konfigon mérve **személynév**
(`olasz.ferenc@citoviso.com`), vagyis egy MÁR FIZETŐ ügyfelet egy magánszemélyhez küldtünk.

Ugyanezen a napon egy **párhuzamos szál** ugyanennek a hibának a másik felét mérte ki
(`358cade`): a három **fizetés-lap** (elutasított kártya + két visszaigazolás) **beégetve**
`info@citoviso.com`-ot írt, ami akkor a konfigurációban sehol nem szerepelt. Ők a vízvezetéket
javították (egy forrás a hívótól, és **cím hiányában a mondat ELMARAD**, nem cserélődik
hihetőre — §B.17); ez az ADR a **szerepet** mondja ki alatta.

### Döntés

1. **Új, önálló mező:** `config.supportEmail` (`SUPPORT_EMAIL` env, alapértelmezés
   `info@citoviso.com`). Ez az egyetlen forrás minden vevő-oldali „írjon nekünk" ponton:
   Modulok fül · belépési súgó · a három fizetés-lap.
2. **Három szerep, három mező — tilos összevonni:**
   - `supportEmail` — ide ír a FIZETŐ ügyfél;
   - `outreachSender.email` — a hideg levél kötelező feladó-azonosítása (§C.2);
   - `legalEntity.email` — Impresszum (Eker.tv. 4. §).
   Ma mind a három ugyanarra a postafiókra mutathat; a KÖTELEZETTSÉGÜK akkor is más, és
   bármelyik változhat a másik kettő nélkül.
3. **Beégetett cím vevő-oldali forrásban tilos.** A korábbi `"hello@citoviso.com"` tartalék
   sehol nem volt beállítva: ha valaha hatályba lép, a fizető ügyfél levele a semmibe megy.

### Következmények

- ⛔ **EMBERI FÜGGŐSÉG, amit a kód nem tud kiváltani:** élnie kell a Zoho-aliasnak a
  `info@citoviso.com` címre. A repó saját infra-jegyzete (2026-08-03) szerint ez **ingyenes
  alias ugyanarra a postafiókra** — de az egy **hat hetes leltár-sor, nem friss mérés**
  (`feedback_inventory_line_is_not_a_measurement`), és a párhuzamos szál aznap épp az
  ellenkezőjét állapította meg a konfigurációból.
- ⛔ **A kézbesíthetőség innen NEM mérhető:** a 25-ös port kifelé zárva (mérve: ECONNREFUSED
  mind a 7 próbacímre, a biztosan létező `olasz.ferenc@`-re is). Az őr ezért a HIVATKOZÁS
  egységességét őrzi, és a **saját határát kimondja a kimenetén** — nem állítja, hogy működik.
- ℹ️ **Rögzített, NEM javított lelet:** a belépési súgón a cím SZÖVEG, nem `mailto:` link —
  egy kizárt ügyfélnek telefonon át kell gépelnie. Külön döntésre vár.

### Az őr

`scripts/support-email-check.mts` (pre-commit): nincs beégetett cím a három vevő-oldali
forrásban · minden felület ugyanazt a címet rendereli · a hívó a support-mezőt adja át · cím
hiányában a mondat elmarad · a jogi cím a saját mezőjéből jön. Piros önteszt: a 2026-09-15
előtti alak visszaállítva (beégetés + megkeresés-feladó) → mind a 4 nevesített állítás bukik.

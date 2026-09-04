# Elek teszt-scope — tulajdonosi döntés: ALL IN + kiküldés-kör (2026-09-04, ADR-0095)

A tulaj szava: *„All in: a scrapelt lead mock generálás és kiküldéstől egészen a tenant
vásárlás bővítés lemondás stb."* — majd pontosítva: *„nyomjon kiküld gombot! de minden esetben
a saját emailcímére érkezzen a megkeresés és onnan folytassa. Fontos, hogy a lehető legtöbb
esetet teszteljen és futtasson: Nem teljesült fizetés, időtúllépés mittomén."*

## A hurok szakaszai → forgatókönyvek

| FK | Szakasz | Állapot | Előfeltétel |
|---|---|---|---|
| FK-000 | Infra-füst (konzol él, napló kitölthető) | ✅ fut | `elek` operator_user (megvan) |
| FK-003 | Operátor lead-út: lista, szűrők, diszkvalifikált nézet | ✅ fut | scrape-elt leadek (vannak) |
| FK-003b | Lead-lap + mock-generálás állapotai (ELEK-TESZT leaden) | írásra kész | ⛔ ELEK-TESZT lead seed |
| FK-004 | **Kiküldés-kör:** draft + §C-kapuk → „Küldés" → a levél MEGÉRKEZIK elek@citoviso.com-ra → link-kattintás → funnel/prospect-út | írásra kész | ⛔ elek@citoviso.com + IMAP + ELEK-TESZT lead (email = elek@) |
| FK-001 | Tenant-admin: Dokumentumok + Üzenetek | írásra kész | ⛔ ELEK-TESZT tenant seed |
| FK-002 | Modulok-fül: kirakat, előnézet, tervsáv, díj-delta | írásra kész | ELEK-TESZT tenant |
| FK-005 | Vásárlás-kör a mock-gateway-en: rendelés → fizetés → élesítés-út | írásra kész | ELEK-TESZT tenant + elek@ |
| FK-006 | **Bukás-mátrix** (lásd lent) | tervezés | seed + időutazó-setup |

## Eset-mátrix (a „lehető legtöbb eset" — tulaj-cél)

A happy path önmagában keveset bizonyít; minden körhöz a bukás-ágak is járnak:

- **Fizetés:** sikeres · **elutasított/nem teljesült** (mock-gateway bukás-ág) · megszakított
  (visszalépés fizetés közben) · **időtúllépett/lejárt fizetőlink** · már-fizetett újratöltése
  (dupla-terhelés tilalma).
- **Előfizetés-életciklus (ADR-0080):** T−3 előértesítő → T terhelés → T+3/T+7 emlékeztetők →
  **T+10 freeze (vendégnek 503)** → fizetés utáni azonnali thaw → T+30 lezárás. Az állapotok
  IDŐFÜGGŐEK: a beállításuk fejlesztő-session SETUP (seed/időutazó helper, tulaj-jóváhagyással);
  Elek a FELÜLETET és a beérkező leveleket ítéli.
- **Űrlap-élek:** üres/hibás input, hibaüzenetek, dupla-kattintás a fizetés/mentés gombon,
  vissza-gomb a folyamat közepén, lejárt session.
- **Outreach-élek:** kapu-verdiktek (PASS/FLAG láthatóság), újraküldés-tilalom (sent_at-pecsét),
  leiratkozó-link működése a SAJÁT levélben.
- **Lemondás-élek:** modul-lemondás fordulóig aktív → visszakapcsolható; teljes lemondás
  kétlépcsős veszély-zóna; (domain-kötbér elszámolás-képernyő: majd ha implementálva van).

## Kőbe vésett határok (charter — az ALL IN sem írja felül)

1. **Kiküldés CSAK elek@citoviso.com címzettre** (ADR-0095 ④): az FK Előkészítése a felületen
   ELLENŐRZI a címzettet; bármely más cím = teljes stop, ELŐFELTÉTEL-HIBA. A kiküldött levél
   Elek saját fiókjába érkezik, onnan lead-ként folytatja.
2. **SMS/MMS-küldés tilos** (valódi SIM → valódi szám; Eleknek nincs száma). ⚠️ **MÉRVE
   (2026-09-04): az SMS-loopback a modem SAJÁT számára NEM járható** — a gammu feladta
   (queue-id 35), de a hálózat kétszer is eldobta (`status=10, reference=-1`,
   `UNKNOWN[27]`); a sor kitakarítva. A gépi opt-in (`ELEK_SMS_SELF=1`) a kódban marad,
   de amíg egy MMS-self mérés mást nem mond, az SMS/MMS-ág embert igényel — leletben
   „KÉZI KELL"-ként jelzi.
3. **Külső fizetés-gateway tilos; a lokál MOCK-gateway a pálya** — bukás-ágakkal együtt.
4. **Mock-generálás CSAK ELEK-TESZT leaden** (valós lead funnel-adatát nem szennyezi;
   a generálás valós AI-hívás, ~$0.2/mock — mért, vállalt költség).

## Előfeltétel-teendők

- **Tulaj:** `elek@citoviso.com` postafiók a Zoho adminban (fogadás + IMAP; ez most már a
  kiküldés-kör KEMÉNY előfeltétele) → az IMAP-hozzáférés Elek konfigjába.
- **Fejlesztő-session (tulaj jóváhagyással):** ELEK-TESZT lead seed (kontakt-email =
  elek@citoviso.com) · ELEK-TESZT tenant seed (vevő-email = elek@citoviso.com) · időutazó
  helper a dunning-állapotokhoz (FK-006).

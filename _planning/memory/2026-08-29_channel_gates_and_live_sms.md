# 2026-08-29 — Csatornánként külön küldés-kapu + a hideg SMS valódi csatornává tétele (ADR-0082)

## A kiváltó (tulaj-mérés élesben)
A tulaj a konzol SMS-gombjával „kiküldte" a leadnek az üzenetet, **utána e-mailt már nem tudott
küldeni**: „Nem küldhető — ennek a prospectnek már kiküldtük a levelet (nincs újraküldés)".
Empirikusan igazolva a dev DB-ben: `prospect.sent_at = 2026-08-29 18:49:18` = a kattintás perce.

Két hiba egymásra torlódva:
1. **Csatorna-vak kapu:** az e-mail újraküldés-kapuja (`sendBatch.ts`) a KÖZÖS `sent_at`-ot nézte,
   az SMS-gomb (`markProspectSent`) ugyanazt bélyegezte → az egyik csatorna elzárta a másikat.
2. **Placeholder, ami éget:** az SMS-gomb ADR-0030 óta semmit nem küldött, csak „sent"-re jelölt —
   miközben a GSM-modem és a `sendSms()` adapter ADR-0080 ⑦ óta ÉL (a dunning hajtja). Nulla érték,
   teljes mellékhatás.

## Amit csináltunk
- **0042 migráció:** `prospect.email_sent_at` + `prospect.sms_sent_at`; a `sent_at` marad az ELSŐ
  ÉRINTÉS (H1-funnel bázis) — a riportok nem törtek el. Backfill konzervatív (minden eddigi
  `sent_at` = e-mail), a tulaj SMS-sel elégetett teszt-prospectjét külön, kimondva állítottam vissza.
- **`src/outreach/sendOutreachSms.ts` (új):** valódi SMS-küldés a levéllel AZONOS kapu-sorral.
- **Felület:** a draft-oldal csatorna-kártyái KATTINTÁS ELŐTT mondják meg az állapotot
  (`még nem ment ki` / `kiküldve — <időpont>`), a használt csatornán nincs gomb. §2b kivétel-úton,
  a tulaj kimondott engedélyével (naplózva a `surface-gate`-ben).
- **Mellékhalászat:** 8 elromlott inline handler (`onclick=T(lang, "…")` szó szerint a HTML-ben) —
  a draft-oldal MÁSOLÁS-gombjai nem működtek, pont az A2 kézi küldés eszközei. Javítva + `jsStr()`
  escape-helper. Playwrighttal végigkattintva: 0 JS-hiba.

## A lényeg: a kapu-paritás nem magától lett meg
A jog/provenance-őr **FLAG**-elte az első verziómat — a fejléc-kommentem azt ÁLLÍTOTTA, hogy
„the same gates, not fewer", és NÉGY kapu hiányzott: szám-szintű opt-out, artifact-őrverdiktek,
§C-verifier a ténylegesen kimenő szövegre, jogalap-mondat. Mind pótolva (részletes tábla: ADR-0082).
Az őr még az első valós küldés ELŐTT fogta meg.

**Meta (a fontosabb):** a `MISLEADING_PATTERNS` a legtermészetesebb magyar mondatot
(„Elkészült az új **honlapja**!") átengedte, mert csak `…oldala` alakot ismert — MINDKÉT csatornán,
hónapok óta. Nem elemzés találta meg, hanem hogy az új kaput szándékosan PIROSRA futtattam.

## Módosított / létrehozott fájlok
- `migrations/0042_prospect_channel_stamps.sql` (új)
- `src/outreach/sendOutreachSms.ts` (új) · `src/outreach/sendBatch.ts` · `src/outreach/draft.ts`
  · `src/outreach/outreachCheck.ts`
- `src/console/data.ts` · `src/console/server.ts` · `src/console/views.ts` · `src/db/schema.ts`
  · `src/config.ts` · `src/i18n/catalog.json`
- `_planning/DECISIONS.md` (ADR-0082)

## Nyitott kérdések
- **Dedikált szám + STOP-kezelés.** Ma a SIM megosztott a Minerallal, bejövő „STOP" nincs feldolgozva
  → `OUTREACH_SMS_ALLOWLIST` fékezi (ma csak a tulaj száma). Feloldás = env-sor, ha lesz saját szám.
- **Prod `SMS_PROVIDER=queue`:** a „siker" = SORBA TÉVE, nem kézbesítve — néma relay-hiba után a
  csatorna mégis zárul, retry-út nincs. Kézbesítés-visszajelzés (ack → `sms_sent_at`) hiányzik.
- Az `OUTREACH_SMS_ALLOWLIST` az éles `.env`-be is kell, mielőtt az SMS-út élesre megy.

---

## Kiegészítés ugyanaznap este — ADR-0083: MMS+SMS PÁROS (a tulaj meglátása nyomán)

**Tulaj:** „hideg SMS = az egyik legrosszabb forma (eskü-nem-lenyúlós-link); MMS-ben már a
megnyitáskor jöhet a WOW." Kézi próba a saját számára: Pitypang hero → 35 KB JPEG →
`sudo mms-send` → kézbesítve, ítélet: „fasza". Az irány-javaslat (páros modell) jóváhagyva.

- **ADR-0083:** hideg mobil-megkeresés = MMS (kép, wow) + kísérő SMS (link+jogalap+opt-out —
  az MMS fizikailag nem tud szöveget vinni: csak kép+ASCII tárgy). Önálló hideg SMS-gomb
  KIVEZETVE a felületről; tranzakciós SMS (dunning) érintetlen.
- **§2b kör:** 2 működő mock (A: kompakt kártya telefon-előnézettel; B: idővonal hiba-ággal) →
  a tulaj a B-t választotta → kontraktus: `assets/design-refs/console/mobile-pair-outreach/`.
- **Implementáció:** 0043 `mms_sent_at` (= a pár CLAIMJE; sms_sent_at nélkül = megszakadt pár),
  `src/mms/sender.ts` (mock|cli adapter + PIL-konverzió ≤290 KB), `sendOutreachPair.ts`
  (háttér-job + in-process registry, a draft-oldal 4 mp-enként frissül futás alatt),
  `mobileOutreachGates()` KÖZÖS kapu-lánc (az ADR-0082 tanulsága: a „ugyanazok a kapuk"
  emlékezetből egy napon belül driftel — ezért EGY függvény), `renderPairSmsDraft`.
- **Hiba-szemantika (tesztelve):** MMS bukik → claim felenged, semmi nem ment ki, pár
  újraindítható. SMS-fele bukik → claim MARAD (a lead látta a képet), csak az SMS-fele
  megy újra („SMS újra" gomb); a retry újrafuttatja a kapukat (közben jöhetett opt-out!).
- **Időablak-kivétel:** allowlistelt szám = definíció szerint a tulaj teszt-száma → a
  címzett-védő 8–20 ablak nem áll rá (üres lista = valós outreach, nincs kivétel).
- Élesben `MMS_PROVIDER=cli` kell a .env-be (ma mock a default).

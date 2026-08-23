# 2026-08-22/23 — Jogi réteg · partner-törzs · számla-kiküldés · upsell-kapu · konzol-arányok

Egy szál, hat szelet. A kiváltó kérdés ártatlan volt („milyen jogi dokumentumok kellenek a
honlapra?”), és a végén két bevételi rés és egy fizető-vevőt félrevivő link is előkerült.

## 1. Jogi dokumentum-réteg (ADR-0056)

Egyetlen jogi dokumentum élt (`/privacy`), az is csak az outreachre. A fizetős kapu gerince
viszont MÁR állt és a szövegre várt: a `config.termsUrl` szándékosan üres volt, ezért a checkout
meg sem jelenítette az ÁSZF-elfogadó sort (0029). Nem infrastruktúra hiányzott, hanem a szöveg.

Új: **ÁSZF** (12 pont), **Elállási tájékoztató + mintanyilatkozat**, **Adatfeldolgozási feltételek**
(GDPR 28. cikk, mind a 8 pont), az adatkezelési tájékoztató **előfizetői + számlázási** fejezetekkel.
Mind `src/legal.ts`-ben, verziózva, `i18n-exempt`-tel (§H.22: a jogi szöveg determinisztikus).

**Az elállás nem hagyható el „mert B2B vagyunk”** — a `validateBuyer` `individual` (fogyasztó)
vevőt is elfogad, és a meglévő `WITHDRAWAL_WAIVER_V1` lemondás CSAK előzetes tájékoztatás mellett
érvényes. Ezt először tévesen jelentettem ki, a kód olvasása korrigálta.

**Impresszum-adatok env-ből** (`LEGAL_ENTITY_*`), sosem a repóból; kitöltetlenül `[KITÖLTENDŐ: …]`.

**Mellék-lelet:** a kiküldött mock láblécének `/adatvedelem` linkje **404 volt** (a route
`/privacy` néven létezett) — minden hideg megkeresés halott jogi linket vitt.

⚠️ **Korrekció még aznap:** az első változat a checkout ÁSZF-sorát az impresszum-adatok
kitöltöttségéhez kötötte. Ez eltörte a végponttól végpontig tesztet (ami a tesztkörben
láthatatlan, az marad ellenőrizetlen), és redundáns is volt: a deploy-kapu már véd.
**Tanulság: készenléti feltétel KAPUBA való, nem a futásidejű útba.**

## 2. Partner-törzs + számlázási címzettek (0032)

A tulaj kérése: a vevő a céges adatoknál több számlázási e-mail címet is megadhasson, és ezek a
partnerhez mentődjenek „partneri kapcsolatok” alatt.

⚠️ **Koordinációs lelet:** a partnertörzs egy AKTÍV párhuzamos szálban épült
(`wt/cit9d089052/migrations/0031_accounting_documents.sql`), **commitolatlanul**. Amíg dolgoztam,
**átírták alattam** — de jó irányba: kivették a partner-részt és beírtak egy átadó-jegyzetet
(„a partner-törzset egy MÁSIK SESSION viszi”). Ezért NEM vettem át és nem landoltam az ő
fájljukat. **Egy hibát találtam benne közben:** az első verziójuk nem futott le
(`relation "gl_account" does not exist` — előrehivatkozás); azóta maguk javították.

Az enyém: `partner` + **`partner_contact`** (szerepekkel: billing/general/technical/legal) +
`order_intent.billing_emails` (a szerződéskötéskori pillanatkép). Fizetéskor
`upsertPartnerFromOrder` hozza létre a partnert a 0029 nyilatkozatból.
**Szándékosan önálló migráció:** nincs benne FK a nem-landolt 0031 tábláira — mérve, hogy lefut
a 0031 NÉLKÜL és VELE EGYÜTT is.

## 3. A számla elmegy a vevőnek

Eddig a számla kiállítódott, elmentődött (`pdf_base64`) és **senkinek nem ment el**. A mock mögött
ez láthatatlan volt: *egy mock számla, amit senki nem küld el, pontosan úgy néz ki, mint egy valódi
számla, amit senki nem küld el.* A PDF **melléklet**, nem letöltő link (a könyvelő továbbküldi).
A küldés külön modul (`src/billing/invoiceDelivery.ts`), mert ez volt a hiányzó lépés — saját
varrat kell hozzá, amit az őr közvetlenül hajthat.

⚠️ **Őr-incidens:** az őr első futásakor VALÓDI levelet küldött a prod SMTP-n kitalált címekre.
Ok: a `config` EGYSZER olvassa az envet modul-betöltéskor, én utána állítottam mockra, a `.env`-ben
pedig `EMAIL_PROVIDER=smtp`. Javítva + **hard leállás**, ha a feloldott adapter nem `mock`.

## 4. Modul-upsell fizetési kapu (0033)

**Mért rés:** a `POST /admin/modules` a posztolt modul-listát nyersen adta a `setTenantModules`-nak
— jogosultság- és fizetés-ellenőrzés nélkül. A tenant-admin a TELJES katalógust listázza árral,
így egy alapcsomagos ügyfél **6 480 Ft/hó** értékű modult kapcsolhatott be ingyen.

Nem rejtett kiskapu (a felület korrektül kiírta az új havidíjat) — **elmaradt bevétel**, két okból:
`scripts/billing-cycle.ts` nincs ütemezve (se cron, se timer), és ha futna, a **befagyott**
`order_intent.price`-t terhelné.

Most: kikapcsolás ingyenes és azonnali; ingyenes modul azonnal; **fizetős modul → új upsell
order_intent + Barion pay-link**, az entitlement a webhookban billen. Pay-link nélkül SEMMI nem
kapcsol be (fail-closed).

## 5. A vevő a SAJÁT belépőjére kerül

A `/pay/done`-t az OPERÁTOR konzol szolgálja ki, a „Belépek és szerkesztem” gomb viszont **relatív**
`/login`-ra mutatott — a fizető ügyfél a mi belső bejelentkezésünkre került. A felirat ráadásul
beégetve `citoviso.com/login` volt: a szöveg és a link mást mondott. Ugyanaz a hibaosztály, amit a
`tenantSiteUrl`-nél már egyszer javítottak.

**Így találtam meg:** kirendereltem a négy vevői fizetés-állapotot és megnéztem 390px-en.
(Elsőre CSS nélkül renderelt, és majdnem stílus-hibaként jelentettem — az asset-utak
abszolutizálása után derült ki, hogy a lap rendben, csak a link rossz.)

## 6. Konzol-arányok (tulaj-iterációk)

Három körben, mert kétszer rosszul céloztam:
1. Árazás: `table.kv` szűk oszlopa háromsorosra törte a feliratokat → `.con-edit-grid`.
   **Kódolási hiba is:** a mentés-átirányítás kódolatlanul tette az ékezetes szöveget a `Location`
   fejlécbe → „�raz�s mentve.” (a hiba-ág végig helyesen csinálta).
2. **Túllőttem:** minden tényt bedobozoltam → a semmitmondó „kontakt-csatorna: email” ugyanakkora
   súlyt kapott, mint a szekció maga. Vissza: keret nélkül, tipográfiai rangsor.
3. A tulaj a **kártya-fejlécre** gondolt: a konténer címe 0,78rem volt, a tartalma 0,95rem —
   **a kártya címe kisebb, mint a tartalma.** 1,05rem-re + 13/20px paddingre.
   Közben: a „szerkesztve” jelvény **olvashatatlan** volt (fehér szöveg fehér `.pill`-en).

**Vissza-link:** a `.con-back` minta létezett, de EGYETLEN helyen. Az outreach-piszkozat a lead
al-oldala, mégsem lehetett visszalépni belőle → a draft-builder mostantól visszaadja a `leadId`-t.

## 7. Kiküldési infrastruktúra

A §C-őr jogosan tiltotta a levelet: `PUBLIC_BASE_URL` Tailscale-cím volt (100.64–127.x), a
címzettnek halott link. **A tulaj javaslata oldotta meg** („miért nem jó bármilyen alcím mögé”):
a gépnek van Tailscale HTTPS neve, és a **funnel már élt** → `https://mineral.tail3a89f.ts.net:8443`
a konzolra (a 443 foglalt, nem nyúltunk hozzá). Publikus HTTPS ⇒ a Barion **callback is** megérkezik.
Feladó-identitás kitöltve. Maradt egy kapu: az árak véglegesítése (tulaj-döntés, megtörtént).

## Módosított/új fájlok (fő tételek)

`_planning/DECISIONS.md` (ADR-0056) · `src/legal.ts` · `src/server/legalViews.ts` ·
`src/config.ts` · `src/server/public.ts` · `src/console/server.ts` · `src/console/views.ts` ·
`migrations/0032_partner_registry.sql` · `migrations/0033_module_upsell.sql` ·
`src/billing/partner.ts` · `src/billing/invoiceDelivery.ts` · `src/email/invoiceEmail.ts` ·
`src/tenant/moduleUpsell.ts` · `public/assets/ui/citui-console.css` ·
őrök: `scripts/legal-check.mts`, `scripts/partner-registry-check.mts`, `scripts/module-upsell-check.mts`

## Nyitott

1. ⛔ **Ciklikus számlázás NEM fut** — nincs cron/timer a `billing-cycle.ts`-hez, és a megújítás a
   befagyott `order_intent.price`-t terhelné. A **második** díj soha nem megy ki senkinek.
   Ez a legnagyobb maradó bevételi rés, és egy A–Z körön NEM látszik.
2. Az ÁSZF 15 napos lejárati értesítőjének **nincs ütemezője** — a szöveg olyat ígér, amit a gép
   nem teljesít.
3. A **tenant-oldalak jogi minimuma** (foglalási űrlap tájékoztató nélkül, Omnibus
   vélemény-valódiság) — külön szelet.
4. Tenant számla-felület: a `accounting_document`-re épülne, ami a másik szálé és még nem landolt.
5. Ügyvédi ellenőrzés az első éles eladás előtt (DPA, felelősség-korlátozás, domain-átszállás).

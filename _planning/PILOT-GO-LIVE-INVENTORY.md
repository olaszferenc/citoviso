# PILOT-ÉLES LELTÁR — mi hiányzik az éles pilot-induláshoz

*Felmérve: 2026-09-06 · csak OLVASÁS (deploy-doktrína §0.4) — élesre semmi nem íródott.*

**Mért kiindulás:** az éles `a8304ee`-t futtatja (2026-08-26, `prod/20260826-0840`);
az `origin/main` **118 committal** előrébb jár, **17 migráció** vár lefuttatásra
(0038–0052: előfizetés-motor, dunning, ajánlat-réteg, domain-modul, booking-levelek,
befagyasztott ár). A teljes booking + ár + előfizetés + dokumentum/üzenet-köteg
**lokálban zöld, élesen NINCS KINT.**

---

## A) BLOKKOLÓ — TULAJ (külső fiókok, gép nem tudja megcsinálni)

| # | Tétel | Státusz | Blokkoló? | Következő lépés |
|---|---|---|---|---|
| A1 | **Számlázz.hu ÉLES Agent-kulcs** | Prodban kulcs VAN, de a teszt-fióké; `INVOICE_PROVIDER=mock` → éles vevő NEM kap valódi számlát | ⛔ IGEN — fizetés számla nélkül jogilag nem mehet | Tulaj: éles Számlázz.hu fiók + Számla Agent kulcs → gép beírja + `INVOICE_PROVIDER=szamlazz` (scope-olt engedéllyel) |
| A2 | **Barion ÉLES bolt** | Sandbox validálva; prodban `BARION_URL=api.test.barion.com`, `PAYMENT_GATEWAY=mock` → éles kártya-fizetés NINCS | ⛔ IGEN — e nélkül nincs fizetős kapu | Tulaj: éles Barion-bolt igénylés (⚠️ jóváhagyási átfutása van — ezt érdemes AZONNAL elindítani) → éles POSKey/Payee → gép átállítja |
| A4 | **INWX éles API-kulcs** | HIÁNYZIK; `REGISTRAR_PROVIDER` mock. ⚠️ A konfigurátorban az egyedi domain az ELSŐ fizető vevőnek is felkínálódik — kulcs nélkül a fizetési webhook domain-vétele elhasal (fail-closed adapter), a vevő fizetett, a beszerzés áll | ⛔ IGEN — a pilot-hatókör a TELJES kör (tulaj-döntés 2026-07-30), a domain-ág a fizetős út része | Tulaj: INWX-fiók + API-hozzáférés (⚠️ feltöltött egyenleg is kell a vételhez) → gép beírja + `REGISTRAR_PROVIDER=inwx` |
| A5 | **Cloudflare API-token** (zóna-írás + TLS) | HIÁNYZIK; `DNS_PROVIDER` mock — a megvett domain zónája/TLS-e nem áll fel automatikusan | ⛔ IGEN — az A4 párja, nélküle a domain-kör félbe marad | Tulaj: token a citoviso.com CF-fiókból (Zone:Edit + a zóna-létrehozás joga) → gép beírja + `DNS_PROVIDER=cloudflare` |
| A6 | **GBP / láthatóság** (RÉTEG C, DECISIONS 1110. sor) | Kód-oldali modul nincs; tulaj Google-hozzáférését igényli (GBP/Maps + Search Console) | ⚠️ A tranzakciós kört nem blokkolja, az ÉRTÉK-ígéretet igen („láthatóvá tesszük") | Tulaj: Google-fiók hozzáférés az első élesített tenanthoz; utána külön szál a folyamatra |

## B) BLOKKOLÓ — GÉP (deploy-kör, tulaj scope-olt engedélyével)

| # | Tétel | Státusz | Blokkoló? | Következő lépés |
|---|---|---|---|---|
| B1 | **tudasbazis-or verdikt (GATE 1c)** | Dry-run MÉRVE: a deploy MOST ELBUKIK — a `a8304ee..main` KB-diffre nincs PASS-token (kb-check determinisztikus rétege ✓) | ⛔ IGEN — a deploy-cső mechanikusan zárva | Gép: tudasbazis-or agent a KB-diffre → `kb-gate.mjs pass` (24h TTL — a deploy NAPJÁN kell futtatni) |
| B2 | **Éles deploy: a 118-commitos köteg** | `deploy-prod.sh origin/main` dry-run lefutott; GATE 1b (jogi) ✓; 17 migráció pending (pg_dump automata) | ⛔ IGEN — minden lokálban kész funkció ezen ül | B1 után: tulaj kimondott engedélye → `deploy-prod.sh <sha> --go` |
| B3 | **`SESSION_SECRET` a prod .env-ből HIÁNYZIK** | ⚠️ A tenant-session cookie a repóban látható dev-defaulttal íródik alá → hamisítható | ⛔ IGEN — biztonsági rés fizető tenantnál | Gép: random secret a prod .env-be + restart (a B2 deploy-körrel együtt; a futó sessionök kiesnek — most még nincs élő tenant) |
| B3b | **`BOOKING_FROM` a prod .env-be** | Az alias-oldal ✅ KÉSZ (foglalas@citoviso.com, Zoho élesben mérve 2026-09-06, lokál .env-ben áll) — CSAK a prod .env-sor hiányzik; nélküle a vendég-levelek feladója az outreach-cím | ⛔ IGEN a booking-modulhoz | Gép: `BOOKING_FROM=foglalas@citoviso.com` a prod .env-be a B2 körrel + restart |
| B4 | **`citoviso-billing.timer` élesre** | Élesen 0 timer fut (mérve) — az előfizetés-motor/dunning (ADR-0080) SOHA nem futna | ⛔ IGEN — előfizetés-fordulónap és dunning nélkül a pilot-modell nem él | Gép: unit-fájl `WorkingDirectory` igazítás (`/opt/citoviso/app`) + telepítés — külön scope-olt engedély (systemd/README ⚠️) |
| B5 | **`citoviso-booking-maintenance.timer` élesre** | Dev-en fut (2026-09-06 óta); élesen nincs → portál-naptár-szinkron + kérés-lejáratás nem futna | ⛔ IGEN a booking-modulhoz | Ugyanaz a kör, mint B4 |
| B6 | **`citoviso-domain-resume.timer` élesre + domain-env** | Élesen nincs; a domain-vétel utáni NS/TLS-lépések `dns_pending`/`tls_pending`-ben parkolnának ÖRÖKRE. `DOMAIN_TARGET_IP` is hiányzik (=178.104.3.223, ismert érték) | ⛔ IGEN — az A4/A5 gép-oldali párja: kulcs VAN, de a beszerzés timer nélkül félúton áll | Gép: timer telepítés (B4-gyel egy körben) + `DOMAIN_TARGET_IP` + provider-kapcsolók a prod .env-be |
| B7 | **SMS-dunning élesre** (`SMS_RELAY_SECRET` + dev-oldali relay a prod felé) | Prodon nincs modem; a relay-szelet kódja a B2 köteggel kimegy, de a secret SEHOL nincs beállítva → a dunning SMS-csatornája (ADR-0080 ⑦, mérten működik gammu-úton) élesen néma | ⛔ IGEN a teljes körhöz — a dunning-eszkaláció mindkét csatornája a modell része | Gép: secret mindkét .env-be + a dev `sms-relay.timer` a prod URL-re állítva |

## C) NEM BLOKKOLÓ — pótolható az indulás után

| # | Tétel | Kié | Státusz | Következő lépés |
|---|---|---|---|---|
| C1 | **`OUTREACH_SENDER_PHONE` / `LEGAL_ENTITY_PHONE`** | tulaj | Hiányzik (nem kötelező mező, GATE 1b zöld nélküle) | Tulaj döntése: kerüljön-e telefonszám a levelekbe/impresszumba |
| C2 | **Maradvány-fájlok az éles fán** (`duplicates.ts`, `tmp-dup.mts`) | gép | 08-20-i scratch-fájlok; nem futnak, de a fa nem tiszta | A B2 deploy-kör végén törlés a szerverről (a deploy-script hangosan jelzi) |
| C3 | **KB-screenshotok frissessége** | gép | Dry-run WARN-t adhat (view-változás vs. entry-asset) — a mostani range-ben az assetek IS változtak ✓ | Deploy után szúrópróba: a súgó-képek a kint lévő felületet mutatják-e |

## D) RENDBEN — nem teendő, csak rögzítés

- **Jogi réteg (GATE 1b): ZÖLD** — impresszum-adatok (Olasz Ferenc e.v., adószám, cím, e-mail) 2026-08-26 óta a prod .env-ben; ÁSZF `/aszf`-en él, az 1.1 (ismétlődő terhelés, ADR-0088) a B2 köteggel megy ki.
- **E-mail-küldés éles** (`EMAIL_PROVIDER=smtp`, Zoho) + pilot-BCC a tulajnak ✓.
- **`OUTREACH_LIST_UNSUBSCRIBE=off`** — tudatos döntés (ADR-0069, Gmail-fül mérés), nem hiány.
- **`TERMS_URL`/`SZAMLAZZ_URL`/`CONSOLE_URL` üresen jó** — kód-default fedi.
- **Elek (ADR-0095) + FK-006/FK-007 tesztkörök zöldek** lokálban — a deploy után élesen újra-mérendők.

---

## Javasolt sorrend

1. **MOST (tulaj, párhuzamosan):** A2 Barion éles bolt igénylés (leghosszabb átfutás) · A1 Számlázz éles kulcs · **A4 INWX-fiók + kulcs (+ egyenleg)** · A5 Cloudflare-token. *(foglalas@ alias már ✅ kész — csak env-sor maradt belőle, B3b.)*
2. **Deploy-nap (gép, egy scope-olt körben):** B1 KB-verdikt → B2 deploy → B3 SESSION_SECRET + B3b BOOKING_FROM + az A-tételek env-értékei → B4+B5+B6 timerek + B7 SMS-relay → C2 takarítás → élesi verifikáció (390px-en is), benne egy VÉGIGVITT teszt-tranzakció a domain-ággal együtt.
3. **Utána:** A6 GBP-szál megnyitása az első tenanttal; C1/C3 menet közben.

> ⚠️ **A teljes kör mérőpróbája** (tulaj-hatókör 2026-07-30): egy vevő a konfigurátortól a
> fizetésen át a számláig + élő oldalig + egyedi domainig ÉLESBEN, emberi kéz nélkül ér célba.
> Amíg a fenti A/B lista bármelyike nyitott, ez a mondat nem igaz.

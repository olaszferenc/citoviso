## ADR-0071 — Automata egyedi-domain beszerzés + utólagos „kiköltöztetés" (a lead saját domainje, zéró emberi interakcióval)

**Dátum:** 2026-08-26 · **Státusz:** ELFOGADVA (tulajdonosi döntés: *„zéró emberi interakcióval
működjön a folyamat"* + a fizetés a trigger, nem külön jóváhagyás) — IMPLEMENTÁLÁS FOLYAMATBAN ·
**Kapcsolódó:** ADR-0020 (domain-stratégia: aldomain-alap + egyedi-domain upsell 24 hó), ADR-0024
(INWX registrar-API + Cloudflare for SaaS + wildcard/TLS), ADR-0041 (slug→domain 301 + canonical),
ADR-0032 (szabad aldomain), migr. 0008 (`order_intent.domain_type/domain_name/commitment_months`),
migr. 0017 (`site.custom_domain`).

### A mért állapot (2026-08-26) — mi van kész és hol a lyuk

- **Döntés régen megvan** (ADR-0020 + ADR-0024): registrar = **INWX** (.hu is valós időben),
  DNS/TLS = **Cloudflare for SaaS**. A flow papíron: konfigurátor-csekk → INWX-vétel → NS a
  Cloudflare-re → for SaaS TLS. **DE kimondottan „NEM pilot-blokkoló, addig A2 kézi"** — a valós
  vásárlás ma emberi ház-lépés, **kód nincs mögötte**.
- **A kiszolgálás-oldal KÉSZ**: `src/server/public.ts` a `site.custom_domain` hoszton szolgál ki, a
  slug-hoszt **301**-gyel átirányít (ADR-0041); `src/tenant/editor.ts` a canonicalt a custom
  domainre állítja. Vagyis amint a `site.custom_domain` élesedik, a „kiköltöztetés" magától megtörténik.
- **`src/domains.ts` KÉSZ az ELŐZETES részhez**: normalizálás (`normalizeCustomDomain`), előzetes
  elérhetőség (`checkAvailability`: DNS + RDAP), javaslatok. **Vásárlás nincs.**
- **KÉT valódi hézag** (a tulaj mindkettőt kimondta):
  1. **A vétel automatizmusa hiányzik** — az INWX+Cloudflare pipeline nincs megírva.
  2. **Meglévő tenant utólag nem tud domaint venni** — a domain-döntés ma CSAK rendeléskor, a
     publikus konfigurátorban rögzül (`order_intent`); a tenant-admin felületen nincs domain-vétel
     + automata kiköltöztetés út.

### Döntés

**① A fizetés a trigger, nincs emberi jóváhagyás.** A domain a `handleWebhook` (`src/payment/service.ts`)
`paid` ágából regisztrálódik — pontosan úgy, ahogy ma az upsell/multilang/activate ág. Nincs
külön operátor-gomb: a vevő választotta a domaint és kifizette, tehát a megvásárlása pontosan a
megrendelt szolgáltatás. A biztonságot nem ember adja, hanem az **atomi check-and-register az
INWX-oldalon**: ha időközben elkelt, a vétel elhasal és visszajelzünk — sosem veszünk rossz domaint.
*(Az egyetlen dolog, ami embert igényelhet: pilot alatt az INWX-fiók feltöltöttsége/hitelkerete — ez
üzemeltetési előfeltétel, nem a folyamat lépése.)*

**② Új adapter-réteg, env-kapcsolóval (a payment/email mintája).**
- `src/domains/registrar/` — `RegistrarAdapter` interfész + `inwx.ts` (JSON-RPC) + `mock.ts`.
  Kapcsoló: `REGISTRAR_PROVIDER=mock|inwx` (**lokál alap = mock**, hogy fejlesztés SOHA ne vegyen
  valódi domaint — pontosan mint `INVOICE_PROVIDER=mock`).
- `src/domains/dns/` — `DnsAdapter` interfész + `cloudflare.ts` (zóna + NS + for-SaaS custom
  hostname + TLS-státusz) + `mock.ts`. Kapcsoló: `DNS_PROVIDER=mock|cloudflare`.

**③ Állapotgép, idempotens és újrafuttatható** (`src/domains/provisionDomain.ts`). Mert a
zéró-touch csak akkor tartható, ha a több-perces TLS-propagáció alatt egy crash sem hagy fél
állapotot: `pending → registering → registered → dns_pending → tls_pending → live` (+ `failed`,
minden lépésnél újraindítható onnan, ahol elakadt). A `site.custom_domain` CSAK a `tls_pending→live`
átmenetnél íródik be (előbb nem, különben a public.ts egy még nem élő hosztra 301-ezne).

**④ Meglévő tenant utólagos vétele = új `order_intent`, `tenant_id`-vel horgonyozva.** Az
`order_intent` már ma is hordozza a `domain_type/domain_name/commitment_months/kind` mezőket, és a
`handleWebhook` `kind` szerint ágazik → új `kind='domain_upgrade'`. A meglévő tenantnak nincs friss
lead-lánca, ezért az `order_intent` kap egy **nullable `tenant_id`** horgonyt (utólagos vételnél ez
mutatja meg, melyik élő site-ot kell átköltöztetni; rendeléskori vételnél NULL, ott a prospect-lánc
visz). A fizetés a meglévő `payment/gateway`-en megy (Barion/mock), ugyanaz a webhook.

**⑤ 24 hó marad** (ADR-0020, tulaj megerősítette 2026-08-26) az utólagos vételre is. ⚠️
Megkülönböztetendő: a **24 hó az ELŐFIZETÉSI elköteleződés**; a domain **regisztrációs periódusa**
külön (INWX-en jellemzően 1–2 év, auto-renew a mi tulajdonunkban) — a kettőt a pipeline külön kezeli.
A domain-tulajdonjog átszállási szabálya (ADR-0020 §4 / a rendelési feltételek §4: lejárat + 90 nap +
maradéktalan fizetés) változatlan.

### Adatmodell (új migráció — ⚠️ szám ELŐTT `git fetch` + minden worktree, ADR-számok/migráció-ütközés)

- `order_intent` += `tenant_id uuid NULL REFERENCES tenant(id)` (utólagos vétel horgonya); a `kind`
  CHECK bővül `'domain_upgrade'`-dzsel.
- `site` += `custom_domain_status text` (`none|pending|registering|registered|dns_pending|tls_pending|live|failed`,
  default `none`) + `domain_registered_at timestamptz` + `registrar_ref text` (INWX-referencia az
  auto-renew/átszálláshoz) + `domain_provision_error text` (utolsó hiba, diagnosztikához).

### Elhatárolás / kockázat

- **Snapshot-propagáció** (memória `reference_snapshot_rerender_propagation`): a canonical/og:url a
  statikus snapshotba van sütve → domain-váltáskor a `rerenderTenantSnapshot`-ot le KELL futtatni,
  különben a régi (slug-)canonical marad a HTML-ben. Ez a pipeline `live` lépésének része.
- **IDN**: az `normalizeCustomDomain` ma elutasítja az ékezetes domaint (a registrar punycode-ot
  vár) — post-pilot bővítés, nem itt.
- **Visszafordíthatóság:** 🔄 additív oszlopok + adapter-réteg; 🚪 EGYIRÁNYÚ maga a domain-vétel
  (valódi pénz, nem visszáru) — ezért alap a mock, és élesben az INWX atomi kapuja véd.

### Felület (B blokk) — a §2b terv-jóváhagyási kapu KÖTELEZŐ

A tenant-admin domain-szekciója (javaslat/beírás → élő csekk → ár + 24 hó → fizetés → állapotjelző
→ „kész, átirányítva") felület-munka → statikus HTML-változatok + ui-shot + DesignSync feltöltés +
**STOP jóváhagyásig**, mielőtt bármi működő logika születik. KB-entry (ADR-0045) az IT-kezdő tulajnak.

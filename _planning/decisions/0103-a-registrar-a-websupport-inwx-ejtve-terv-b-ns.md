## ADR-0103 — A registrar a Websupport (INWX ejtve); „terv-B" NS/DNS/TLS: Websupport-zóna + Let's Encrypt a VPS-en (2026-09-06)

**Döntés (tulaj: „mehet", 2026-09-06):**

① **Registrar = Websupport** (`https://rest.websupport.hu`), az **INWX ejtve**. Ok: a `.hu`
regisztráció 2 599 Ft/év a ~10 500 Ft/év helyett, magyar registrar, valós idejű `.hu`. Az
`InwxRegistrar` csonk marad a fában (nem futó holt ág), az alapértelmezés továbbra is a mock.

② **A fiók a KÜLÖN Citoviso-fiók** (`olaszferenc`, userId **3213041**) — a tulaj Mineral-fiókján
(minerallog/100995) SOHA nem futhat Citoviso-vétel. Ez nem kényelmi kérdés: a 2026-09-06-i első
vétel ott futott le, és a számla a Mineral Kft.-re, az értesítők az `info@minerallog.hu`-ra mentek.

③ **Terv-B NS/DNS/TLS-architektúra.** A registrar API-n **nincs nameserver-váltás** (mérve),
ezért a korábbi „Cloudflare-zóna + NS-delegálás oda + Universal SSL" út nem járható. Helyette:
a megvett domain a **registrar saját NS-ein marad**, a zónát a **registrar zone-API-ja** kezeli
(apex + `www` A-rekord a `DOMAIN_TARGET_IP`-re), a publikus **TLS-t a VPS nginxe adja Let's
Encrypttel**. ⇒ **A Cloudflare API-token (leltár A5) KIESIK a pilot-blokkolók közül.** A
Cloudflare megmarad a `citoviso.com`-ra (és a mai origin-certre), a tenant-domainekhez nem kell.

④ **Ár-plafon és pénznem.** A registrar **HUF-ban** áraz, az ADR-0093 vételi plafon **EUR-ban**
él (`domain_max_price_eur`, konzol-mező). A plafon-réteget NEM írjuk át többpénznemesre; helyette
az adapter vált HUF→EUR egy **szándékosan konzervatív, ALACSONY** `DOMAIN_HUF_PER_EUR` rátával —
alacsony ráta = magasabb EUR-érték = a plafon HAMARABB fog, nem később. A ráta **őr-bemenet, nem
könyvelési adat**; hiánya **fail-closed** (nincs ár → nincs vétel, §B.17 adathiányos ág).

⑤ **Vétel-kapu — a 09-06-i hiba kőbe vésése.** Domain-profil API-n **nem adható át** (a
`domainProfileId`-t a validate/order elutasítja, a `/v1/user/{id}/domain-profile` route nem
létezik) ⇒ **a registrant a fiók alapértelmezett kontaktja**. Ezért az adapter minden vétel
ELŐTT lekéri a fiókot és **ellenőrzi**, hogy az alapértelmezett számlázási profil neve egyezik a
`WEBSUPPORT_EXPECTED_REGISTRANT` értékével; eltérés vagy hiány → **nem vesz**, hangosan bukik.
A jóváhagyás a paraméterekkel együtt él: ha a kimondott registrant nem igazolható, az már másik
művelet (`feedback_approved_params_are_the_approval`).

**Mért API-tények (az adapter ezekre épül, nem feltételezésre):**
- Auth: HMAC-SHA1 a `"{METHOD} {path} {unix_ts}"` sztringen → hex, `Authorization: Basic
  base64(apiKey:hexsig)` + `Date: yyyymmddThhmmssZ`. ⚠️ **Az aláírt útvonal QUERY NÉLKÜL** —
  `?perPage=100`-zal aláírva 401 „Incorrect api key or signature", nélküle 200 (mérve 2026-09-06).
- `POST /v1/order/hu/validate/domain` = elérhetőség + ár egyben (HUF, első éves ár); foglalt →
  `errors.domain: ["Domain is taken."]`.
- `POST /v1/user/:id/order` (`?dryRun=1` teszt-mód) → 201 + orderId; `PUT …/pay/byCredit`
  először 404 „Relation not found", **~5 mp múlva 200** → retry-hurok kötelező; a kredit
  **NETTÓ** árat terhel; a vásárolt szolgáltatás **`autoExtend=false`** alapból.
- Számlálók 2026-09-06 22:5x-kor az `olaszferenc`-fiókon: `service` **0**, `zone` **0** →
  a **#211604 szolgáltatás-átadás MÉG NEM ÉRT ÁT**; `credit: 0`; `awaitingTosConfirmation: "1"`.
- `citoviso.hu` a `.hu` registry-zónában **még nincs delegálva** (`dig NS citoviso.hu @a.hu` →
  csak `hu.` SOA) — ISZT-átfutás + 8 napos feltételes időszak.

**Következmények (mind új, mind nyitott tétel):**
- **Új tulaj-blokkoló:** a Citoviso-fiók **kredit-egyenlege 0** és a **ToS nincs megerősítve** —
  a `pay/byCredit` vétel e kettő nélkül elhasal. A leltár A4 tétele erre íródik át.
- **Let's Encrypt a VPS-en NINCS** (mérve: nginx `/etc/nginx/ssl/citoviso.crt` = Cloudflare
  origin-cert `citoviso.com` + `*.citoviso.com`-ra, `certbot` nincs telepítve) ⇒ tenant-domain
  ma NEM tud publikus TLS-t kapni. Külön, engedélyhez kötött infra-lépés a deploy-nappal.
- **A DNS/zone-adapter mérése az átadásig lehetetlen** (0 zóna a fiókban) ⇒ a zone-adapter
  szándékos, **fail-closed csonk** marad (az `inwx.ts` házi stílusa), nem hazudik működést.
- `isMockDomainProvisioning()` ma `!== "inwx"`-et néz — az új provider mellett ez tévesen
  mock-nak minősítené az éles beszerzést (a 301 nem élne). Javítandó a váltással együtt.

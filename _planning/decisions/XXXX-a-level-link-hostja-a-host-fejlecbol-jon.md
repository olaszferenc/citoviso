## ADR-XXXX — A levél-link hostja a Host fejlécből jön, nem a hamisítható X-Forwarded-Host-ból (2026-09-29)

- **Kiváltó (deploy-készenlét felderítés, SUB-brief `~/rc-briefs/dk-forwarded-host.md`):** a
  `publicBaseUrl(req)` (`src/server/public.ts`) ELSŐKÉNT az `X-Forwarded-Host` fejlécet vette, és csak utána
  a `Host`-ot. Az éles nginx (`/etc/nginx/sites-enabled/citoviso` és `citoviso-admin`, olvasva 2026-09-29)
  CSAK `Host $host` / X-Real-IP / X-Forwarded-For / X-Forwarded-Proto fejlécet állít — az X-Forwarded-Host-ot
  nem írja felül, tehát a kliens értéke változatlanul ér a Node-ig. A site-feloldás viszont a `Host`-ból megy.
  Következmény: egy hamis `X-Forwarded-Host: gonosz.hu` fejlécű foglalási kérés után a TULAJ levelében az
  „Elfogadom / Ajánlat” linkek (bennük az action_token) idegen domainre mutattak — aki rákattint, a tokent
  a támadónak adja. A mai élesben is benne van. Élesben NEM próbáltuk ki; lokálisan mérve (lent).

**Döntés**

1. **A `publicBaseUrl(req)` hostja a `Host` fejléc** — ugyanaz, amiből a site feloldódik. Az X-Forwarded-Host-ot
   semmilyen formában nem olvassuk. Az `X-Forwarded-Proto` marad (az nginx felülírja, a sémát adja).
2. **Nincs allowlist**, mert nincs legitim feladó: az éles nginx a `Host $host`-tal az eredeti hostot adja át,
   Cloudflare nem állít X-Forwarded-Host-ot (és a Host-ot megtartja), a dev gépet (Tailscale-IP) pedig proxy
   nélkül, közvetlenül érjük el — ott a `Host` az igazság (lásd a `feedback_dev_path_hides_host_bound_bugs`
   jegyzetet: a tenant hostot nyers Host-fejléccel mérjük). Ha egyszer lesz olyan proxy, ami a Host-ot átírja,
   akkor az ALLOWLIST-elt hoston fogadható el — vakon soha.
3. **Őr:** a `scripts/guest-link-host-check.mts` ⑤ ága: hamis X-Forwarded-Host mellett a vélemény-űrlap
   hozzájárulás nélküli POST-jának válaszlapja (a „vissza” link = `publicBaseUrl(req)`, DB-írás nincs) a
   `Host`-ra mutat, és a hamis host sehol nincs a válaszban; + pozitív kontroll fejléc nélkül.
   **A régi kódon PIROS** („a válaszban ott a hamis host”), a javítás után zöld.
4. **A többi link-építő tiszta** (grep `x-forwarded-host` / `req.headers.host` / `baseUrl` a `src/`-ben): a
   konzol (`src/console/server.ts`) és az outreach a `config.publicBaseUrl`-ből, a naptár-feed
   (`getExportFeedUrl`) a DB-beli slug/custom_domain-ből (`tenantSiteUrl`) épít; a többi `req.headers.host`
   olvasás site-feloldás, nem link. Az X-Forwarded-Host-ot a javítás után a `src/` sehol nem olvassa.

- **Visszafordíthatóság:** 🔄 (egy sor).
- **Elvetett alternatíva:** az nginx-ben `proxy_set_header X-Forwarded-Host $host;` — élesi konfig-írás, és a
  kód továbbra is bízna egy fejlécben, amit egy másik belépési út (közvetlen port, új proxy) nem ír felül.
- **Nyitott (nem e döntés része):** a `throttled()` az X-Forwarded-For ELSŐ elemét kulcsolja; az nginx
  `$proxy_add_x_forwarded_for`-ja a kliens értékéhez FŰZ, tehát a kliens a fojtást kijátszhatja.
- **Státusz:** elfogadva, a nagy deployjal megy ki.

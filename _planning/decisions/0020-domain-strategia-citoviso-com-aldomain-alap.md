## ADR-0020 — Domain-stratégia: citoviso.com aldomain = alap; egyedi domain = upsell, min. 2 éves elköteleződéssel

- **Kiváltó (2026-07-27, tulaj-döntés):** a SEO canonical/provisioning terv átnézésekor a tulaj a domain-kérdést
  hozta előre: a canonical-implementáció a pilot UTÁNRA parkol, de a **saját (egyedi) domain esetét a rendelési
  folyamatnak már most kezelnie kell** — ez lesz a kereskedelmi ajánlat kialakításának erőltetett iránya.
- **Döntés (a BACKLOG 2026-07-20-as parkolt tételének élesítése):**
  1. **Alapértelmezés (olcsóbb út):** a tenant oldala a platform-domain aldomainjén él — `<slug>.citoviso.com`.
     Nulla súrlódás (DNS/TLS nálunk), a célszegmens (nincs domainje) természetes útja.
  2. **Egyedi domain rajtunk keresztül = upsell + retenció-horog:** ha a tenant egyedi domaint akar velünk
     regisztráltatni, **minimum 2 éves (24 hónap) előfizetést vállal**. A domain nálunk = kötődés.
  3. **Rendeléskor proaktív kínálat:** a konfigurátor 3–5 **szabad, jól hangzó** domain-javaslatot ad az
     üzletnévből (HU-first: `.hu` elsődleges, `.com`/`.eu` fallback), **valós idejű előzetes
     elérhetőség-ellenőrzéssel** (olcsó réteg: DNS + RDAP; a hiteles csekk + regisztráció a registrar-API
     rétegé — pilot alatt a regisztráció kézi ház-lépés, A2).
  4. **Meglévő saját domain** (pl. `panziosissi.hu` már a tulajé): támogatott harmadik eset (`own`) —
     DNS-rákötés kézi/asszisztált (A2), automatizálás később.
- **Adatmodell:** `order_intent` += `domain_type` (`citoviso_sub`|`citoviso_registered`|`own`) + `domain_name`
  + `commitment_months` (migráció 0008). A `site` `domain`/verifikáció mezői az élesítés-szelettel jönnek
  (BACKLOG szerint), a canonical/og:url injektálással együtt (pilot után, §H).
- **Elhatárolás:** a SEO canonical + og:url implementáció (renderer-opció + `site.public_url`) POST-PILOT;
  a mock/preview továbbra sem állít canonicalt (hamis URL-t sosem állítunk).
- **Nyitott:** a `citoviso.com` domain tényleges birtoklása/regisztrációja (tulaj); registrar-választás
  (ISZT-akkreditáció .hu-hoz — BACKLOG kutatási tétel); domain éves díja (placeholder-ár a katalógusban).
- **Visszafordíthatóság:** 🔄 — additív oszlopok + UI-szekció; a registrar-integráció későbbi 🚪-döntés.
- **Státusz:** ELFOGADVA (tulaj, 2026-07-27). Impl: konfigurátor domain-lépés + order_intent rögzítés + előzetes csekk.

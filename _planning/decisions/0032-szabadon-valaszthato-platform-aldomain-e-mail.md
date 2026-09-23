## ADR-0032 — Szabadon választható platform-aldomain + e-mail-modul + Citoviso-kredit a láblécben

- **Tulaj-kérés (2026-08-09):** (1) ha a tenant nem kér egyedi domaint, ajánljunk aldomaint a
  citoviso.com-on belül, de SZABADON megválaszthassa; (2) egyedi domainnél 2-3 SZABAD javaslat
  (ez már kész, ADR-0020); (3) legyen e-mail-modul (egyedi e-mail cím); (4) a citoviso.com jelenjen
  meg kattinthatóan a generált oldalon.
- **(1) Szabad aldomain:** a konfigurátorban a platform-aldomain LABEL-je szerkeszthető input, élő
  elérhetőség-ellenőrzéssel (`GET /configure/:id/subdomain?label=` → `checkSubdomainAvailable`:
  normalizál, ≥3 kar., fenntartott-lista, DB-ütközés). A választott host az `order_intent.domain_name`-be
  kerül (domain_type=citoviso_sub); a provisioning honorálja: `uniqueSiteSlug(name, preferred)` +
  `convertLead(..., preferredSlug)` + `activate()` átadja a rendelésből. Foglalt/rövid/fenntartott
  név → a submit tiltva (nincs bait-and-switch: amit választ, azt kapja, ha szabad).
- **(3) E-mail-modul:** `MODULE_CATALOG` új `email` tétel (Egyedi e-mail cím, extra/upsell, 390 Ft/hó).
  A tényleges postafiók-/forwarding-provision későbbi szelet (mint az SMS-transport) — ez az eladható
  entitlement.
- **(4) Citoviso-kredit:** `injectRuntime` egy finom, kattintható „Ezt az oldalt a Citoviso készítette —
  citoviso.com" csíkot fűz a lábléc alá, a mockon ÉS az élő tenant-oldalon (egy hely, minden sablon).
  Skin-független semleges színek. (Régi, már legenerált mockokon csak újragenerálás után jelenik meg.)
- **Visszafordíthatóság:** 🔄 könnyű — additív (új endpoint + opcionális recept/DB-mezők + modul-tétel +
  lábléc-csík); a régi út változatlan.
- **Státusz:** ELFOGADVA / implementálva (2026-08-09).

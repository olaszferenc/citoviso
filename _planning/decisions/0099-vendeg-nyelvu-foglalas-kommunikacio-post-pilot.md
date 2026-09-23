## ADR-0099 — Vendég-nyelvű foglalás-kommunikáció (POST-PILOT backlog; tulaj, 2026-09-06)

**Kontextus.** Az FK-007 ár-kör kiértékelője jelezte: a német nyelvű vendég (német üzenet,
+49-es szám) magyarul kapja a foglalás-leveleket. A mai szabály (ADR-0067) szerint ez
helyes — a vendég a SITE nyelvén kap levelet —, de többnyelvű vendégkörnél gyenge élmény.

**A tulaj döntése (szó szerint):** „Olyat lehet csinálni, hogy felismerjük a böngésző
foglaló országát? És ha van adott országra nyelvi csomag vásárolva, akkor azon a nyelven
megy ki a kommunikáció? Írjuk fel magunknak most, egyelőre nem a pilot része."

**A felírt terv (implementáció NEM indul):**
1. A foglalási űrlap beadásakor a böngésző nyelv-jelzését (`Accept-Language` /
   `navigator.language`) a kérésre PECSÉTELJÜK (pl. `guest_lang`).
2. Kimenő vendég-levélnél: ha a tenant site-jának VAN MEGVÁSÁROLT nyelvi csomagja
   (ADR-0063 multilang, `site_multilang`) a vendég nyelvére → a levél AZON a nyelven
   megy; különben marad a site-nyelv (a mai viselkedés a fallback).
3. Ez a multilang modul ÉRTÉKÉT is növeli (upsell-érv: „a vendégeid a saját nyelvükön
   kapják a visszaigazolást").

**Státusz:** backlog — nem a pilot része. Újranyitás: a multilang-upsell körrel együtt.

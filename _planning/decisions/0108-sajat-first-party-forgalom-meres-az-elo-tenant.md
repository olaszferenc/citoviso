## ADR-0108 — Saját (first-party) forgalom-mérés az élő tenant-oldalon, az ALAPCSOMAG részeként (2026-09-07)

**Kontextus.** A GBP-szál felmérése közben a tulaj feltette a döntő kérdést: *„Legyen szó
akár saját domainról, akár slug domainról, hogy lássunk forgalmi adatokat és látogatottságot
— mivel mi vagyunk a házigazdák, nem tudjuk ezt megcsinálni?"* De: **tudjuk.** Minden kérés a
saját `serveTenantHost`-unkon megy át, és a slug-hoszt meg a saját domain UGYANAZON a kódúton
érkezik. A mock-oldalon ezt már 2026 óta csináljuk (`mock_view`/`mock_event`, ez hajtja az
eszkalációs ajánlatot a 3. megnyitásnál) — az ÉLŐ tenant-oldalnak nem volt párja.

**Döntés (tulaj, 2026-09-07):**

① **A forgalmi/látogatottsági adat az ALAPCSOMAG része**, nem felárazott modul. Indok: ez a
bizonyíték arra, amit amúgy is ígérünk — a saját értékünk igazolását pénzért adni önsorsrontó,
ráadásul ez a legerősebb lemorzsolódás-ellenes eszköz a megújításnál.

② **First-party, süti nélkül, kliens-oldali script nélkül.** Nem Google Analytics: (a) nincs
külső függés és jóváhagyás, (b) a reklámblokkolók a szerver-oldali mérésből semmit nem tudnak
kivenni, (c) jogilag lényegesen egyszerűbb helyzet (a GA hozzájárulás-köteles).
⚠️ Az adatkezelési tájékoztatóba be kell kerülnie — ezt nem ugorjuk át.

③ **A mérés SOSEM ronthatja el az oldalt.** A rögzítés a válasz KIKÜLDÉSE UTÁN indul, nem
`await`-elt, és minden hibája elnyelt (naplózva) — mérési probléma nem válhat
rendelkezésre-állási problémává.

④ **A BOT-SZŰRÉS a mérés része, nem utólagos szépítés.** Egy crawler-találat nem vendég; ha
a Googlebot benne van a „ennyien nézték meg" számban, akkor hamis állítást mutatunk a fizető
vevőnek (§B.17). A sor `is_bot` jelöléssel MEGMARAD (hogy a szűrő maga mérhető és javítható
legyen), de minden kimutatás rá szűr.

⑤ **Adatvédelem a tábla ALAKJÁBA kötve, nem csak szándékban:** nyers IP-t nem tárolunk;
a `visitor_hash` naponta forgó sóval + `SESSION_SECRET`-tel képzett lenyomat (napon belül
összeköt, napok között nem — számláló, nem profil); a `referrer` CSAK a küldő hosztneve
(„google.com"), mert a teljes URL keresőkifejezést is hordozhat.

**Megvalósítva ebben a körben (adat-réteg):** `migrations/0054_site_visit.sql`,
`src/analytics/siteVisit.ts`, bekötés a `serveTenantHost` sikeres oldal-kiszolgálásába,
`TenantHostSite.siteId`. Mérve: 5/5 rögzítés, 3/3 crawler megjelölve, 2/2 valódi átengedve,
a keresőkifejezés bizonyítottan NEM tárolódik, két böngésző = két látogató.

**Amit ez a kör NEM tartalmaz:** a tenant-admin kimutatás-felülete és a havi „ennyi vendég
talált meg" levél — felület-munka, ezért §2b terv-jóváhagyási kapu alatt megy külön körben.
A mért adat addig is gyűlik, tehát a felület már valós számokkal indul.

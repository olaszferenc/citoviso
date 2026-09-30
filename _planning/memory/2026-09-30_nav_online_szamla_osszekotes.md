# 2026-09-30 — A CITO Számlázz.hu fiók összekötve a NAV Online Számlával (az éles számlázás eddig 378-cal bukott)

## Mi történt

Az éles 97 Ft-os próbavásárlás (vevő: Olasz-Balogh Viktória, 2026-09-30 07:32 UTC, fizetés
`acadc176-1a82-4877-93d8-ac1358de22fd`) számlája **elbukott**: `Számlázz error 378: A bizonylat
kibocsátáshoz össze kell kötnöd fiókodat a NAV Online Számla rendszerével.` A jelzés NEM a
konzolunkból jött, hanem a Számlázz.hu `agentfail@kboss.hu` leveléből („sikertelen Számla Agent
hívás") — a `failed` invoice-sor némán ült a DB-ben.

⛔ **Ok:** az éles CITO fiók (92227011-1-33) sosem volt NAV-hoz kötve. Az ADR-0206 a kulcsokat
szétválasztotta, de az éles fiók NAV-összekötése kimaradt — a tesztüzemű OV fiókban ez szándékos
(ott tilos is: az összekötés végleg megszünteti a tesztüzemet), a CITO-ban hiányzott.

## Az összekötés (tulaj végezte, lépésenként vezetve)

1. `onlineszamla.nav.gov.hu` → **Elsődleges felhasználó → KAÜ** → adózó-választó: a **`92227011`**
   sor (a listában ott a megszűnt `69646014` is — azt NEM).
2. Kezdőlap „Hiányzó technikai felhasználó" → **Új technikai felhasználó** → jogosultság CSAK
   `Számlák kezelése` + `Számlák lekérdezése` (e-ÁFA/OPG/DACentral/NYUGTA üresen) → Mentés →
   felhasználónév + XML aláíró- és cserekulcs.
3. Számlázz.hu, **`Olasz Ferenc (CITO)`** fiók (a tulaj képernyőjén igazolva) → Beállítások →
   NAV online adatkapcsolat → a 4 adat → **„Gratulálunk a sikeres NAV-összekötéshez!"**,
   állapot: **Aktív kapcsolat (számlázás)** ✅.
- A piros „Hiányzó jogosultság (nyugtázás)" címke **nem teendő**: a kódunk nyugtát nem állít ki
  (`src/invoicing/szamlazz.ts` — nincs nyugta-hívás). Csak akkor kell, ha kézi nyugta lesz.

⚠️ A technikai felhasználó jelszava és kulcsai a session képernyőképein látszottak (a tulaj a
gyenge jelszót tudatosan megtartotta). Zárás: NAV → Felhasználók → jelszócsere + kulcsgenerálás,
majd a Számlázz.hu-ban „Módosítom".

## ⛔ Az újra-kiállítás semmit nem talált — egy másik szál purge-a közben törölte

Tulajdonosi engedéllyel lefutott élesen `issueInvoiceFor('acadc176-…')` (a prod ugyanazon a
commiton, `a1b134e6`). Eredmény: **nem írt semmit** — a fizetés már nem létezett. Ma 08:06 UTC-kor
egy másik szál kipurge-olta a „Muschel" tesztleadet a fizetéssel és a `failed` számla-sorral
együtt; mentés: `/opt/citoviso/backups/testlead-muschel-20260930-080641.json` (lead, tenant,
payment, invoice, subscription, prospect).

🔴 **A kár-lehetőség:** a purge egy **befolyt, számlázatlan** fizetést tüntethetett el, figyelmeztetés
nélkül. Ha a 97 Ft valóban befolyt (a pilot előtti próbavásárlás, lásd MEMORY.md fejléc), a
számla-kötelezettség a DB-törléstől függetlenül él → **kézi számla a Számlázz.hu-n** (CITO,
Olasz-Balogh Viktória, 97 Ft, AAM, teljesítés = fizetés napja).

## Nyitott

1. **97 Ft befolyt-e?** Ha igen: kézi számla (tulaj).
2. **Őr a purge-ra:** tesztlead-purge ne töröljön `paid` fizetést, amelyhez nincs `issued` számla
   (vagy legalább hangosan jelezze).
3. **Konzol-jelzés `failed` számlára** — ma csak a Számlázz.hu levele szólt.
4. `LEGAL_ENTITY_ADDRESS` „Kunó" vs. NAV/Számlázz.hu „Kuno" (a 09-21-i nyitott tétel) — nem
   ellenőrizve.

## Módosított fájlok

- `_planning/memory/2026-09-30_nav_online_szamla_osszekotes.md`, `MEMORY.md`,
  `_planning/memory/INDEX.md` (generált)

Kód nem változott. Élesben nem változott semmi (az újra-kiállítás no-op volt).

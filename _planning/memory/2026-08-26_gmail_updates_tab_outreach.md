# 2026-08-26 — Miért a „Frissítések" fülre ment a hideg levél (MÉRVE), és mi lett belőle

## A panasz
A tulaj teszteli és magának küldi ki a megkereséseket. Gmailben **kizárólag a Frissítések fülre**
érkeztek. Az ő szava: *„a fasz se nézi a frissítések mappáját"* — a levél tehát kézbesítve volt,
de a mock-link el sem jutott a leadhez. Feszültség: a **kép** hozza a wow-ot és emiatt a
kattintást, viszont épp a képet gyanúsítottuk a rossz besorolással.

## Ahogy kiderült (nem tipp — mérés)
1. **A meglévő postafiók vallott** (Gmail `category:` operátor a saját fiókon):
   - `from:citoviso.com category:updates` → **3 találat, MIND outreach**
   - `from:citoviso.com category:primary` → **8 találat, MINDEN más** (számla, belépési adatok,
     nyelv-értesítő, teszt)
   Azonos feladó, azonos Zoho SMTP, azonos SPF/DKIM → **sem a hitelesítés, sem a domain-reputáció
   nem magyaráz semmit.** Egyetlen szerkezeti különbség volt: a `List-Unsubscribe` fejlécet CSAK az
   outreach állítja (`src/email/outreachEmail.ts`), a többi levéltípus egyiket sem.
2. **Aranyat érő kontroll:** egy TOVÁBBÍTOTT outreach-levél (497 KB, ugyanaz a kép, de az eredeti
   fejlécek nélkül) **Primary**-be esett → a kép gyanúja megingott, a fejlécé megerősödött.
3. **Hat kontrollált levél** (`scripts/inbox-ab.mts`, feladó/SMTP/törzs azonos):

   | | kép | `List-Unsubscribe` | fül |
   |---|---|---|---|
   | A | van | https + one-click | Frissítések |
   | B | van | **nincs** | **Elsődleges** |
   | C | nincs | https + one-click | Frissítések |
   | D | nincs | **nincs** | **Elsődleges** |
   | E | van | https, one-click nélkül | Frissítések |
   | F | van | `mailto:` | Frissítések |

   **Bármilyen fejléc → Frissítések (4/4). Fejléc nélkül → Elsődleges (2/2).** A 318 KB képet vivő
   B is Elsődleges lett: **a kép ártatlan, a wow megtartható.** Középút nincs.

## Amit szállítottam
- **`OUTREACH_LIST_UNSUBSCRIBE` kapcsoló** (ADR-0069), alapérték `on` = MAI viselkedés. A tulaj
  jóváhagyása után egy `.env` sor + restart. A `sendBatch` kapuja a fejlécről átkerült a **testbeli**
  leiratkozó linkre — az a jogi követelmény (Grt./GDPR), és az minden variánsban ott van.
- **Olvasható link `/p/<slug>/<token>`.** Eddig a levél egyetlen CTA-ja egy csupasz véletlen token
  volt ismeretlen feladótól — adathalász-forma. Most a tulaj a SAJÁT nevét látja a webcímben. A slug
  kozmetikai; a token őriz. A már kiküldött `/p/<token>` linkek élnek (normalizálás).
- **Lyukas őr befoltozva:** az „elérhetetlen link" ellenőrzés néven nevezte a Tailscale-t, de csak
  NUMERIKUS IP-t nézett → a `https://mineral.tail3a89f.ts.net:8443` alap ZÖLDEN átment. A kiment
  teszt-levelek olyan linket vittek, amit rajtunk kívül senki nem tud megnyitni — a leiratkozót sem.

## Módosított / létrehozott fájlok
- `src/config.ts` — `outreachListUnsubscribe` kapcsoló
- `src/email/outreachEmail.ts` — a fejléc kapcsolóra kötve (a hibás „mild bulk signal" komment javítva)
- `src/outreach/sendBatch.ts` — a kapu az opt-outot méri, nem a fejlécet
- `src/outreach/draft.ts` — `/p/<slug>/<token>` link
- `src/outreach/outreachCheck.ts` — privát hosztNÉV is elérhetetlen
- `src/console/prospectPath.ts` (ÚJ) + `src/console/server.ts` — útvonal-normalizálás
- `scripts/check-prospect-path.mts` (ÚJ) — 13 eset, pirosra tesztelve, pre-commitban
- `scripts/inbox-ab.mts` (ÚJ) — a fül-mérő lab (valódi prospect-rekordot nem érint)
- `hooks/pre-commit`, `_planning/DECISIONS.md` (ADR-0069)

## Nyitott kérdések
1. **A tulaj döntése kell:** `OUTREACH_LIST_UNSUBSCRIBE=off` élesítése. A kód kész, a mérés megvan.
2. A mérés EGY postafiókból van, és a Gmail feladónként tanul — más címzettnél a verdikt eltérhet.
   Újramérhető: `PUBLIC_BASE_URL=https://citoviso.com npx tsx scripts/inbox-ab.mts <cím>`.
3. **A tárgy és az első sor** (a Gmail-listában ez a három látszik: feladó, tárgy, első sor) még
   soha nem volt hangolva — ez a következő kar a megnyitásra. A szöveg a tulaj asztala (`draft.ts`).
4. A `/p/<slug>/<token>` route-ot a landolás utáni fő fán (:4600) érdemes végigkattintani —
   a regexet 13 eset fedi, de élő kérésen még nem futott.

---

## Folytatás ugyanebben a szálban — tárgy/első-sor hangolás + élesítés

**Élesítve:** `25ed6b8` (jogi adatok + ADR-0069 kapcsoló), majd `04438de` (szöveg-hangolás).
Az éles `.env` megkapta a valós `LEGAL_ENTITY_*` adatokat (ezzel a 2026-08-23 óta álló
deploy-blokkoló megszűnt) és a `OUTREACH_LIST_UNSUBSCRIBE=off` sort.

**A megnyitás második kara (a fül után): a tárgy és az első sor.** Mérve a 389 címmel bíró
leaden: a régi tárgy (`{Név} – készítettem Önöknek egy honlap-tervet`) a mobil Gmail ~38
karakterébe **0/389** arányban fért be — az ajánlat MINDIG a levágás mögé esett, hosszú nevűeknél
a lead csak a saját nevét látta. Az első sor közben a „Tisztelt Vendéglátó!" töltelék volt,
~21 karaktert égetve a látható ~90-ből.

Tulaj döntése (4 változatból, mind §C PASS): **B** — rövid tárgy + bizonyíték elöl.
- tárgy: `{Név} – honlap-terv` → **336/389 (86%)** befér, névvel együtt
- első sor: a saját Google-értékelése + a szegmens-specifikus megfigyelés

⛔ **Amit NEM engedtem:** a B előnézetében a „saját honlapot nem találtunk" általánosított volt,
pedig az `elavult` szegmensnek VAN honlapja (csak régi) — az fabrikált tényállítás lett volna a
vállalkozásáról (§B.17). Szegmensenként külön mondat megy; mindhárom ág + az értékelés nélküli
ág ellenőrizve, mind §C PASS.

**Ellenőrzés:** a végleges levél (kép + fejléc nélkül, config-útról) kiment, és a Gmail az
**Elsődleges** fülre tette (`category:updates` üres). Éles processzben visszaolvasva a tárgy,
az első sor és a slug-link is helyes.

**Lead-postafiók kimutatás** (`scripts/lead-mailhost-report.mts`, MX-feloldással): Google-fiók
(Gmail + Workspace) **42,0%**, Microsoft 9,0%. Vagyis a fül-javítás a leadek több mint
négytizedét nyitotta meg.

## ⛔ KÖVETKEZŐ SZÁL — nyelvi őr (ADR-0070, tulajdonosi rendelet)

*„Minden emailre language őr kell… kritikus a leadek megszerzésének."*

Mért rés: `src/outreach/draft.ts` — a hideg megkeresés TELJES tárgya és törzse — **nincs rajta**
az `I18N_SOURCES` listán, és 0 `T()` hívása van. Ma csak azért nem baj, mert az ADR-0036
ország-kapu blokkolja a nem-`hu` címzettet; amint az kinyílik, minden lead magyarul kap levelet.
Ez a hibaosztály MÁSODSZOR fordul elő (ADR-0067 ugyanezt állapította meg) → a javítás ne a
fájlt tegye a listára, hanem tegye a listát AUTOMATIKUSSÁ (import-gráf a levél-adapter felől).

## Nyitott apróságok
- Két idegen fájl az éles kód-fában: `duplicates.ts`, `tmp-dup.mts` (2026-08-20, nem futnak).
- A statisztikai számjelnek (`69646014-7022-231-13`) nincs mezője az impresszumban.

---

## Pilot-BCC (tulaj kérése a session végén) — `d968122`

*„a pilot elején minden kimenő email bcc: olasz.ferenc@citoviso.com"*

`EMAIL_BCC` kapcsoló az EGYETLEN szűk keresztmetszeten (`EmailSender` adapter), így egyszerre
hat minden levéltípusra. Üres = kikapcsolva (pilot utáni állapot).

⛔ **Amit nem lehetett vakon megcsinálni:** a közös adapter viszi a tenant VENDÉGEINEK szóló
leveleket is, ahol nem mi vagyunk az adatkezelő, hanem a tenant. Vak BCC-vel harmadik felek
személyes adata (vendég neve, telefonja, foglalási dátumai, vélemény-szövege) ömlött volna a
mi postafiókunkba. Négy ilyen küldés van: `booking/requests.ts` ×2, `reviews/reviews.ts` ×2 —
köztük KETTŐ, ami a tulajnak megy, de végig vendég-adat.

**Szerkezeti kényszer, nem konvenció:** az `EmailMessage.audience` (`"platform" | "guest"`)
KÖTELEZŐ mező → a fordító minden küldésnél dönteni kényszerít, a jövőbeli kódnál is.
Alapérték szándékosan nincs: az némán „miénk"-nek minősítené a holnapi vendég-levelet.
(Ez ugyanaz a minta, amit az ADR-0070 nyelvi őrnél is kérünk: a szerkezet kényszerítsen,
ne a kézi lista.)

**Ellenőrizve:** mock-on a platform levél `Bcc`-t kap, a guest nem; SMTP-n a másolat igazoltan
megérkezett (Gmail: `toRecipients=citoviso`, `bccRecipients=gmail`). Kapu:
`scripts/check-email-bcc.mts`, pre-commitban, piros önteszttel.

⚠️ **Élesre ez MÉG NEM ment ki** — az éles `.env`-be is kell az `EMAIL_BCC` sor.

---

## Nyelvi őr ① — KÉSZ ÉS ÉLES (`a8304ee`)

*„Menjen komittal élesre, és a nyelviőr figyeljen rá."*

- `src/outreach/draft.ts` felkerült az `I18N_SOURCES` KÖZÖS listára, szövegei `T(d.lang, "…")`
  burkolást kaptak → **12 új katalógus-string**. A magyar kimenet karakterre változatlan,
  mindhárom szegmens + az értékelés nélküli ág §C PASS.
- **`DraftInput.lang` KÖTELEZŐ mező** → a fordító kényszerít dönteni minden hívóhelyen; a
  `buildDraftForProspect` `prepareMailLang()`-gel tölti a csomagot a renderelés ELŐTT.
- ⚠️ **Az őr HARMADIK vakfoltja** derült ki és lett javítva: a lint ÉS a kinyerő mintája csak
  EGYSZERŰ azonosítót fogadott el (`T(lang, …)`), a `T(d.lang, …)` tagkifejezést nem — 10
  helyesen burkolt szöveget jelölt hamis pozitívként, és a kinyerő sem látta volna őket.
  (Sorrendben: backtick-literál → többsoros `T()` → tagkifejezés.)
- Pirosra tesztelve: egy beégetett magyar visszaírása a `draft.ts`-be azonnal bukik.

**Élesen visszaolvasva** (`a8304ee`): tárgy `Beáta Nyaralóház – honlap-terv`, első sor a
Google-értékelés, `audience: platform`, `BCC: olasz.ferenc@citoviso.com`, fejléc nincs →
Elsődleges fül.

⛔ **A LÉNYEG HÁTRA VAN (ADR-0070 ②):** amíg az `I18N_SOURCES` KÉZI lista, ez a hibaosztály
negyedszer is visszajön. A lista legyen származtatott az import-gráfból.

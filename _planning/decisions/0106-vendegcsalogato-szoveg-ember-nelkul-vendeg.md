## ADR-0106 — Vendégcsalogató szöveg ember nélkül: vendég-vélemény korpusz + teljes multi-portál behúzás + „Honnan tudjuk?" forrás-panel (2026-09-07)

**Kontextus:** a tulaj visszatérő panasza, hogy a mock-szöveg műszaki-leíró és taszító
(„nyugodt kemping központi fürdőszobával, fehér csempével"), a jelenlegi ellenszer (a
Facebook-névjegy kézi beillesztése, ADR-0097 ③) pedig emberi kezet igényel — miközben a
pilot utáni jövőkép az ember-interakció NÉLKÜLI futás. Diagnózis (2026-09-07 felmérés):
a hangnem-prompt már jó (dekoráció-tilalom, vendég-érték-kényszer), a plafon az ADAT.
Három rés: (a) a Google-véleményekből CSAK szám jön (4,7 ★ · 124 db), szöveg soha — a
korábbi elutasítás oka a NÉZETENKÉNTI díj volt, ami a generálás EGYSZERI hívására nem áll
(~5 vélemény ≈ 0,025 USD/lead); (b) a portál-behúzás leadenként 2 profilnál megáll, pedig
a jelölt-lista 6 hostig terjed; (c) a kurátor nem látja, melyik szöveg-elem melyik
forrásból jött — a lead-mező- és fotó-provenance létezik, a szöveg-provenance nem.

1. **Vendég-vélemény = a vendégcsalogató hang forrása.** A vendég maga mondja ki, MIÉRT
   volt jó ott — ez az egyetlen forrás, ami eleve a vendég nyelvén beszél. Két csatorna:
   Places Details `reviews` mező (max 5 legrelevánsabb, csak generálás-úton lévő leadre,
   A4-kapuzott place-id-vel) + a portál-adatlapok schema.org `review` node-jai (CSAK
   high-band profilból — egy medium-band vélemény §F.17b szerint másik szállásé lehet).
2. **A vélemény TÉNY- és HANGNEM-forrás, nem másolható szöveg.** A prompt a vendég-hangot
   kapja meg külön blokkban; az író a saját szavaival ír („a vendégek visszatérően dicsérik
   a házigazda vendégszeretetét"), szó szerinti átvétel tilos (idegen szerzői mű). Az
   idézet-verifikált kinyerés (ADR-0097 ⑥) korpusza kiterjed a véleményekre, és a
   tényhűség-őr forrás-készlete is — vélemény-forrású állítás nem eshet forrástalannak.
3. **Google-tartalom frissesség-szabálya:** a Places-vélemény a lead raw-jába kerül
   `fetchedAt`-tal; 30 napnál öregebb tárolt vélemény generáláskor újra-lekérendő (a
   site_place_rating 30 napos mintája — a Places-tartalom tartós cache-elését a policy
   tiltja). A vélemény a MOCKBA nem kerül ki szó szerint; belső grounding-input.
4. **Multi-portál cap feloldva:** a portál-olvasás alapértéke 2 → 6 profil/lead (= a
   host-dedupolt jelölt-lista teljes szélessége). A politeness-réteg változatlan (host-
   soros olvasás, napi budget) — több portált olvasunk, nem gyorsabban.
5. **ownerIntro lefokozva boosterré:** marad, mint a legerősebb hang, ha van — de a
   ①–② után a korpusz nélküle is elég; a pilot utáni automata futásnak NEM feltétele.
   Konverzió után a tulaj az adminban írja a sajátját (az a végleges hang).
6. **„Honnan tudjuk?" forrás-panel** a konzol mock-nézetében: szöveg-elemenkénti
   provenance (hero ← ownerIntro / portál / vendég-hang / kép) + behúzási státusz
   (mely portál olvasva/kihagyva és miért, hány vélemény jött be). Felület-munka →
   §2b terv-jóváhagyási kapu alatt megy.

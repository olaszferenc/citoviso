## ADR-0366 — A rendelés nem esik csendben vissza (domain/ár → 409), egy rendelés = egy pay-link, a dev-útválasztás = az éles nginx, a csak-mobilos vevő is kap belépést, a kísérő SMS GSM-7

**Dátum:** 2026-10-11 · **Kontextus:** Elek 10-11 „megkeresés a lead szemével” köre (BLOKKOLÓ B1, B2; KÖZEPES K1, K2). **Visszaolvasva:** ADR-0032 (a kiírt = a terhelt), ADR-0330 (lead saját előnézeti aldomainje), ADR-0212 (nginx: vevő-oldali konzol-utak), ADR-0360 (domain csomag-tartalomként), ADR-0344 C2b (kampány-SMS GSM-7, ≤ 2 szelet). **Megtartja:** ADR-0109 „nem additív írás” (elutasított domain = nincs domain) — de rendelés sincs.

### Kiváltó (mérve, scratch-DB, 2026-10-11)
1. **B1** — a lead előnézeti hostján nyitott terv-lap „Fizetek — 6 430 Ft”-ot írt saját domainnévre, a böngésző `domain_name: null`-t küldött (a domain-választó a dev-ben 404-et kapott), a szerver a domaint elutasította, a rendelést CSENDBEN az aldomainre írta, 5 430 Ft-ot terhelt, és csak a konzol-naplóba írt.
2. **B1 oka a teszten:** a repó egyetlen állítása az útválasztásról egy komment volt („/p/ → konzol, a többi → public”). Élesen (olvasva) az nginx `/p/ /configure/ /pay/ /privacy /mock/ /site/`-ot küldi a konzolra MINDEN `*.citoviso.com` hoston — tehát élesen a domain-választó működik; a dev-emuláció volt hiányos. A csendes visszaesés viszont élesen is ugyanígy viselkedett volna bármely kliens/szerver eltérésnél (lejárt ajánlat, régi fül, hamis POST).
3. **B2** — csak-mobilos (MMS/SMS) lead fizetett, a pénztárban megadta az e-mailjét, a számla megjött, a belépés NEM (`activate()` csak `prospect.contact_email`-re adott belépést); a sikerlap közben azt írta: „e-mailben küldtük”.
4. **K2** — a hideg kísérő SMS UCS-2, 4 szelet (a „–” és az ékezetek); a kampány-SMS GSM-7, 2 szelet.

### Döntés
**① Nincs csendes visszaesés a rendelésen.** A `/configure/…/request` (és a `/p/<t>/request`) kezelője:
- saját domain, ami nem adható el (nincs név · nem kínált végződés · küszöb alatt) → **409 `domain_refused`** (`reason`, és az aldomain melletti szerver-ár), nincs `order_intent`, nincs pay-link;
- kliens-ár ≠ szerver-ár → **409 `price_changed`** (a szerver-ár és a most érvényes ajánlat), nincs `order_intent`. A régi „lista-árat mutató kliens is becsületes” kivétel megszűnt (az ajánlat-UI régóta él).
- A konfigurátor mindkettőre a meglévő hiba-mintával felel (`showDepNotice` sora): visszaáll az ingyenes címre, ill. a friss ajánlatra, visszalép a tervhez, kimondja az okot, hogy fizetés nem indult, és az ÚJ összeget — a fizetés-gomb is azt mutatja. A vevő újra dönt. A terhelt összeg továbbra is KIZÁRÓLAG a szerveré.

**② A dev-útválasztás az éles nginx.** `src/server/edgeRoutes.ts` (`CONSOLE_EDGE_PREFIXES`) az útválasztás egyetlen kód-példánya; `deploy/nginx/` az éles két fájl OLVASOTT másolata (deploy-forrás NEM). A public szerver a lead előnézeti hostján a konzol-előtagú kérést a konzolra adja tovább (élesen elérhetetlen ág — ott az nginx elkapja). Őr: `scripts/edge-routing-check.mts` (másolat ↔ tábla, a konfigurátor hívásai, élő mérés az előnézeti hoston).

**③ A belépés a vevő címére megy, ha a prospectnek nincs.** `activate()`: `prospect.contact_email`, ennek hiányában `order_intent.buyer_email` (a pénztárban kötelező). Ha egyik sincs (régi rendelés), a sikerlap nem állítja, hogy e-mailt küldtünk: kimondja, hogy a belépés még nincs kiadva, és kinek írjon; „Belépek” gombot nem kínál. A próba (ADR-0342) a saját űrlapjának kötelező e-mailjére ad belépést — nem érintett. **Élesről olvasva (2026-10-11):** 0 fizetett vásárlás, 0 próba — érintett vevő nincs.

**④ A kísérő SMS GSM-7, ≤ 2 szelet**, a kampány-SMS mintájára (ékezet nélkül; hosszú névnél a név rövidül, a link sosem). A §C SMS-kapu a hajtogatott szöveget is méri: a személyre szabás ékezet-függetlenül keresi a nevet (`SmsDraft.name`), a kész-oldal/keretezés/ár-szabályok ékezet nélküli ikre is fut — ékezet nélkül sem csúszhat át, ami ékezettel megakadna.

**⑤ K1 — csomag-tartalom a kártyán.** Ha a piacon a domain csomag-tartalom (ADR-0360, `pkgModules`), a csomag-kártya „Mit tartalmaz?” listájában a meglévő tétel-sor mintáján megjelenik a „Saját domainnév (.hu)” sor: pipával a lefedő csomagoknál, X-szel a többinél; A állapotban nincs ilyen sor. Új felirat-döntés nem született (a mock terv-lap és a csomag-kártya fő szövege az ADR-0360 „Nyitva” terv-köre marad).

**⑥ Egy rendelés, egy pay-link (Elek 5. kör K2).** Két egyidejű beküldés (két fül, dupla koppintás) eddig két `order_intent`-et és két fizethető pay-linket nyitott. A rendelés-kezelőben leadenként egyszerre egy beküldés fut (rögzítés → jóváhagyás → pay-link; egy konzol-folyamat szolgál ki minden rendelés-utat), és ugyanannak a leadnek egy AZONOS (kosár, ciklus, ár, cím, vevő-e-mail), 30 percen belüli, le nem zárt első rendelése újrahasznosul: ugyanaz a pay-link megy vissza. Más tartalmú rendelés saját linket kap — a régi a képernyőn már nem látható összeget terhelne (ADR-0032); ha mindkettőt kifizetik, a meglévő „már kifizette… visszautalás” út marad.

**K3 (Elek 5. kör) — lejárt kupon:** a kliens a lejárt kedvezménnyel 71 250-et küldött, a szerver 95 000-es rendelést nyitott. Ezt az ① `price_changed` ága fedi: nincs rendelés, a konfigurátor az ajánlat nélkül újraszámol, és a vevő a pénztár ELŐTT az új összeggel dönt (őr-eset: `order-silent-fallback-check` B, „az ajánlat lejárt”).

### Őrök
`order-silent-fallback-check` · `order-double-submit-check` · `edge-routing-check` · `mobile-buyer-login-check` · `pair-sms-gsm7-check` · `package-domain-row-check` — mind bekötve; a régi kódon ①②③ mutációval PIROS, ④ a régi kódon UCS-2/4 szelet.

### Visszafordíthatóság
🔄 könnyű — kód-szintű; adat és éles konfiguráció nem változott (élesre semmi nem ment, az nginx érintetlen).

## ADR-XXXX — Belépés: egy hely, egy mondat, a saját címen is

**Dátum:** 2026-10-21 · **Státusz:** elfogadva (tulajdonosi döntés: „A + B, mindkettő”) · **Érinti:** ADR-0023 (tenant-belépés), ADR-0041 (slug → saját domain 301), ADR-0071 (domain-beszerzés), ADR-0303 (jelszó-link), ADR-0344 (próba-folytatás)

### Kontextus
Élesen, 2026-10-21-én egy próbából vásárló tulaj (Rebeka-teszt → `overseer`, `overseer.hu` rendelve) a fizetés után két
levelet kapott: a számlát (a honlap címe a törzsben, a belépés CSAK a lábléc egy sorában) és egy domain-levelet. Belépő-levél
nem ment, mert a fiók a próba óta megvolt. A tulaj szavai: „A paraszt aki most adott ki lóvét hogy tud belépni? Én sem tudom!”
· „A kapott levelekben sem egyértelmű.” · „Mi van ha megvette a honlapot? overseer.hu ott hol? vagy citoviso-s honlapon?”
· „Bármilyen belépési linket küldünk, az a végén mindig ugyanarra mutasson.”

A belépés négyféleképpen volt megfogalmazva („Belépés a szerkesztő felületre:”, „Belépés citoviso.com/login”, a lábléc sora,
a belépő-levél „Belépés” sora), a honlap a `<slug>.citoviso.com`-on (később a saját domainen) él, a kezelőfelület viszont
a platform hoszton — a `/admin` és a `/login` a tenant hosztról 302-vel a `citoviso.com/login`-ra dobott.

### Döntés
**A — egy mondat mindenhol + „Megrendelését aktiváltuk” levél.**
1. Minden vásárlás-aktiváláskor (új rendelés ÉS próba-folytatás) EGY levél megy: tárgy „Megrendelését aktiváltuk — {site}”;
   ① a honlap címe most · ② a saját webcím állapota (beszerzés alatt — .hu: „… a magyar Nyilvántartó hagyja jóvá, ez általában
   egy napon belül megtörténik …”, más végződés: „… a cím beállítása néhány perc …”, mindkettő: „… a mostani cím automatikusan
   átirányít; nincs teendője, levélben jelezzük.” / él: a cím / nincs: elmarad) · ③ „Belépés: citoviso.com/login · Felhasználónév: …” — jelszó-beállító link CSAK új fióknál, meglévőnél
   „A jelszava nem változott.” · ④ a következő terhelés napja és összege (ugyanaz a számítás, mint a fizetés utáni lapé).
   Új rendelésnél ez váltja ki a külön „Belépési adatai” levelet (a fizetés csak kiadja a belépést, a jelszó-link ebben a levélben
   megy); a próba indulásakor a „Belépési adatai” marad. Naplózva `tenant_message` `credentials` fajtával, a rendeléshez kötve
   (`related_kind = order_intent`), így egy újraküldött webhook nem küldi kétszer.
2. A fizetés utáni lap a ② mondatot ugyanígy mondja (`domainStateText`), a belépés-sor és a felhasználónév marad.
3. Egy mondat, egy forrás: `loginSentence()` (`src/email/platformLayout.ts`) — „Belépés: citoviso.com/login”; a levelek záró sora
   is ezt mondja (a „Belépés a szerkesztő felületre:” kivezetve), a súgó is így idézi.

**B — belépés a saját címen is.** A tenant hoszton (`<slug>.citoviso.com`, később a saját domain) a `/login` és az `/admin`
nem dob a platformra: ugyanaz a belépő-űrlap, hosztonkénti munkamenet-süti, belépés után `/admin` ugyanott; idegen tenant
hosztján belépés nincs (hibaüzenet). A `citoviso.com/login` marad (az A mondata ide mutat), de belépés után a felhasználó egy
egyszer használatos, rövid életű átadó tokennel a SAJÁT hosztjának `/admin`-jára kerül — „a végén mindig ugyanarra mutat”.
Őr: `tenant-host-login-check`.

### Összefésülés az ADR-0399/0400-zal (2026-10-25, tulaj: „igen”)
Ez a munka 10-21-én elkészült, de nem landolt; közben landolt a Webcím állapot-képernyő (ADR-0399, a tenant-admin Webcím
fülén — nem ütközik) és a „Megvásároltuk a webcímét” levél (ADR-0400, a vétel pillanatában). A ② mondat ezért UGYANAZT a
várakozást mondja, mint az ADR-0400 levele: csak a `.hu` vár a Nyilvántartóra (mérve overseer.hu: kb. egy nap), minden más
végződés percek — az eredeti „jellemzően 1–2 nap” minden végződésre túl sokat ígért volna. A két levél egymás mellett marad:
az aktiváló levél a fizetéskor mondja el a teljes képet, a vétel-levél a regisztráció tényleges megtörténtét igazolja.
A „B” rész (belépés a tenant hoszton, `tenant-host-login-check`) MÉG NINCS megírva — külön land.

### Kód
A: `src/email/activationEmail.ts` (új) · `src/payment/activationMail.ts` (új: küldés + `ownerDomainState`) · `src/payment/service.ts`
(aktiválás: csak belépés-kiadás; a levél az előfizetés után; összegzés `domain`) · `src/console/views.ts` (`/pay/done` domain-jegyzet) ·
`src/email/platformLayout.ts` (`loginSentence`) · őrök: `owner-login-mail-check` (7. pont), `free-trial-expiry-check` · súgó
`admin-account` · kontraktusok `paydone-split`, `checkout-fullscreen`, `proba-c` (módosító sor).

### Visszafordíthatóság
🔄 A: a levél egy hívás az aktiválás végén; visszavonásakor az `issueAndSendTenantLogin` visszakerül az aktiválásba.
B: a tenant-hosztos belépés kikapcsolva a régi 302-re esik vissza.

### Elvetett alternatívák
- A belépés-sor kiemelése a számla-levélben: a számla könyvelési irat, továbbítják a könyvelőnek — a belépés nem oda való,
  és a domain-állapotot sem mondaná.
- Csak a próba-folytatásra küldeni levelet: az új rendelés vevője is két levélből (számla + belépési adatok) rakná össze, hol mi van.

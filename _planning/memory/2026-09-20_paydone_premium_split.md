# A fizetés-visszaigazoló: a vevő lapja lett, nem a konzol egy nézete (2026-09-20)

**Kiindulás (tulajdonosi bejelentés, képernyőképpel).** *„Ez az oldal a kinézete miatt nem
bizalomgerjesztő, mert nagyon gagyin, nem profin néz ki! Adj 4 javaslatot!"* — az éles
`/pay/done` sikeres lapja, 5 430 Ft, Aranykagyló 36.

## Mérve, mi volt a baj (a forráson, nem szemre)

`src/console/views.ts` `payResultPage` sikeres ága: a siker **le volt írva, de nem
megmutatva** (egyetlen zöld szövegsor) · **dokumentum-ritmus** (h2 → bekezdés → doboz → natív
`<ul>` pöttyök, végig inline `style=`-okkal) · a megvett oldal **nyers URL-ként** a lap
közepén · **nulla bizalmi jel** egy fizetés után (se tranzakció-azonosító a fejlécben, se
„biztonságos fizetés", se lábléc) · a CTA magányosan lógott, a lap „elfogyott", nem lezárult.

## A kör

Négy terv (`_drafts/paydone-{A,B,C,D}`), mind **mobil 390px + asztali**, méret-váltóval
(`@container`), élő másolás-gombokkal: **A** digitális nyugta · **B** siker-pecsét +
oldal-kártya · **C** onboarding-lépcső · **D** prémium sötét/split. A tulaj mind a négyet
kérte megnézni, majd a **D**-t választotta, és az előnézet forrásáról is döntött:
**screenshot + kétszintű tartalék**. Befagyasztva: `assets/design-refs/console/paydone-split/`
(plan.html + README = kontraktus), felület-kapu `approve`-val nyitva. **ADR-0190.**

## Szállítva

- `layout(… shell:"bare")` — a visszaigazoló saját, teljes felületű vázat kap: nincs
  konzol-fejléc, nincs `.con` body. A rendszer kerete nem írja felül a jóváhagyott tervet.
- Kéthasáb asztalon / egy oszlop mobilon; pecsét (mozgás-érzékenyeknek animáció nélkül);
  böngésző-keretes előnézet „ÉL" jelvénnyel; a cím **objektum** (másolás + megnyitás).
- `src/payment/siteShot.ts` — képernyőkép az ÉLES snapshotról, **aktiváláskor előre gyártva**
  (`service.ts`, fire-and-forget), cache-kulcs = tenant + snapshot mtime (egy szerkesztés
  retirálja a régit). Kiszolgálás: `GET /pay/preview?paymentId=…` — operátor-session NÉLKÜL,
  mert a vevő nézi; a gateway-hivatkozás maga a képesség, csak `paid` fizetésre.
- `tenantCoverPhoto()` (`tenant/editor.ts`) — a ② szint, a szerkesztői override/base
  precedencia ugyanazon az úton, nem egy második másolaton.
- A tartalmi kontraktus hiánytalan (következő terhelés · megújulás · ÁFA · számla · lemondás ·
  felhasználónév · belépés · mit szerkeszthet · másolható hivatkozás · support).
- `payCopyScript` általánosítva `[data-copy-target]`-re (a cím ÉS a hivatkozás másolható).

## ⛔ Amit az út megtanított (mind mért, mind a SAJÁT kódomban)

1. **`order_intent.tenant_id` NULL az ELSŐ vásárlásnál** — a tenant az aktiváláskor születik,
   a leaden át található meg. Erre kötve az előnézet pont az ÚJ vevőknél maradt volna üres,
   miközben upsellnél tökéletesen működik. A `getActivationSummary` azóta ad `tenantId`-t.
2. **A markup „rendben volt", a vevő mégsem látta:** a citui.css saját `h1`-szabálya verte a
   sötét lap `body` színét → navy-on-navy címsor. Csak a KIRAJZOLT lap mutatta meg.
3. **A fixen alul ülő süti-sáv rátakart az EGYETLEN CTA-ra** — a lap most a
   `--citui-consent-h` tokennel hagy helyet.
4. **Az első screenshotom féllábú volt** (hero nélkül): csak `<img>`-eket ellenőriztem, a
   template-ek többsége CSS `background-image`-ként festi a nyitóképet → a hálózati napló az
   egyetlen őszinte tanú. (Mellék-lelet: az `aranykagylo-36` élő lapjának portál-hero URL-je
   **404** — a fotó-rohadás megint, a lánc ezért esik a ②/③ szintre.)
5. **A saját őröm HAMIS PIROSAT adott:** az „egy összeg, egyszer" állítást a forrásban mérte,
   ahol a terhelt összeg jogosan szerepel a Barion-pixel adataiban is. A mérés azóta a
   LÁTHATÓ szövegen fut, és a fixture megújulás-összege szándékosan eltér.
6. **A saját mock-ellenőrzőm sorrendje volt rossz** (a másolás-gombot a CSUKOTT blokkban
   kereste), és az első lövés a fix magasságú kereten belüli görgetés miatt **levágta a lap
   alját, benne a CTA-val** — a vázlat-képet is meg kell tanulni helyesen készíteni.
7. **Mock-leletek, amiket csak a kép mutatott meg:** oszlop-irányú flexben a `flex-basis` a
   MAGASSÁGRA fordul (180 px-es üres doboz a C-ben) · `order:2` a gombok elé tette a címet ·
   az A/B asztali terve 560/620 px-es oszlop volt 1280 px-en, azaz **ugyanaz a kongás**,
   amit a tulaj kifogásolt → a desktop külön tervezői döntést kapott.

## Kapuk

`paydone-split-check.mts` — forrás-állítások + **kirajzolt** mérés 390 és 1280 px-en
(címsor-luminancia, CTA-magasság, süti-sáv helye, vízszintes túlfolyás, látható összeg-
duplikáció), a két mért hibára **negatív kontrollal** (visszarontva pirosra vált) · tsc ·
i18n-lint + katalógus · design-token-lint (a lap minden színe tokenből jön; a CSS
szándékosan **inline**, mert a fizetés utáni másodpercben nem függhet CDN-cache-től).

## 🚀 ÉLESÍTVE — és a KB-kapu nyolc köre

A tulaj engedélyt adott (`mehet élesre`). A deploy-kapu azonban **KB-verdiktet követelt** a
`4a59e13..99ec180` tartományra, és a `tudasbazis-or` **FLAG**-elt: két szócikk valótlant
állított a felületről. ⛔ **Egyik sem a fizetés-visszaigazolóé** — a vevői lap indokoltan marad
saját entry nélkül, és az őt IDÉZŐ entryk (admin-modules, admin-multilang) tételesen állnak.
A leletek a MÁSIK két szál munkájához tartoztak (mock-kártyák, ADR-0191), de a verzió mindkettőt
vitte, tehát nekem kellett rendbe tennem.

**A kör mérete: nyolc verdikt, és a nyolcból HATOT a saját javításom termelt.** A minta:
a szakasz, amit írtam, minden gépi kapu BELSŐ logikáját le akarta tanítani, ezért minden mondat
egy külön alrendszer pontos ismeretét kérte — és mindig maradt egy, amit a kapu NEVÉBŐL
következtettem. Mért félrevezetések: „Piacok menü" (nincs ilyen; a jogi csomag a Beállítások
lapon) · „másoló-panel" (kód-belső név, a képernyőn „A mock szövege") · „piros = bukott"
(egyik kapu sem ad `fail`-t) · „az indoklás kötelező" (a felugróban NEM az) · „öt kapu"
(a Nyitókép sosem blokkol). **A megoldás a szűkítés volt:** a súgó ma azt mondja, ami biztosan
igaz és a kurátornak számít — *„a jelvény nem az utolsó szó — a küldésnél derül ki, mi állít
meg"* —, a részletes leletet a felugró mondja meg.

**Két valódi termék-lelet a körökből:**
- a nem ítélhető kapu (`error`) **ZÖLDEN** jelenik meg, pedig megállítja a küldést (a
  `mockInputValue` csak `pass/flag/fail`-t fordít, a CSS-nek nincs `error` szabálya) — a súgó
  ezt kimondja, a **kód javítása nyitott tétel**;
- a `demoFraming` kapu megállítja a küldést, de a konzolnak **nem volt rá neve** — a felugró
  olyan kaput nevezett meg, amit az operátor sehol nem látott. Megkapta (`mockInputLabel`).

**⚠️ És közben egy PÁRHUZAMOS SZÁL ugyanezt a KB-javítást írta meg — az övé landolt előbb, és
ő élesített.** Az éles `91b856d` (tag `prod/20260920-2138`) — ez **tartalmazza a fizetés-
visszaigazolót is**, mert a verzió megy ki, nem válogatás (ADR-0053). A duplikátumot eldobtam;
a záró commit (`c8f2eb9`) CSAK azt viszi, ami nála nincs: a kapu-jelvény szakasz, a
`demoFraming` konzol-címke és a kb-shot animáció/időzítő-némítása.

## Nyitott

- A ① szintű screenshot ezen a dev-adaton nem áll elő, mert az élő lap hero-fotója portál-URL
  és 404 — friss begyűjtés vagy tulaj-fotó után jön meg magától.
- A `!paid` (elutasított) lap változatlan: annak saját jóváhagyott terve van
  (`design-refs/console/pay-gateway-exit/`).
- **KÓD-tétel:** a nem ítélhető (`error`) kapu zöld jelvénye + a `staleFile` ág, ahol a sáv
  „a megerősítéssel kimegy"-et ígér, de a felugró sosem jön (a `verdictsNeedingConfirm`
  kizárja) — a kurátor piros sávot kap kiút nélkül.

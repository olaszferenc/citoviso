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

## Nyitott

- A ① szintű screenshot ezen a dev-adaton nem áll elő, mert az élő lap hero-fotója portál-URL
  és 404 — friss begyűjtés vagy tulaj-fotó után jön meg magától.
- A `!paid` (elutasított) lap változatlan: annak saját jóváhagyott terve van
  (`design-refs/console/pay-gateway-exit/`).
- Élesítés nem történt — ez külön, kimondott utasítás (§0.3).

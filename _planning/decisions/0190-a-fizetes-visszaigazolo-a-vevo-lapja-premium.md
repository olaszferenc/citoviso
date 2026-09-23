## ADR-0190 — A fizetés-visszaigazoló a VEVŐ lapja: prémium split, és az előnézet három szintje (2026-09-20)

**Kontextus.** A tulaj ránézett az éles `/pay/done` sikeres lapjára, és kimondta:
*„nem bizalomgerjesztő, mert nagyon gagyin, nem profin néz ki"*. Mérve: a siker **le volt
írva, de nem megmutatva** (egy zöld szövegsor), a lap **dokumentum-ritmusú** volt (h2 →
bekezdés → doboz → natív `<ul>` pöttyök, inline `style=`-okkal), a megvett oldal **nyers
URL-ként** állt a lap közepén, és egy fizetés után **nulla bizalmi jel** volt rajta. Ez az a
képernyő, ahol a vevő pénze már elment és még semmit nem kapott a kezébe — itt a látvány
maga a termék-ígéret.

**Döntés.**
1. **A visszaigazoló a VEVŐ lapja, nem a konzol egy nézete.** Négy terv közül (nyugta ·
   pecsét+oldal-kártya · onboarding-lépcső · split) a tulaj a **„D — prémium sötét/split"**-et
   választotta; a terv befagyasztva: `assets/design-refs/console/paydone-split/`
   (plan.html + README = a megvalósítás kontraktusa). A lap saját, teljes felületű vázat kap
   (`layout(… shell:"bare")`): nincs konzol-fejléc, nincs `.con` body — a rendszer kerete nem
   írhatja felül a jóváhagyott tervet.
2. **Kéthasáb asztalon, egy oszlop mobilon.** Balra a MEGVETT DOLOG (pecsét, állítás,
   előnézet, másolható cím), jobbra a PAPÍRMUNKA (összeg, előfizetés, belépés, egy CTA).
   A két méret két külön tervezői döntés.
3. **Az előnézet HÁROM SZINTŰ, és soha nem üres:** ① képernyőkép az ÉLES oldalról
   (`src/payment/siteShot.ts`, aktiváláskor előre gyártva, cache-kulcs = tenant + snapshot
   mtime, így egy szerkesztés retirálja a régit) → ② a lap nyitóképe (`tenantCoverPhoto`) →
   ③ márka-gradiens a név-overlay-jel. A lap **soha nem vár** a képre: a szintek a markupban
   rétegződnek (a gradiens a doboz háttere), a be nem töltő fotó `onerror`-ral eltűnik.
4. **A tartalmi kontraktus hiánytalan marad** (checkout-fullscreen ⑪): következő terhelés,
   megújulás, ÁFA, számla, lemondás módja, felhasználónév, belépés, mit szerkeszthet,
   másolható hivatkozási azonosító, support-cím. A „Most fizetett" sor viszont KIKERÜLT a
   split lapról: ugyanaz az összeg áll a kártya fejlécében közvetlenül fölötte.
5. **A képernyőkép csak akkor érvényes, ha az első képernyő MINDEN képe betöltött** — az
   `<img>`-eken túl a CSS `background-image`-ek is, a hálózati napló alapján.

**Következmények / amit az út MEGTANÍTOTT (mind mért, mind a saját kódomban):**
- ⛔ **`order_intent.tenant_id` NULL az első vásárlásnál** (a tenant az aktiváláskor születik,
  a leaden át található meg). Erre kötve az előnézet pont az ÚJ vevőknél maradt volna üres,
  miközben upsellnél működik. A `getActivationSummary` ezért ad `tenantId`-t, és mindkét út
  (lap + kép-kiszolgáló) azt használja.
- ⛔ **A markup „rendben volt", a vevő mégsem látta:** a citui.css saját `h1`-szabálya verte a
  sötét lap `body` színét → a címsor navy-on-navy volt. Csak a KIRAJZOLT lap mutatta meg.
- ⛔ **A fixen alul ülő süti-sáv rátakart az EGYETLEN CTA gombra**; a lap most a
  `--citui-consent-h` tokennel hagy neki helyet.
- ⛔ **Az első screenshotom féllábú volt** (hero háttérkép nélkül), mert csak `<img>`-eket
  ellenőriztem — a template-ek többsége CSS-háttérként festi a nyitóképet.
- ⛔ **A saját őröm adott HAMIS PIROSAT:** az „egy összeg, egyszer" állítást a forrásban mérte,
  ahol a terhelt összeg jogosan szerepel a Barion-pixel adataiban is. A mérés azóta a
  LÁTHATÓ szövegen fut, és a fixture megújulás-összege szándékosan más.
- Őr: `scripts/paydone-split-check.mts` — forrás-állítások + kirajzolt mérés két méretben,
  a két mért hibára **negatív kontrollal** (visszarontva pirosra vált).

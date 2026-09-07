---
id: console-pricing
title: Árazás és értékesítés — valós árak, eladhatóság, ár-hirdetési kapu
audience: operator
anchors: console.pricing
updated: 2026-09-07
---

Az **„Árazás és értékesítés”** képernyőn állítod be a valós árakat régiónként, és itt döntöd el
modulonként, hogy egyáltalán **eladható-e**. Ezek az árak jelennek meg a prospect-konfigurátorban
és a nyilvános oldalon — és itt van az a kapcsoló is, ami nélkül a rendszer egyáltalán nem
hirdethet árat.

**Hol találod:** a felső menüben a **„CRM”** menüpont legördülőjében, **„Árazás és értékesítés”**
néven. (Korábban a **„Pénzügy”** alatt volt — 2026-09-06 óta a CRM-hez tartozik, mert
értékesítési döntés.) Az Irányítópulton a CRM-kártyán is ott a sora, mellette egy jelvény, ami
mutatja, hány modul eladható a katalógusból (például „13/14 eladó”).

![Képernyőkép: az árazás és értékesítés képernyő telefonon](assets/hu/screen.png)

## Régió-váltó

A panel tetején a régiók között váltasz (Magyarország = HUF, Globális = EUR fallback). Minden
régiónak saját ár-sora van; amelyik régióra nincs mentett ár, az a globálisra esik vissza.

## Az ár-mezők

- **„Alapdíj (a gerinccel együtt)”** — a havi előfizetés alapára; a gerinc (honlap + érdeklődés-CTA)
  benne van.
- Éves előfizetésnél ingyenes hónapokat adsz (12 − N hónap árát fizeti).
- **Saját domain** — a rajtunk keresztül intézett egyedi domain éves díja.
- **Modul-árak** — modulonkénti havi felár, a konfigurátor ugyanebből számol.

## Modul-felárak és értékesítés — az eladhatóság kapcsolója

A **„Modul-felárak és értékesítés”** blokkban minden felárazott modul sorában van egy
kapcsoló és egy ár-mező. (A gerinc-elemek kivételek: náluk „gerinc — az alapdíjban” áll,
mert az alapdíj tartalmazza őket — se kapcsolójuk, se külön áruk nincs.) A kapcsoló azt
dönti el, hogy a modul **új ügyfélnek eladható-e**:

- **Bekapcsolva** — a modul normálisan megjelenik az ajánlatban.
- **Kikapcsolva** — a modul neve áthúzva jelenik meg, és a sor kiírja: **„Leállítva — új
  előfizetés nem köthető rá; a meglévők futnak tovább.”**

A blokk címe alatt a képernyő ezt ki is mondja: „A kikapcsolt modult új ügyfél nem kapja meg
(konfigurátor, kiküldött mock, konverzió) — a meglévő előfizetéseket nem érinti.”

⚠️ **Mit jelent ez a gyakorlatban?** A kikapcsolás MIND A NÉGY eladási pontot lezárja: a
prospect-konfigurátorban nem választható, a kiküldött mockban mintaként sem jelenik meg,
konverziókor sem kerül bele a csomagba, és a tenant-admin sem tud rá előfizetni. Aki viszont
MÁR fizet érte, annak változatlanul megy tovább, és kezelni is tudja.

Ha egy modulra már van élő előfizetés, a neve mellett egy jelvény mutatja a darabszámot
(például „3 élő”). Ez a figyelmeztetésed: a kikapcsolás őket nem vágja el, de új ügyfelet
nem szerzel rá többé.

**Mikor kapcsold ki?** Ha a modul még nincs kész az értékesítésre (nincs kidolgozva a
folyamat, nincs marketing-anyag, vagy még nem tudod kiszolgálni). Az egyedi e-mail cím modul
például alapból ki van kapcsolva — külön marketing-körrel indul.

## Egyedi domain — feltételek (ADR-0093 / ADR-0109)

Az **„Egyedi domain — feltételek”** blokk a domain-üzlet szabályait állítja:

- **„Vételi ár-plafon (a mi költségünk)”** — euróban: ennél drágább domaint a rendszer NEM
  vesz meg (a prémium/emelt díjas nevek így nem csúszhatnak át az automata vásárláson). A
  vevő az ilyen névre már az ellenőrzésnél elutasítást lát. Ez EGY közös érték: a
  **Magyarország** lapon állítod, és minden vételre az érvényes — a többi régió lapján a
  mező csak erre mutat.
- **„Minimum elköteleződés”** — hány hónap előfizetést vállal, aki rajtunk keresztül kér
  domaint. Ez kerül a megrendelésre és az áttekintő képernyőre is.
- **„Saját domain ekkora csomagtól választható”** — ez BELÉPÉSI FELTÉTEL, nem kedvezmény
  (ADR-0109): aki ennél kisebb csomagot választ, annak a saját domain nem olcsóbb, hanem
  egyáltalán nem elérhető — a konfigurátorban meg sem jelenik választható lehetőségként,
  csak egy ajánló kártya mutatja, mennyi hiányzik hozzá. ⚠️ A küszöböt a **listaár** dönti
  el: a kedvezmény (pl. a bemutatkozó −25%) NEM számít bele, mert egy időszakos engedmény
  nem vehet meg egy tartós jogosultságot.
- **„Saját domain (rajtunk keresztül)”** — a név **havi** díja (ADR-0109). Nincs ingyen-ág:
  a küszöb feletti csomag sem teszi ingyenessé, és a díj minden számlázási cikluson szerepel,
  amíg a név a vevőnél van. Kedvezmény erre a díjra SOHA nem megy (átfolyó registrar-költség).
- **„Domain vételára (korai kilépéskor)”** — a hűségidő alatt nincs szabad lemondás
  (ADR-0094): a korai kilépő a hátralévő hónapok díját (kötbér) mindig megfizeti, a domain
  vételárát pedig CSAK akkor, ha a domaint el is viszi. Ha nem viszi, a domain nálunk marad.
  A hűségidő **letelte után** nincs kötbér és nincs csomag-minimum: a név díjmentesen a vevőé,
  és már csak a havi díj fut tovább, amíg nálunk tartja a nevet.

## Az ár-hirdetési kapu (Fttv./§C)

A mentés fölött egy jelölőnégyzet: **„Az árak véglegesek, élesíthetők”**. Amíg NINCS bepipálva,
a kiküldött levél nem hirdethet árat, és a nyilvános oldal „Egyedi ajánlat”-ot mutat. Ez
fogyasztóvédelmi kapu (megtévesztő ár-állítás tilalma) — csak akkor pipáld be, ha az árak
tényleg véglegesek.

## Mentés

Az **„Árazás mentése”** gomb (a felirat mögött ott a régió neve is) a kiválasztott régió árait
és az eladhatóság-kapcsolókat menti. A mentés azonnal él: a következő
konfigurátor-megnyitás és mock-kiküldés már az új árakkal számol. Régiónként külön ments —
a magyar mentés a globálist nem írja át.

## ADR-0107 — A Google Business Profile KÜLÖN FIZETŐS MODUL, nem a nulladik pont része; és amit magunk nem jártunk végig, azt nem adjuk el (2026-09-07)

**Kontextus.** A pilot élesedésekor (`dbbd5a7`) felmerült a GBP-szál elindítása. A felmérés
két kemény tényt hozott:

- **A GBP API-hoz nem kulcs kell, hanem JÓVÁHAGYÁS**, és a jelentkezés előfeltétele egy
  *saját*, **60+ napja hitelesített** Google Business Profile weboldallal, a kérelmet a
  profil tulajdonosaként/kezelőjeként szereplő címről beadva (Google GBP API prerequisites).
  A jóváhagyás a kvótán mérhető: 0 QPM = nincs jóváhagyva, 300 QPM = van.
- **A tenant profiljához a tenant OAuth-engedélye kell** — ez egybevág a korábbi
  döntéssel (RÉTEG C: konverzió UTÁN, tulajjal a hurokban; „a GBP-t sose ígérjük
  automatikusan létrehozottként").

**Döntés (tulaj, 2026-09-07):**

① **A GBP KÜLÖN FIZETŐS MODUL lesz — nem az alapcsomag része, és nem a nulladik pont
(hideg megkeresés / mock) része.** Nem elvetjük, hanem elhalasztjuk és becsomagoljuk.

② **Az indok, ami a döntés lényege — és általános szabály:** *nem adhatunk el egy eljárást,
amit magunk sem jártunk még végig.* A tulaj szava: „meg akarjuk győzni a véleményünk szerint
nagyon hozzáértő ügyfélkört egy olyan eljárásról, amivel még mi sem vagyunk tisztában, hogy
mikor és hogyan kell beregisztrálni". Egy hitelesítési/regisztrációs folyamatot, aminek a
lépéseit, átfutását és buktatóit nem ismerjük mérésből, nem ígérhetünk meg fizető vevőnek.
⇒ **A modul kiadásának ELŐFELTÉTELE, hogy a folyamatot MAGUNKON végigvigyük** (a Citoviso
saját GBP-jén), és a tapasztalat dokumentálva legyen.

③ **A Citoviso saját GBP-jének létrehozása AZONNAL indul** (tulaj végzi) — két okból: ez
indítja a 60 napos órát, ami az API-jóváhagyás előfeltétele, és ez a saját láthatóságunk is.
⚠️ **NEM a Mineral meglévő profiljával**: a cég, a weboldal (`citoviso.com`) és a kérelmező
e-mail EGY entitás legyen — a `.hu` domain-igénylés pont a kevert adaton bukott el
(ADR-0103, `feedback_approved_params_are_the_approval`).

④ **Az ADR-0102 gépezete viszi:** a modul a katalógusba felvehető, de **alapból NEM
eladható** (`module_sales_disabled` seed), ahogy az e-mail-modul. Így egyszerre teljesül,
hogy (a) a nulladik ponton nem ajánlódik fel, (b) a mockban mintaként sem jelenik meg, és
(c) egyetlen kapcsolóval élesíthető, amint a ②–③ feltétel teljesül. Kód-oldali GBP-munka a
jóváhagyásig NEM indul (nem építünk olyan integrációt, amit nem tudunk kipróbálni — §B.17).

**⛔ KÖTELEZŐ KÖVETKEZMÉNY — a publikus ígéret ma TÖBBET mond, mint amit az alap szállít.**
A `public/index.html` jelenleg ezt hirdeti: „amit **megtalálnak a Google-ön és a térképen**"
és „Megtalálnak a Google-ön — **A térképen** és a keresőben is előrébb." A „térképen" =
Google Maps = GBP. Ha a GBP külön fizetős modul, akkor az alapcsomag olyat ígér, amit nem
szállít — méghozzá annak a szegmensnek, amelyiknek a leginkább hiányzik (a „nincs
Maps-pontja" lead a legértékesebb célpontunk). Amit az alap valóban ad (ADR-0041 RÉTEG A,
élesen kint): technikai SEO, Schema.org geo/NAP, sitemap, canonical, település-alapú title
— ez a **keresőben** segít; egy Schema.org koordináta **nem hoz létre térkép-pontot**.
⇒ **A nyilvános szöveget hozzá kell igazítani ahhoz, amit az alap tényleg ad** (a térkép-ígéret
a modulhoz tartozik, nem az alaphoz). Amíg ez nem történik meg, a landing megtévesztő
állítást hordoz (§I bait-and-switch tilalom + Fttv.).

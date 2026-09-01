// Deterministic legal texts (03-INVARIANTS §H.22: legal wording is NEVER
// AI-generated at runtime — it lives here, versioned, and the accepted version
// is stamped onto the record that carries the acceptance).

/**
 * §A photo-rights self-declaration, accepted at order submit. Covers the three
 * mandatory elements: possession of rights, warranty, indemnification.
 */
export const PHOTO_RIGHTS_DECLARATION_V1 =
  "Kijelentem, hogy a honlapomon megjelenítendő fényképek tekintetében " +
  "felhasználási joggal rendelkezem, vagy az élesítésig saját, jogtiszta " +
  "képeket töltök fel. Szavatolom, hogy az általam jóváhagyott képek " +
  "felhasználása harmadik személy jogát nem sérti, és vállalom, hogy az ebből " +
  "eredő igények alól a Citoviso-t mentesítem (kártalanítás).";

/**
 * Consumer waiver of the withdrawal right, accepted by 'individual' buyers at
 * order submit (0029).
 *
 * WHY IT IS MANDATORY: we go live immediately on payment, i.e. we begin (and
 * complete) performance inside the 14-day withdrawal window. Under 45/2014.
 * (II. 26.) Korm. r. 29. § (1) a) the consumer only loses the withdrawal right
 * if they gave EXPRESS PRIOR consent to start performance AND acknowledged the
 * forfeiture. Without this record a consumer could withdraw for 14 days after
 * their site was built and demand a full refund.
 *
 * Business ('business') buyers are not consumers — this is NULL for them.
 */
export const WITHDRAWAL_WAIVER_V1 =
  "Kifejezetten kérem és hozzájárulok, hogy a Citoviso a szolgáltatás " +
  "teljesítését — a honlapom elkészítését és élesítését — a 14 napos elállási " +
  "határidő lejárta előtt, a fizetést követően azonnal megkezdje. Tudomásul " +
  "veszem, hogy a szolgáltatás egészének teljesítését követően a 45/2014. " +
  "(II. 26.) Korm. rendelet 29. § (1) bekezdés a) pontja alapján az elállási, " +
  "illetve felmondási jogomat elveszítem.";

/**
 * ÁSZF + privacy-notice acceptance, accepted by BOTH buyer types (0029).
 *
 * The ÁSZF document now exists (ADR-0056): `ASZF_V1` below, served at /aszf.
 * The configurator still only renders the acceptance row when `config.termsUrl`
 * resolves, which happens once the Impresszum env fields are filled — a
 * tick-box pointing at a document full of `[KITÖLTENDŐ: …]` is worth no more
 * than one pointing at a 404.
 */
export const TERMS_ACCEPTANCE_V1 =
  "Elfogadom a Citoviso Általános Szerződési Feltételeit, és megismertem az " +
  "Adatkezelési tájékoztatót.";

/**
 * Version tag stamped alongside accepted legal text. Bump when the SUBSTANCE of
 * ASZF_V1 changes — a customer is bound by the version they accepted, so an
 * older order's `terms_text` must never be reinterpreted under newer wording
 * (ADR-0056: 🚪 one-way once accepted).
 */
export const ASZF_VERSION = "1.0";
/** Effective date of ASZF_VERSION, shown on the page and in the acceptance record. */
export const ASZF_EFFECTIVE_FROM = "2026-08-22";

/** One numbered chapter of a legal document. `body` entries are paragraphs. */
export interface LegalSection {
  readonly heading: string;
  readonly body: readonly string[];
}

/**
 * ÁSZF — General Terms (Eker.tv. 5. §, Ptk.). DETERMINISTIC per §H.22: this text
 * is authored, versioned and stamped; it is never AI-generated or AI-translated.
 * Another language means another country's LEGAL PACK, not a translation pass.
 *
 * The provider's identity is deliberately absent here — it is rendered from
 * `config.legalEntity` so the registry facts live in the prod .env, not in git.
 *
 * ⚠️ NOT LAWYER-REVIEWED. Covers the statutory duties and encodes the owner's
 * business decisions (ADR-0056 §"üzleti gerinc"); review is required before the
 * first live sale, especially §8 (liability) and §9 (domain transfer).
 */
export const ASZF_V1: readonly LegalSection[] = [
  {
    heading: "1. A szerződés tárgya", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Szolgáltató a Megrendelő vállalkozása számára honlapot állít elő és üzemeltet " +
        "előfizetéses formában, a Megrendelő által megadott és jóváhagyott adatok alapján. " +
        "A szolgáltatás magában foglalja a honlap tárhelyét, a megjelenített tartalom " +
        "szerkeszthetőségét egy önkiszolgáló felületen, valamint a megrendelt kiegészítő " +
        "modulokat.",
      "A szerződés a Megrendelő megrendelésének Szolgáltató általi visszaigazolásával és a " +
        "díj megfizetésével jön létre. A megrendeléskor bemutatott mintaoldal (látványterv) " +
        "és az éles honlap ugyanabból a rendszerből készül: a Megrendelő azt kapja, amit a " +
        "mintán látott.",
    ],
  },
  {
    heading: "2. Díjak és fizetés", // i18n-exempt: legal pack (§H.22)
    body: [
      "A díjakat a megrendelés pillanatában érvényes, a megrendelői felületen feltüntetett " +
        "árak határozzák meg. Az ár tartalmazza az alapcsomag havi díját és a megrendelt " +
        "modulok díját. Éves előrefizetés esetén a Szolgáltató kedvezményt ad, amelynek " +
        "mértékét a megrendelői felület a megrendelés előtt feltünteti.",
      "A Szolgáltató a díjról a jogszabályoknak megfelelő számlát állít ki elektronikus " +
        "úton, amelyet a Megrendelő elfogad.",
      "A Szolgáltató az árait a jövőre nézve módosíthatja; a módosítás a már kifizetett " +
        "időszakot nem érinti, és arról a Szolgáltató a megújulás előtt legalább 15 nappal " +
        "értesítést küld.",
    ],
  },
  {
    heading: "3. Az előfizetés időtartama, megújulás és értesítés", // i18n-exempt: legal pack (§H.22)
    body: [
      "Az előfizetés a megrendelt időszakra (havi vagy éves) szól. A Szolgáltató az " +
        "előfizetés lejárata előtt legalább 15 nappal automatikus értesítést küld a " +
        "Megrendelő megadott e-mail címére arról, hogy az előfizetés lejár, és hogy " +
        "hosszabbítás hiányában a honlapot a lejáratot követően lekapcsolja.",
      "Hosszabbítás hiányában a Szolgáltató a honlapot a lejáratot követően elérhetetlenné " +
        "teszi. Ez nem jelenti a Megrendelő tartalmának azonnali törlését: a Megrendelő a " +
        "lejáratot követő 90 napon belül kérheti az általa feltöltött tartalom (szövegek, " +
        "fényképek) kiadását.",
    ],
  },
  {
    heading: "4. Felmondás", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Megrendelő az előfizetést bármikor felmondhatja. A felmondás a már kifizetett " +
        "időszak végén lép hatályba: a Szolgáltató a honlapot a kifizetett időszak végéig " +
        "változatlanul üzemelteti.",
      "A már megfizetett díj a kifizetett időszakra nem jár vissza, tekintettel arra, hogy " +
        "a Szolgáltató a szolgáltatást erre az időszakra folyamatosan nyújtja. Ez a " +
        "rendelkezés nem érinti a fogyasztónak minősülő Megrendelő elállási jogát (5. pont).",
      "A Szolgáltató a szerződést felmondhatja, ha a Megrendelő a díjfizetéssel 30 napot " +
        "meghaladó késedelembe esik, vagy a honlapon jogszabályba ütköző, illetve harmadik " +
        "személy jogát sértő tartalmat helyez el és azt felszólításra sem távolítja el.",
    ],
  },
  {
    heading: "5. Elállási jog (fogyasztóra vonatkozó rendelkezés)", // i18n-exempt: legal pack (§H.22)
    body: [
      "Ha a Megrendelő fogyasztónak minősül (a szakmája, önálló foglalkozása vagy üzleti " +
        "tevékenysége körén kívül jár el), a 45/2014. (II. 26.) Korm. rendelet alapján a " +
        "szerződéskötéstől számított 14 napon belül indokolás nélkül elállhat a szerződéstől. " +
        "Az elállási jog gyakorlásának módjáról és a mintanyilatkozatról az Elállási " +
        "tájékoztató rendelkezik, amely a jelen ÁSZF elválaszthatatlan része.",
      "A Szolgáltató a szolgáltatás teljesítését — a honlap elkészítését és élesítését — a " +
        "fizetést követően azonnal megkezdi. Ehhez a fogyasztó kifejezett, előzetes " +
        "hozzájárulása szükséges, amelyet a megrendelés során ad meg. A fogyasztó tudomásul " +
        "veszi, hogy a szolgáltatás egészének teljesítését követően a 29. § (1) bekezdés a) " +
        "pontja alapján az elállási jogát elveszíti.",
      "Vállalkozásként eljáró Megrendelőt elállási jog nem illeti meg.",
    ],
  },
  {
    heading: "6. A Megrendelő kötelezettségei és a tartalom", // i18n-exempt: legal pack (§H.22)
    body: [
      "A honlapon megjelenő adatok és fényképek valóságtartalmáért, valamint a fényképek " +
        "felhasználási jogáért a Megrendelő felel. A Megrendelő a megrendeléskor " +
        "nyilatkozik arról, hogy a megjelenítendő fényképek tekintetében felhasználási " +
        "joggal rendelkezik, és a Szolgáltatót az ebből eredő igények alól mentesíti.",
      "A Megrendelő köteles a honlapon feltüntetni a saját tevékenységére vonatkozó, " +
        "jogszabály által előírt tájékoztatásokat. A Szolgáltató ehhez felületet biztosít, " +
        "de e tájékoztatások tartalmáért a Megrendelő felel.",
    ],
  },
  {
    heading: "7. Szerzői jogok", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Megrendelő által készített vagy feltöltött tartalom (szövegek, fényképek) a " +
        "Megrendelő tulajdonában marad. A Megrendelő ezek felhasználására a szolgáltatás " +
        "nyújtásához szükséges mértékű, a szerződés időtartamára szóló engedélyt ad a " +
        "Szolgáltatónak.",
      "A honlap sablonja, dizájn-rendszere, forráskódja és az azt előállító rendszer a " +
        "Szolgáltató szellemi tulajdona. A Megrendelő ezekre az előfizetés időtartamára " +
        "szóló, nem kizárólagos, át nem ruházható felhasználási jogot szerez. A sablon és a " +
        "rendszer nem kizárólagos: a Szolgáltató azt más megrendelői számára is felhasználja.",
    ],
  },
  {
    heading: "8. Felelősség", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Szolgáltató a honlap folyamatos elérhetőségére törekszik, de a szolgáltatás " +
        "természetéből adódóan (harmadik felek infrastruktúrája, karbantartás) a " +
        "megszakításmentes üzemet nem szavatolja.",
      "A Szolgáltató nem vállal felelősséget azért, hogy a honlap a keresőmotorokban " +
        "meghatározott helyezést ér el, illetve hogy a Megrendelő üzleti eredményt ér el. A " +
        "Szolgáltató a technikai feltételeket biztosítja, a találati helyezést a " +
        "keresőmotorok üzemeltetői határozzák meg.",
      "A Szolgáltató kártérítési felelőssége — a szándékosan okozott, valamint az emberi " +
        "életet, testi épséget vagy egészséget megkárosító szerződésszegés kivételével — a " +
        "Megrendelő által az igény keletkezését megelőző 12 hónapban ténylegesen megfizetett " +
        "díj összegére korlátozódik.",
    ],
  },
  {
    heading: "9. Egyedi domain", // i18n-exempt: legal pack (§H.22)
    body: [
      "Ha a Megrendelő egyedi domain nevet igényel a Szolgáltatón keresztül, ezzel " +
        "felhatalmazza a Szolgáltatót, hogy az általa kért domain nevet megvásárolja. A " +
        "domain a megvásárlásakor a Szolgáltató tulajdonába kerül, és a Szolgáltató azt a " +
        "Megrendelő honlapjához rendeli.",
      "A domain ellenértékét a Megrendelő a 2 éves szerződéses viszony keretében fizeti meg; " +
        "a domain ára ezért külön nem kerül kiszámlázásra.",
      "A domain tulajdonjoga a Megrendelőre az előfizetés lejártát követő 90. napon száll át, " +
        "de kizárólag akkor, ha a Megrendelő a 2 éves időszak alatt (a) az eredetileg " +
        "választott csomagjánál nem kisebb értékű csomagra fizetett elő, és (b) a díjakat " +
        "késedelem nélkül, maradéktalanul megfizette. E feltételek nemteljesülése esetén a " +
        "domain a Szolgáltató tulajdonában marad.",
      "A Szolgáltató a domaint a fenti időszak alatt a Megrendelő honlapján kívül más célra " +
        "nem használja, és harmadik személyre nem ruházza át.",
    ],
  },
  {
    heading: "10. Adatvédelem", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Szolgáltató a személyes adatokat az Adatkezelési tájékoztatóban foglaltak szerint " +
        "kezeli.",
      "A Megrendelő honlapján keresztül a Megrendelő látogatóitól (például foglalási vagy " +
        "ajánlatkérési űrlapon) érkező személyes adatok tekintetében a Megrendelő az " +
        "adatkezelő, a Szolgáltató pedig adatfeldolgozó. E viszonyra az Adatfeldolgozási " +
        "feltételek (GDPR 28. cikk) irányadók, amelyek a jelen ÁSZF elválaszthatatlan részét " +
        "képezik.",
    ],
  },
  {
    heading: "11. Az ÁSZF módosítása", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Szolgáltató a jelen ÁSZF-et módosíthatja. A módosításról a Megrendelőt a " +
        "hatálybalépés előtt legalább 15 nappal, e-mailben értesíti. A Megrendelőre az a " +
        "verzió irányadó, amelyet elfogadott, a módosítás hatálybalépéséig.",
      "Ha a Megrendelő a módosítást nem fogadja el, az előfizetést a hatálybalépés napjára " +
        "felmondhatja.",
    ],
  },
  {
    heading: "12. Jogviták", // i18n-exempt: legal pack (§H.22)
    body: [
      "A szerződésre a magyar jog irányadó. A felek a jogvitákat elsősorban egyeztetéssel " +
        "rendezik.",
      "Fogyasztónak minősülő Megrendelő panaszával a lakóhelye szerint illetékes békéltető " +
        "testülethez fordulhat. A Szolgáltató elérhetőségeit az Impresszum tartalmazza.",
    ],
  },
];

/**
 * Withdrawal notice (45/2014. Korm. r. 1-2. melléklet). MANDATORY for consumer
 * ('individual') buyers: `WITHDRAWAL_WAIVER_V1` above is only VALID if the
 * consumer received this information beforehand — the waiver does not stand on
 * its own. Under-calling this was the biggest gap found in the ADR-0056 audit.
 */
export const WITHDRAWAL_NOTICE_V1: readonly LegalSection[] = [
  {
    heading: "Kit illet meg az elállási jog?", // i18n-exempt: legal pack (§H.22)
    body: [
      "Az elállási jog a fogyasztót illeti meg, azaz azt a természetes személyt, aki a " +
        "szakmája, önálló foglalkozása vagy üzleti tevékenysége körén kívül jár el. Ha a " +
        "honlapot vállalkozása számára rendeli meg, Ön nem minősül fogyasztónak, és elállási " +
        "jog nem illeti meg.",
    ],
  },
  {
    heading: "Az elállási jog gyakorlása", // i18n-exempt: legal pack (§H.22)
    body: [
      "Ön a szerződés megkötésének napjától számított 14 napon belül jogosult indokolás " +
        "nélkül elállni a szerződéstől.",
      "Ha elállási jogával élni kíván, elállási szándékát tartalmazó egyértelmű " +
        "nyilatkozatát köteles eljuttatni a Szolgáltatóhoz az Impresszumban megadott postai " +
        "vagy e-mail címre. Ebből a célból felhasználhatja az alábbi mintanyilatkozatot is. " +
        "Ön határidőben gyakorolja elállási jogát, ha a 14 napos határidő lejárta előtt " +
        "elküldi elállási nyilatkozatát.",
    ],
  },
  {
    heading: "Az elállás joghatásai", // i18n-exempt: legal pack (§H.22)
    body: [
      "Ha Ön eláll a szerződéstől, a Szolgáltató haladéktalanul, de legkésőbb az elállásról " +
        "való tudomásszerzéstől számított 14 napon belül visszatéríti az Ön által teljesített " +
        "ellenszolgáltatást. A visszatérítés során a Szolgáltató az eredeti ügylet során " +
        "alkalmazott fizetési móddal egyező fizetési módot alkalmaz; e visszatérítési mód " +
        "alkalmazásából kifolyólag Önt semmilyen többletköltség nem terheli.",
      "Ha Ön kérte, hogy a teljesítés az elállási határidőn belül kezdődjön meg, Ön köteles " +
        "megtéríteni a Szolgáltató ésszerű költségeit, azaz az elállás közléséig arányosan " +
        "teljesített szolgáltatás ellenértékét.",
      "⚠️ Ön az elállási jogát elveszíti, ha a szolgáltatás egészét a Szolgáltató az Ön " +
        "kifejezett, előzetes hozzájárulásával teljesítette, és Ön tudomásul vette, hogy a " +
        "teljesítés megkezdését követően az elállási jogát elveszíti. A honlap élesítése " +
        "ilyen teljes teljesítésnek minősül.",
    ],
  },
  {
    heading: "Elállási mintanyilatkozat", // i18n-exempt: legal pack (§H.22)
    body: [
      "Címzett: a Szolgáltató (az Impresszumban megadott név és cím).",
      "Alulírott kijelentem, hogy gyakorlom elállási jogomat az alábbi szolgáltatás " +
        "nyújtására irányuló szerződés tekintetében: …",
      "Szerződéskötés időpontja: …",
      "A fogyasztó neve: …",
      "A fogyasztó címe: …",
      "A fogyasztó aláírása (kizárólag papíron tett nyilatkozat esetén): …",
      "Kelt: …",
    ],
  },
];

/**
 * Data-processing terms (GDPR 28. cikk) — annex to the ÁSZF. This is the one the
 * ADR-0056 audit found most often skipped: on the TENANT's site the visitor's
 * data (booking/enquiry forms) is controlled by the tenant, and WE process it.
 * Article 28 (3) requires that relationship to be in a written contract, and
 * names the eight points below as mandatory content.
 */
export const DPA_V1: readonly LegalSection[] = [
  {
    heading: "1. A felek szerepe", // i18n-exempt: legal pack (§H.22)
    body: [
      "A Megrendelő honlapján keresztül a látogatóktól érkező személyes adatok (például " +
        "foglalási vagy ajánlatkérési űrlap adatai, a látogató által beküldött vélemény) " +
        "tekintetében a Megrendelő az ADATKEZELŐ, a Szolgáltató pedig ADATFELDOLGOZÓ.",
      "A Szolgáltató ezeket az adatokat kizárólag a Megrendelő írásbeli utasítása szerint " +
        "kezeli. A jelen feltételek és az ÁSZF a Megrendelő dokumentált utasításának " +
        "minősülnek.",
    ],
  },
  {
    heading: "2. Az adatkezelés tárgya és időtartama", // i18n-exempt: legal pack (§H.22)
    body: [
      "Tárgya: a Megrendelő honlapjának üzemeltetése és a honlapon keresztül beérkező " +
        "megkeresések továbbítása, tárolása. Időtartama: a szerződés hatálya, valamint az " +
        "azt követő, az ÁSZF 3. pontja szerinti megőrzési idő.",
      "Az érintettek köre: a Megrendelő honlapjának látogatói, érdeklődői és vendégei. " +
        "A kezelt adatok típusa: a látogató által az űrlapon megadott név, elérhetőség és " +
        "üzenet, valamint a beküldés technikai adatai.",
    ],
  },
  {
    heading: "3. A Szolgáltató (adatfeldolgozó) kötelezettségei", // i18n-exempt: legal pack (§H.22)
    body: [
      "a) Az adatokat kizárólag a Megrendelő dokumentált utasítása alapján kezeli.",
      "b) Biztosítja, hogy az adatokhoz hozzáférő személyeket titoktartási kötelezettség " +
        "terheli.",
      "c) Megteszi a GDPR 32. cikke szerinti technikai és szervezési intézkedéseket " +
        "(hozzáférés-korlátozás, titkosított átvitel, mentés).",
      "d) További adatfeldolgozót csak a Megrendelő általános felhatalmazása alapján vesz " +
        "igénybe; a Megrendelő a jelen feltételek elfogadásával e felhatalmazást megadja. " +
        "A Szolgáltató a további adatfeldolgozók személyében bekövetkező változásról " +
        "előzetesen tájékoztat, és a Megrendelő ez ellen kifogással élhet.",
      "e) A Megrendelőt — a lehetőségeihez mérten — segíti az érintetti kérelmek " +
        "teljesítésében.",
      "f) Segíti a Megrendelőt az adatvédelmi incidensek kezelésében, és az incidensről a " +
        "tudomásszerzést követően indokolatlan késedelem nélkül tájékoztatja.",
      "g) A szerződés megszűnése után a Megrendelő döntése szerint törli vagy visszaadja az " +
        "adatokat, kivéve ha jogszabály a tárolást előírja.",
      "h) A Megrendelő rendelkezésére bocsátja az e kötelezettségek igazolásához szükséges " +
        "információkat, és lehetővé teszi az ellenőrzést.",
    ],
  },
  {
    heading: "4. Igénybe vett további adatfeldolgozók", // i18n-exempt: legal pack (§H.22)
    body: [
      "A szolgáltatás nyújtásához a Szolgáltató tárhely- és infrastruktúra-szolgáltatót, " +
        "e-mail-továbbító szolgáltatót, valamint fizetési és számlázási szolgáltatót vesz " +
        "igénybe. Ezek aktuális listáját és székhelyét a Szolgáltató kérésre megadja.",
      "Az adatokat a Szolgáltató az Európai Gazdasági Térségen belül tárolja.",
    ],
  },
];

/**
 * Subscriber + billing chapters of the privacy notice (GDPR 13.). These EXTEND
 * the outreach chapters already rendered by `privacyPage` rather than forming a
 * second notice: one controller with several purposes owes ONE notice, and two
 * competing privacy pages is itself a compliance defect.
 *
 * The outreach chapters cover GDPR 14. (data obtained from public sources); the
 * chapters below cover data the customer gives us directly.
 */
export const PRIVACY_CUSTOMER_V1: readonly LegalSection[] = [
  {
    heading: "Ügyfélkapcsolat és szerződés teljesítése", // i18n-exempt: legal pack (§H.22)
    body: [
      "Megrendeléskor a következő adatokat kezeljük: kapcsolattartó neve, e-mail címe és " +
        "telefonszáma, a vállalkozás neve, székhelye és adószáma, valamint a megrendelt " +
        "csomag adatai. Cél: a szerződés megkötése és teljesítése, a honlap elkészítése és " +
        "üzemeltetése, valamint a kapcsolattartás. Jogalap: a szerződés teljesítése " +
        "(GDPR 6. cikk (1) b)).",
      "Megőrzés: a szerződés megszűnését követő 5 évig (a polgári jogi elévülési idő), " +
        "kivéve a számviteli bizonylatokat, amelyekre az alábbi pont irányadó.",
    ],
  },
  {
    heading: "Számlázás és könyvelés", // i18n-exempt: legal pack (§H.22)
    body: [
      "A kiállított számlák adatait (vevő neve, címe, adószáma, a szolgáltatás megnevezése " +
        "és ellenértéke) jogi kötelezettség teljesítése érdekében kezeljük. Jogalap: " +
        "GDPR 6. cikk (1) c), a számvitelről szóló 2000. évi C. törvény 169. § (2) bekezdése " +
        "alapján. Megőrzés: a bizonylat kiállításától számított 8 év. Ezt az adatkezelést " +
        "törlési kérelemmel nem lehet megszüntetni, mert jogszabály írja elő.",
      "A számlázáshoz számlázó szolgáltatót, a fizetés lebonyolításához pedig fizetési " +
        "szolgáltatót veszünk igénybe. A bankkártya adatait NEM ismerjük meg és nem tároljuk: " +
        "azokat közvetlenül a fizetési szolgáltató kezeli a saját rendszerében.",
    ],
  },
  {
    heading: "Belépés a szerkesztő felületre", // i18n-exempt: legal pack (§H.22)
    body: [
      "A honlap szerkesztéséhez felhasználónevet és jelszót tartunk nyilván. A jelszót nem " +
        "tároljuk olvasható formában. A belépéshez technikailag szükséges sütit használunk, " +
        "amely a bejelentkezett állapot fenntartását szolgálja — ehhez az elektronikus " +
        "hírközlési szabályok szerint nem szükséges hozzájárulás, mert a szolgáltatás " +
        "nyújtásához elengedhetetlen. Elemzési vagy hirdetési célú sütit nem használunk.",
    ],
  },
  {
    heading: "A honlapján keresztül érkező adatok — ki miért felel", // i18n-exempt: legal pack (§H.22)
    body: [
      "Az Ön honlapjának látogatóitól érkező adatok (például foglalási vagy ajánlatkérési " +
        "űrlap) tekintetében ADATKEZELŐ Ön, mi pedig ADATFELDOLGOZÓ vagyunk: ezeket az " +
        "adatokat kizárólag az Ön utasítása szerint, az Ön nevében kezeljük. A részleteket " +
        "az Adatfeldolgozási feltételek (GDPR 28. cikk) tartalmazzák, amelyek az ÁSZF részét " +
        "képezik.",
    ],
  },
  {
    // Owner ruling 2026-09-01: the map renders immediately instead of behind a
    // click-to-load consent facade. That moves the disclosure here, where it belongs —
    // the visitor must be told who receives their data and when, and a grey box on the
    // page was never the right place to say it.
    heading: "Térkép a honlapján (Google Maps beágyazás)", // i18n-exempt: legal pack (§H.22)
    body: [
      "Az Ön honlapjának „Megközelítés” szakasza a szálláshely pontos helyét Google Maps " +
        "beágyazott térképen jeleníti meg, hogy a vendég megtalálja Önt. A térkép a " +
        "látogató böngészőjében az oldal megnyitásakor betöltődik.",
      "Ezzel a látogató IP-címe és böngésző-adatai a Google Ireland Limited (Gordon House, " +
        "Barrow Street, Dublin 4, Írország) felé továbbításra kerülnek, amely ezeket saját " +
        "adatkezelőként kezeli. A Google adatkezeléséről a policies.google.com/privacy " +
        "címen tájékozódhat.",
      "Az adatkezelés jogalapja a szálláshely elérhetőségének bemutatásához fűződő jogos " +
        "érdek (GDPR 6. cikk (1) f)). Ha Ön a saját honlapján nem kívánja a beágyazott " +
        "térképet használni, kérésére eltávolítjuk; a cím és az útvonaltervezési link " +
        "beágyazás nélkül is megmarad.",
    ],
  },
];

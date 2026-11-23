// HR LEGAL VARIANT — DRAFT, SWITCHED OFF (ADR-0471, status JAVASLAT; brief
// hr-jogi-csomag-tervezet-20261123.md, owner 2026-11-23 „Mehet a jogi csomag”).
//
// Today's HR pack (ADR-0458) is the HUNGARIAN legal wording translated by Bábel into Croatian; the
// statute references are deliberately NOT localised (lawyer's position 2026-11-18). That pack stays
// live and unchanged. This file is the DRAFT of a Croatian-law localisation the owner and the lawyer
// can approve:
//
//   · a VARIANT is a set of SOURCE-unit replacements: `hu` is a unit of today's pack EXACTLY as
//     legalSources("HR") enumerates it (whole sentence / whole block inner HTML with {{…}}
//     placeholders), `variant` is the Croatian-law wording of that unit — STILL IN HUNGARIAN, the
//     source language. Bábel translates the variants (never the API, never a hand-written Croatian
//     text here); the worksheet: `npx tsx scripts/legal-variant-hr-check.mts --export`;
//   · the page structure does not change: a variant replaces a unit in place, so the renderers, the
//     unit enumeration and the stamp mechanics stay as they are;
//   · ⛔ NOTHING IMPORTS THIS FILE. `enabled` is false and stays false until the approval; the guard
//     (scripts/legal-variant-hr-check.mts) proves it is disconnected, still matches today's
//     sources, and that today's HR pack is untouched. The proposed switch-on mechanism is in the ADR.
//
// Every legal statement names an official source (`sources`, URL + access date). Where the law is
// not settled for our case, the unit cites a `lawyerQuestions` id instead of deciding it.
// ⚠️ NOT LAWYER-REVIEWED. zakon.hr consolidated texts were read; zakon.hr is not the official
// gazette — the citations must be checked against narodne-novine.nn.hr before approval.
import type { LegalDoc } from "./legalPack.js";

export interface LegalSource {
  readonly title: string;
  readonly url: string;
  /** YYYY-MM-DD — when the page was read. */
  readonly accessed: string;
  /** What was actually verified there (articles seen), or what was NOT. */
  readonly note: string;
}

export interface LawyerQuestion {
  readonly id: string;
  readonly question: string;
}

export interface LegalVariantUnit {
  readonly id: string;
  readonly doc: LegalDoc;
  /** Today's source unit, exactly (the HR pack translates this today). */
  readonly hu: string;
  /** The Croatian-law wording of the unit, in Hungarian (Bábel translates it). */
  readonly variant: string;
  /** Source ids (`sources`) the variant rests on. */
  readonly basis: readonly string[];
  /** Open points the lawyer must answer before this unit may go live. */
  readonly lawyer?: readonly string[];
  /** A Hungarian-law reference that stays BY DESIGN (the provider is a Hungarian company). */
  readonly keepsHu?: string;
  /** Something that must exist in the product before the wording is true. */
  readonly prerequisite?: string;
}

export interface LegalVariant {
  readonly country: string;
  readonly variant: string;
  readonly status: "draft";
  readonly enabled: false;
  /** The Hungarian source version the variant was written against (LEGAL_PACK_BASE). */
  readonly base: string;
  readonly sources: Readonly<Record<string, LegalSource>>;
  readonly lawyerQuestions: readonly LawyerQuestion[];
  readonly units: readonly LegalVariantUnit[];
}

const ACC = "2026-11-23";

export const LEGAL_VARIANT_HR: LegalVariant = {
  country: "HR",
  variant: "HR",
  status: "draft",
  enabled: false,
  base: "aszf-1.5+tenant-1.0",
  sources: {
    zzp: {
      title: "Zakon o zaštiti potrošača (NN 19/22, 59/23, 59/26; egységes szöveg 2026-06-17-től)",
      url: "https://www.zakon.hr/z/193/",
      accessed: ACC,
      note: "olvasva: 10. (panasz, 15 napos válasz), 60. (tájékoztatás, (9) horvát nyelv), 76., 77., 79. (14 nap), 80., 81., 81.a (online elállási funkció, NN 59/26), 84. (8)–(10) (arányos díj), 86. (1) 1. és 13. pont, 102., 113. cikk",
    },
    zet: {
      title: "Zakon o elektroničkoj trgovini (NN 173/03 … 67/25)",
      url: "https://www.zakon.hr/z/199/",
      accessed: ACC,
      note: "olvasva: 4. (2) (a kéretlen levél kivétel a származási ország elve alól), 6. (1) (szolgáltatói adatok), 6. (2), 7., 8. (kéretlen kereskedelmi levél előzetes hozzájárulással), 22. cikk (piacfelügyelet)",
    },
    zek: {
      title: "Zakon o elektroničkim komunikacijama (NN 76/22, 14/24, 45/26)",
      url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2022_07_76_1116.html",
      accessed: ACC,
      note: "alapszöveg az NN-ben; egységes szöveg: https://www.zakon.hr/z/182/ — olvasva: 43. (4) (süti-hozzájárulás), 50. (1)–(4) (kéretlen elektronikus üzenet; (4): az (1)–(2) jogi személyre nem vonatkozik), 51. cikk (HAKOM / AZOP)",
    },
    zpgdpr: {
      title: "Zakon o provedbi Opće uredbe o zaštiti podataka (NN 42/18)",
      url: "https://www.zakon.hr/z/1023/",
      accessed: ACC,
      note: "olvasva: 4. (AZOP székhelye), 19. (16 éves korhatár), 34. cikk (jogsértés megállapítása iránti kérelem)",
    },
    azop: {
      title: "Agencija za zaštitu osobnih podataka — elérhetőség és panasz",
      url: "https://azop.hr/kontakt/",
      accessed: ACC,
      note: "Ulica Metela Ožegovića 16, 10000 Zagreb, azop@azop.hr; panasz: https://azop.hr/zahtjev-za-utvrdivanje-povrede-prava/",
    },
    zarps: {
      title: "Zakon o alternativnom rješavanju potrošačkih sporova (NN 121/16, 32/19)",
      url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_121_2622.html",
      accessed: ACC,
      note: "olvasva (zakon.hr/z/897): 22. cikk — a tájékoztatási kötelezettség a HORVÁT székhelyű kereskedőt köti; 27–28. cikk (a minisztérium listája); a 524/2013/EU hivatkozás elavult",
    },
    adr_list: {
      title: "Alternatív vitarendező testületek listája (gov.hr)",
      url: "https://gov.hr/hr/rjesavanje-sporova/556",
      accessed: ACC,
      note: "pl. Centar za mirenje pri HGK (Rooseveltov trg 2, Zagreb), Centar za medijaciju pri HUM, Profi Test d.o.o. „Medijator”",
    },
    odr_repeal: {
      title: "(EU) 2024/3228 rendelet — a 524/2013/EU (ODR) hatályon kívül, a platform 2025-07-20-tól megszűnt",
      url: "https://eur-lex.europa.eu/eli/reg/2024/3228/oj",
      accessed: ACC,
      note: "az EUR-Lex nem töltött be; a tartalmat a rendelet szövegét idéző hatósági források igazolták — jóváhagyás előtt az EUR-Lexen megnyitandó",
    },
    rome1: {
      title: "593/2008/EK rendelet (Róma I.), 6. cikk — fogyasztói szerződések",
      url: "https://eur-lex.europa.eu/legal-content/HU/TXT/?uri=CELEX:32008R0593",
      accessed: ACC,
      note: "az EUR-Lex nem töltött be — jóváhagyás előtt megnyitandó",
    },
    brussels1a: {
      title: "1215/2012/EU rendelet (Brüsszel Ia), 17–18. cikk — fogyasztói joghatóság",
      url: "https://eur-lex.europa.eu/legal-content/HU/TXT/?uri=CELEX:32012R1215",
      accessed: ACC,
      note: "az EUR-Lex nem töltött be — jóváhagyás előtt megnyitandó",
    },
    gdpr: {
      title: "(EU) 2016/679 rendelet (GDPR), 77. cikk — panasz a szokásos tartózkodási hely szerinti hatóságnál",
      url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
      accessed: ACC,
      note: "az EUR-Lex nem töltött be — jóváhagyás előtt megnyitandó",
    },
    zor: {
      title: "Zakon o računovodstvu (ÚJ törvény: NN 85/24, 145/24, 151/25, 59/26)",
      url: "https://www.zakon.hr/z/118/",
      accessed: ACC,
      note: "olvasva: 10. (2) — a könyvelési bizonylatok legalább 11 évig; 13. (2) — a könyvek legalább 11 évig",
    },
    dirh: {
      title: "Državni inspektorat Republike Hrvatske",
      url: "https://dirh.gov.hr",
      accessed: ACC,
      note: "Šubićeva 29, 10000 Zagreb; a fogyasztóvédelmi hatáskör a Zakon o elektroničkoj trgovini 22. cikkéből következtetve, a hatóság oldalán NEM láttuk kimondva",
    },
    zud: {
      title: "Zakon o ugostiteljskoj djelatnosti (NN 85/15 … 152/24)",
      url: "https://www.zakon.hr/z/151/",
      accessed: ACC,
      note: "olvasva: 32. (2) — a magánszállásadó a hirdetésben csak a határozat szerinti típust/kategóriát használhatja, és uniós adóalanyokkal hirdetve az adószámát / közösségi adószámát köteles feltüntetni; határozatszám vagy OIB kiírási kötelezettséget NEM találtunk; új törvény első olvasatban (2026-07) — elfogadása nem igazolt",
    },
    zpdv: {
      title: "Zakon o porezu na dodanu vrijednost (NN 73/13 … 48/26)",
      url: "https://www.zakon.hr/z/1455/",
      accessed: ACC,
      note: "olvasva: 38. (1) — 25%; 79. (7) — „prijenos porezne obveze” / „reverse charge” a számlán; a 26. cikk (elektronikus szolgáltatás teljesítési helye) szövege NEM ellenőrizve",
    },
  },
  lawyerQuestions: [
    {
      id: "q_withdrawal",
      question:
        "Előfizetéses honlap-szolgáltatásnál a horvát törvény (ZZP 86. cikk (1) 1. pont) csak a TELJESEN teljesített szolgáltatásnál zárja ki az elállást. Az élesítés teljes teljesítés-e, vagy a fogyasztó 14 napon belül elállhat, és csak az arányos díjat fizeti (84. cikk (8))? Alkalmazható-e a digitális tartalomra szóló 86. cikk (1) 13. pont egy generált honlapra? Melyik szöveg biztonságos?",
    },
    {
      id: "q_withdrawal_button",
      question:
        "A ZZP 81.a cikke (NN 59/26, 2026-06-17-től) online kötött szerződésnél kötelező „raskid ugovora” elállási funkciót ír elő (megerősítő gomb, tartós adathordozós visszaigazolás). Köti-e ez a magyar székhelyű szolgáltatót horvát fogyasztóval szemben (Róma I. 6. cikk), és ha igen, a megrendelői felület melyik pontján kell lennie?",
    },
    {
      id: "q_cold",
      question:
        "Hideg megkeresés: a horvát elektronikus hírközlési törvény 50. cikk (4) bekezdése az előzetes hozzájárulás alól CSAK a jogi személyt veszi ki; az elektronikus kereskedelmi törvény 8. cikke minden kéretlen kereskedelmi levélhez hozzájárulást kér, és a 4. cikk (2) szerint ez a magyar feladóra is vonatkozik. A magánszállásadó (iznajmljivač, paušalist) és az egyéni vállalkozó (obrt) természetes személynek számít-e itt — vagyis jogos érdekre hivatkozva írhatunk-e nekik? Mi a helyes jogalap-mondat a levélben és a megtekintő lapon?",
    },
    {
      id: "q_consumer",
      question:
        "Fogyasztónak minősül-e a horvát magánszállásadó, amikor a kiadott szálláshelyéhez rendel honlapot (ZZP: fogyasztó = üzleti tevékenységén kívül eljáró személy)? Ettől függ, hogy az elállási és panaszkezelési szabályok rá vonatkoznak-e.",
    },
    {
      id: "q_law",
      question:
        "Maradhat-e a magyar jog a szerződés irányadó joga horvát fogyasztóval szemben, ha az ÁSZF kimondja, hogy ez nem fosztja meg a horvát kógens fogyasztóvédelmi szabályoktól (Róma I. 6. cikk (2))? Kell-e a teljes ÁSZF horvát nyelven, vagy elég a ZZP 60. cikk (9) szerinti szerződéskötés előtti tájékoztatás?",
    },
    {
      id: "q_adr",
      question:
        "A horvát vitarendezési törvény 22. cikke a horvát székhelyű kereskedőt köti. Magyar székhelyű szolgáltatóként melyik vitarendező testületet kell megneveznünk horvát fogyasztónak (a magyar békéltető testületet, egy horvát testületet, pl. Centar za mirenje pri HGK, vagy egyiket sem)? Megnevezhető-e a horvát piacfelügyelet (Državni inspektorat) panaszfórumként?",
    },
    {
      id: "q_vat",
      question:
        "Adószakértői kérdés: a magyar alanyi adómentes (AAM) szolgáltató horvát magánszemélynek nyújtott elektronikus szolgáltatásánál meddig maradhat az „ÁFÁ-t nem tartalmaz — AAM” mondat, és mikortól kell 25% horvát áfát (OSS) feltüntetni? A fordított adózásos mondat mellé kell-e a „prijenos porezne obveze” kifejezés?",
    },
    {
      id: "q_tenant_imprint",
      question:
        "A szállásadó saját honlapjának impresszumában ma „Kategorizálási határozat száma” és OIB kötelező (src/legal.ts LEGAL_LOCAL.HR). A vendéglátási törvény 32. cikk (2) a kategóriát és — uniós adóalanyokkal hirdetve — az adószámot / közösségi adószámot kéri, határozatszámot nem. Mi kötelező valójában, és hoz-e kötelező nyilvántartási számot a 2026-ban tárgyalt új vendéglátási törvény?",
    },
  ],
  units: [
    {
      id: "waiver",
      doc: "withdrawal",
      hu: "Kifejezetten kérem és hozzájárulok, hogy a Citoviso a szolgáltatás teljesítését — a honlapom elkészítését és élesítését — a 14 napos elállási határidő lejárta előtt, a fizetést követően azonnal megkezdje. Tudomásul veszem, hogy a szolgáltatás egészének teljesítését követően a 45/2014. (II. 26.) Korm. rendelet 29. § (1) bekezdés a) pontja alapján az elállási, illetve felmondási jogomat elveszítem.",
      variant:
        "Kifejezetten kérem és hozzájárulok, hogy a Citoviso a szolgáltatás teljesítését — a honlapom elkészítését és élesítését — a 14 napos elállási határidő lejárta előtt, a fizetést követően azonnal megkezdje. Tudomásul veszem, hogy a horvát fogyasztóvédelmi törvény (Zakon o zaštiti potrošača) 86. cikk (1) bekezdés 1. pontja alapján a szolgáltatás egészének teljesítését követően az elállási jogomat elveszítem, és hogy ha a teljesítés megkezdése után, de az elállási határidőn belül állok el, a 84. cikk szerint az elállásig nyújtott szolgáltatás arányos díját megfizetem.",
      basis: ["zzp"],
      lawyer: ["q_withdrawal", "q_consumer"],
    },
    {
      id: "waiver_short",
      doc: "withdrawal",
      hu: "Kérem az azonnali kezdést, és tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogomat.",
      variant:
        "Kérem az azonnali kezdést, és tudomásul veszem, hogy a teljes teljesítés után elveszítem a 14 napos elállási jogomat, előtte pedig elállás esetén az addig nyújtott szolgáltatás arányos díját fizetem.",
      basis: ["zzp"],
      lawyer: ["q_withdrawal"],
    },
    {
      id: "outreach_basis",
      doc: "outreach_notice",
      hu: "Ezt az előnézetet személyre szabottan Önnek készítettük, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdekű megkeresés — Grt. 6. § / GDPR 6. cikk (1) f)).",
      variant:
        "Ezt az előnézetet személyre szabottan Önnek készítettük, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdekű megkeresés — GDPR 6. cikk (1) f) / a horvát elektronikus hírközlési törvény (Zakon o elektroničkim komunikacijama) 50. cikke).",
      basis: ["zek", "zet"],
      lawyer: ["q_cold"],
    },
    {
      id: "outreach_letter",
      doc: "outreach_notice",
      hu: "Ezt a levelet azért kapta, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdek — Grt. 6. § / GDPR 6. cikk (1) f)). Adatkezelési tájékoztató:",
      variant:
        "Ezt a levelet azért kapta, mert vállalkozása nyilvánosan elérhető adatai alapján úgy láttuk, a szolgáltatásunk hasznos lehet Önnek (jogos érdek — GDPR 6. cikk (1) f) / a horvát elektronikus hírközlési törvény (Zakon o elektroničkim komunikacijama) 50. cikke). Adatkezelési tájékoztató:",
      basis: ["zek", "zet"],
      lawyer: ["q_cold"],
    },
    {
      id: "aszf_withdrawal",
      doc: "aszf",
      hu: "Ha a Megrendelő fogyasztónak minősül (a szakmája, önálló foglalkozása vagy üzleti tevékenysége körén kívül jár el), a 45/2014. (II. 26.) Korm. rendelet alapján a szerződéskötéstől számított 14 napon belül indokolás nélkül elállhat a szerződéstől. Az elállási jog gyakorlásának módjáról és a mintanyilatkozatról az Elállási tájékoztató rendelkezik, amely a jelen ÁSZF elválaszthatatlan része.",
      variant:
        "Ha a Megrendelő fogyasztónak minősül (a szakmája, önálló foglalkozása vagy üzleti tevékenysége körén kívül jár el), a horvát fogyasztóvédelmi törvény (Zakon o zaštiti potrošača, NN 19/22, 59/23, 59/26) 79. cikke alapján a szerződéskötéstől számított 14 napon belül indokolás nélkül elállhat a szerződéstől. Az elállási jog gyakorlásának módjáról és a mintanyilatkozatról az Elállási tájékoztató rendelkezik, amely a jelen ÁSZF elválaszthatatlan része.",
      basis: ["zzp", "rome1"],
      lawyer: ["q_consumer", "q_law"],
    },
    {
      id: "aszf_early_start",
      doc: "aszf",
      hu: "A Szolgáltató a szolgáltatás teljesítését — a honlap elkészítését és élesítését — a fizetést követően azonnal megkezdi. Ehhez a fogyasztó kifejezett, előzetes hozzájárulása szükséges, amelyet a megrendelés során ad meg. A fogyasztó tudomásul veszi, hogy a szolgáltatás egészének teljesítését követően a 29. § (1) bekezdés a) pontja alapján az elállási jogát elveszíti.",
      variant:
        "A Szolgáltató a szolgáltatás teljesítését — a honlap elkészítését és élesítését — a fizetést követően azonnal megkezdi. Ehhez a fogyasztó kifejezett, előzetes hozzájárulása szükséges, amelyet a megrendelés során ad meg. A fogyasztó tudomásul veszi, hogy a szolgáltatás egészének teljesítését követően a 86. cikk (1) bekezdés 1. pontja alapján az elállási jogát elveszíti, és hogy ha a teljesítés megkezdése után, az elállási határidőn belül áll el, a 84. cikk szerint az elállásig nyújtott szolgáltatás arányos díját fizeti meg.",
      basis: ["zzp"],
      lawyer: ["q_withdrawal"],
    },
    {
      id: "aszf_law",
      doc: "aszf",
      hu: "A szerződésre a magyar jog irányadó. A felek a jogvitákat elsősorban egyeztetéssel rendezik.",
      variant:
        "A szerződésre a magyar jog irányadó; fogyasztónak minősülő Megrendelőt ez a jogválasztás nem fosztja meg a szokásos tartózkodási helye szerinti horvát jog kógens fogyasztóvédelmi rendelkezéseinek védelmétől (593/2008/EK rendelet, 6. cikk). A felek a jogvitákat elsősorban egyeztetéssel rendezik.",
      basis: ["rome1"],
      lawyer: ["q_law"],
      keepsHu: "a szolgáltató magyar cég, a szerződés irányadó joga magyar marad; a fogyasztót a Róma I. 6. cikk védi",
    },
    {
      id: "aszf_disputes",
      doc: "aszf",
      hu: "Fogyasztónak minősülő Megrendelő panaszával a lakóhelye szerint illetékes békéltető testülethez fordulhat. A Szolgáltató elérhetőségeit az Impresszum tartalmazza.",
      variant:
        "A Szolgáltató a fogyasztónak minősülő Megrendelő írásbeli panaszát postán és e-mailben is fogadja, átvételét haladéktalanul visszaigazolja, és arra 15 napon belül írásban válaszol. A fogyasztó a lakóhelye szerinti bíróság előtt is eljárást indíthat (1215/2012/EU rendelet, 18. cikk). Az Európai Unió online vitarendezési platformja 2025. július 20-án megszűnt. A Szolgáltató elérhetőségeit az Impresszum tartalmazza.",
      basis: ["zzp", "brussels1a", "odr_repeal", "zarps"],
      lawyer: ["q_adr"],
    },
    {
      id: "withdrawal_intro",
      doc: "withdrawal",
      hu: 'Az alábbi tájékoztató a fogyasztó és a vállalkozás közötti szerződések részletes szabályairól szóló 45/2014. (II. 26.) Korm. rendelet szerinti kötelező tájékoztatás. A Szolgáltató adatait az <a href="/impresszum">Impresszum</a> tartalmazza.',
      variant:
        'Az alábbi tájékoztató a távollévők között kötött szerződésekre a horvát fogyasztóvédelmi törvény (Zakon o zaštiti potrošača, NN 19/22, 59/23, 59/26) 60. cikke szerinti kötelező tájékoztatás. A Szolgáltató adatait az <a href="/impresszum">Impresszum</a> tartalmazza.',
      basis: ["zzp"],
      lawyer: ["q_law"],
    },
    {
      id: "withdrawal_how",
      doc: "withdrawal",
      hu: "Ha elállási jogával élni kíván, elállási szándékát tartalmazó egyértelmű nyilatkozatát köteles eljuttatni a Szolgáltatóhoz az Impresszumban megadott postai vagy e-mail címre. Ebből a célból felhasználhatja az alábbi mintanyilatkozatot is. Ön határidőben gyakorolja elállási jogát, ha a 14 napos határidő lejárta előtt elküldi elállási nyilatkozatát.",
      variant:
        "Ha elállási jogával élni kíván, elállási szándékát tartalmazó egyértelmű nyilatkozatát eljuttathatja a Szolgáltatóhoz az Impresszumban megadott postai vagy e-mail címre, vagy a megrendelői felület elállási funkciójával, amelynek használatáról a Szolgáltató tartós adathordozón, időponttal ellátott visszaigazolást küld. Ebből a célból felhasználhatja az alábbi mintanyilatkozatot is. Ön határidőben gyakorolja elállási jogát, ha a 14 napos határidő lejárta előtt elküldi elállási nyilatkozatát.",
      basis: ["zzp"],
      lawyer: ["q_withdrawal_button"],
      prerequisite: "a megrendelői felület elállási funkciója (ZZP 81.a cikk) — ma NINCS; amíg nincs, a mondat nem igaz",
    },
    {
      id: "withdrawal_loss",
      doc: "withdrawal",
      hu: "⚠️ Ön az elállási jogát elveszíti, ha a szolgáltatás egészét a Szolgáltató az Ön kifejezett, előzetes hozzájárulásával teljesítette, és Ön tudomásul vette, hogy a teljesítés megkezdését követően az elállási jogát elveszíti. A honlap élesítése ilyen teljes teljesítésnek minősül.",
      variant:
        "⚠️ Ön az elállási jogát elveszíti, ha a szolgáltatás egészét a Szolgáltató az Ön kifejezett, előzetes hozzájárulásával teljesítette, és Ön tudomásul vette, hogy a teljes teljesítést követően az elállási jogát elveszíti. Ha a teljesítés megkezdése után, de az elállási határidőn belül áll el, az elállás közléséig nyújtott szolgáltatás arányos díját kell megfizetnie.",
      basis: ["zzp"],
      lawyer: ["q_withdrawal"],
    },
    {
      id: "own_imprint_intro",
      doc: "own_imprint",
      hu: "A Citoviso szolgáltatás üzemeltetője és a jelen honlap tartalmáért felelős szolgáltató — az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a szerinti adatok:",
      variant:
        "A Citoviso szolgáltatás üzemeltetője és a jelen honlap tartalmáért felelős szolgáltató — az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a és a horvát elektronikus kereskedelmi törvény (Zakon o elektroničkoj trgovini) 6. cikke szerinti adatok:",
      basis: ["zet"],
      keepsHu: "a szolgáltató székhelye Magyarország — a magyar e-kereskedelmi törvény a származási ország joga, a horvát 6. cikk mellette áll",
    },
    {
      id: "own_imprint_authority",
      doc: "own_imprint",
      hu: "<b>Felügyeleti szerv:</b> a szolgáltatási tevékenység felügyeletét a székhely szerint illetékes kormányhivatal látja el. Fogyasztóvédelmi panasz esetén a lakóhely szerint illetékes békéltető testület jár el.",
      variant:
        "<b>Felügyeleti szerv:</b> a szolgáltatási tevékenység felügyeletét a Szolgáltató magyarországi székhelye szerint illetékes kormányhivatal látja el. Horvátországi lakóhelyű fogyasztó a horvát Állami Felügyelőséghez (Državni inspektorat Republike Hrvatske, Šubićeva 29, 10000 Zagreb, dirh.gov.hr) is fordulhat.",
      basis: ["dirh", "zet"],
      lawyer: ["q_adr"],
      keepsHu: "a magyar felügyeleti szerv a szolgáltató székhelye miatt marad",
    },
    {
      id: "privacy_basis",
      doc: "privacy_customer",
      hu: "<b>3. Cél és jogalap.</b> Cél: személyre szabott üzleti ajánlat (honlap-látványterv) készítése és bemutatása, valamint az érdeklődés mérése az ajánlat igényekhez igazításához. Jogalap: <b>jogos érdek</b> (GDPR 6. cikk (1) f) — üzleti kapcsolat kezdeményezése vállalkozásokkal; Grt. 6. §). Az adatok kizárólag e célra szolgálnak, harmadik félnek nem adjuk át.",
      variant:
        "<b>3. Cél és jogalap.</b> Cél: személyre szabott üzleti ajánlat (honlap-látványterv) készítése és bemutatása, valamint az érdeklődés mérése az ajánlat igényekhez igazításához. Jogalap: <b>jogos érdek</b> (GDPR 6. cikk (1) f) — üzleti kapcsolat kezdeményezése vállalkozásokkal; a horvát elektronikus hírközlési törvény (Zakon o elektroničkim komunikacijama) 50. cikke). Az adatok kizárólag e célra szolgálnak, harmadik félnek nem adjuk át.",
      basis: ["zek", "zet"],
      lawyer: ["q_cold"],
    },
    {
      id: "privacy_rights",
      doc: "privacy_customer",
      hu: "<b>5. Az Ön jogai.</b> Kérheti a hozzáférést, helyesbítést, törlést, az adatkezelés korlátozását, és <b>tiltakozhat</b> a jogos érdeken alapuló adatkezelés ellen — a fenti elérhetőségeken, vagy egy kattintással a levélben található leiratkozó-linken. Panaszt tehet a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH — naih.hu, 1055 Budapest, Falk Miksa u. 9–11.).",
      variant:
        "<b>5. Az Ön jogai.</b> Kérheti a hozzáférést, helyesbítést, törlést, az adatkezelés korlátozását, és <b>tiltakozhat</b> a jogos érdeken alapuló adatkezelés ellen — a fenti elérhetőségeken, vagy egy kattintással a levélben található leiratkozó-linken. Panaszt tehet a szokásos tartózkodási helye szerinti horvát adatvédelmi hatóságnál (Agencija za zaštitu osobnih podataka — AZOP, Ulica Metela Ožegovića 16, 10000 Zagreb, azop.hr), vagy az adatkezelő székhelye szerinti magyar hatóságnál (NAIH — naih.hu, 1055 Budapest, Falk Miksa u. 9–11.) (GDPR 77. cikk).",
      basis: ["azop", "zpgdpr", "gdpr"],
      keepsHu: "az adatkezelő (Citoviso) magyar — a NAIH a székhely szerinti hatóság, a horvát érintett az AZOP-hoz is fordulhat",
    },
    {
      id: "tenant_imprint_lead",
      doc: "tenant_imprint",
      hu: "Az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a szerint",
      variant: "A horvát elektronikus kereskedelmi törvény (Zakon o elektroničkoj trgovini) 6. cikke szerint",
      basis: ["zet"],
      lawyer: ["q_tenant_imprint"],
    },
    {
      id: "tenant_privacy_retention",
      doc: "tenant_privacy",
      hu: "12 hónap; ha foglalás lesz belőle, a számviteli bizonylatokat 8 évig (2000. évi C. törvény 169. §)",
      variant: "12 hónap; ha foglalás lesz belőle, a számviteli bizonylatokat legalább 11 évig (Zakon o računovodstvu, NN 85/24, 10. cikk)",
      basis: ["zor"],
    },
    {
      id: "tenant_privacy_authority",
      doc: "tenant_privacy",
      hu: "Kérését a fenti elérhetőségeken jelezheti; legkésőbb 30 napon belül válaszolunk. Panasszal a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhat (1055 Budapest, Falk Miksa utca 9-11., ugyfelszolgalat@naih.hu, naih.hu), illetve bírósághoz.",
      variant:
        "Kérését a fenti elérhetőségeken jelezheti; legkésőbb 30 napon belül válaszolunk. Panasszal a horvát adatvédelmi hatósághoz (Agencija za zaštitu osobnih podataka — AZOP, Ulica Metela Ožegovića 16, 10000 Zagreb, azop@azop.hr, azop.hr) fordulhat, illetve bírósághoz.",
      basis: ["azop", "zpgdpr"],
    },
  ],
};

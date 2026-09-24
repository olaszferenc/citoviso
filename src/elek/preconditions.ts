// A LÁNC ELŐFELTÉTELEI — adatként, hogy a szűkített futás ELŐRE tudjon szólni.
//
// ⛔ A MÉRT LELET (2026-09-15, kétszer egy napon). `run-all.mts FK-006a FK-006b`
// futtatva a `wanted()` szűrő kihagyta az FK-005a-t (`:140`), majd tizennégy sorral
// lejjebb a futó MEGKÖVETELTE annak termékét (`⛔ nincs ELEK-TESZT tenant`) és
// kilépett — miután a lead-seedet és a link-visszaállítást már végrehajtotta. Ugyanez
// futott ki az orchestrator-szálon is FK-001-gyel. A futó SAJÁT fejléce közben azt
// ígérte: „csak néhány kör (a park előáll hozzá)". Nem állt elő.
//
// A hibaosztály nem a hiányzó tenant: az a KÉSLELTETETT TÜNET. A hiba az, hogy a
// futás elindult úgy, hogy már az első sorban eldönthető volt, hogy nem érhet célba.
//
// ⛔ MIÉRT NEM AZ `${ELEK_*}` HIVATKOZÁSOKBÓL VEZETEM LE (megmértem, mielőtt megírtam).
// Kézenfekvő lett volna a forgatókönyvek env-behelyettesítéseit grepelni — és NÉMÁN
// HIÁNYOS táblát adott volna: az FK-006a, az FK-006b és az FK-007 EGYETLEN `${ELEK_*}`-ot
// sem tartalmaz, mégis mindhárom az ELEK-tenantra mér (az időutazó azt a bérlőt lépteti,
// a foglalás-seed annak a site-jaira ír). Egy szerkezetinek látszó levezetés, ami a
// bejelentett esetet pont nem fogja meg, rosszabb a nyílt táblánál: úgy néz ki, mintha
// nem lehetne elavulni. Ezért a lánc ITT áll, kimondva — és a `scripts/elek-precondition-check.mts`
// őrzi, hogy a futó ne tudjon olyan kört indítani, ami ebből a táblából hiányzik.

/** Amit a park TUD, és amit egy kör MEGKÖVETEL. Mérhető tény, nem szándék. */
export type ParkFact = "trackedLink" | "elekTenant";

export interface FactSpec {
  /** Ahogy a futás kiírja — emberi név, nem mezőnév. */
  readonly label: string;
  /** Az a kör, ami HIDEG parkban előállítja. */
  readonly producer: string;
  /** Mit ad a láncnak — ez a mondat teszi megérthetővé, miért kell. */
  readonly produces: string;
}

export const FACTS: Readonly<Record<ParkFact, FactSpec>> = {
  trackedLink: {
    label: "követett link az ELEK-leadhez",
    producer: "FK-004",
    produces: "a kiküldött megkeresés tokenje → ELEK_PROSPECT_PATH",
  },
  elekTenant: {
    label: "ELEK-TESZT tenant",
    producer: "FK-005a",
    produces: "a vásárlásból született bérlő + site → ELEK_TENANT_USER/PASSWORD",
  },
};

export interface ChainRound {
  readonly fk: string;
  /** Amit a kör megkövetel — a futó LÁNC-POZÍCIÓJÁBÓL, nem szövegkeresésből. */
  readonly needs: readonly ParkFact[];
}

/**
 * A lánc, abban a sorrendben, ahogy a `run-all.mts` végigmegy rajta. A sorrend NEM
 * kozmetika: az FK-006a fagyasztott oldalt állít, az FK-006b visszaolvadtat — a
 * másik sorrendben a termék hibátlan, a mérés mégis piros.
 */
export const CHAIN: readonly ChainRound[] = [
  { fk: "FK-000", needs: [] },
  { fk: "FK-003", needs: [] },
  { fk: "FK-003b", needs: [] },
  { fk: "FK-004", needs: [] },
  { fk: "FK-004b", needs: ["trackedLink"] },
  // A mock a VENDÉG szemével — a vásárlás ELŐTT, mert a vétel után a lap már
  // „Ez az oldal már az Öné"-t mond, és a minta-űrlapok helyett a tulaj-utat méri.
  { fk: "FK-008b", needs: ["trackedLink"] },
  { fk: "FK-005a", needs: ["trackedLink"] },
  { fk: "FK-001", needs: ["elekTenant"] },
  { fk: "FK-002", needs: ["elekTenant"] },
  { fk: "FK-005b", needs: ["elekTenant"] },
  // A foglalás-seed az ELEK-tenant site-jaira ír, ezért a kör a tenanttól függ,
  // hiába nem hivatkozik egyetlen ELEK_* változóra sem.
  { fk: "FK-007", needs: ["elekTenant"] },
  // A vendég-út (FK-008) az ELEK-tenant élő oldalán jár, saját seeddel az FK-007 után.
  { fk: "FK-008", needs: ["elekTenant"] },
  // A dunning-létra és a visszaolvasztás az ELEK-bérlő előfizetés-óráját lépteti.
  { fk: "FK-006a", needs: ["elekTenant"] },
  { fk: "FK-006b", needs: ["elekTenant"] },
];

/** Amit a parkról MÉRTÜNK (nem amit feltételezünk róla). */
export type ParkFacts = Readonly<Record<ParkFact, boolean>>;

export interface Problem {
  readonly fact: ParkFact;
  /** A kért körök, amelyek ezen a tényen állnak — mind megnevezve. */
  readonly blockedFks: readonly string[];
  readonly reason: "missing" | "outOfOrder";
}

export interface Plan {
  /** A kért körök a lánc sorrendjében (ismeretlen nevek nélkül). */
  readonly rounds: readonly string[];
  /** Amit a szűkítés kihagy — és amit az a kör előállítana. */
  readonly skipped: readonly { readonly fk: string; readonly produces: string | null }[];
  /** Ismeretlen FK-név az argumentumban — elgépelés némán nulla kört futtatna. */
  readonly unknown: readonly string[];
  readonly problems: readonly Problem[];
}

/**
 * Mit lehet ELŐRE tudni erről a futásról.
 *
 * A szabály egyszerű, és pont ezért nem lehet félreérteni: egy kért kör előfeltétele
 * akkor rendben van, ha a park MÁR TUDJA a tényt, VAGY ha az azt előállító kör is a
 * kért körök közt van — ÉS a láncban előrébb áll.
 *
 * @param requested üres tömb = teljes mátrix (a lánc mindent előállít magának)
 */
export function planRun(requested: readonly string[], facts: ParkFacts): Plan {
  const index = new Map(CHAIN.map((r, i) => [r.fk, i]));
  const known = requested.filter((fk) => index.has(fk));
  const unknown = requested.filter((fk) => !index.has(fk));
  const full = requested.length === 0;
  const selected = full ? CHAIN.map((r) => r.fk) : known;
  const selectedSet = new Set(selected);

  const problems: Problem[] = [];
  for (const fact of Object.keys(FACTS) as ParkFact[]) {
    const blocked = selected.filter((fk) => CHAIN[index.get(fk)!]!.needs.includes(fact));
    if (!blocked.length) continue;
    if (facts[fact]) continue; // a park már tudja — bárki állította elő
    const producer = FACTS[fact].producer;
    if (!selectedSet.has(producer)) {
      problems.push({ fact, blockedFks: blocked, reason: "missing" });
      continue;
    }
    // A termelő kért, de a láncban HÁTRÉBB van, mint az első fogyasztója: akkor a
    // futás sorrendben sem tudja előállítani. (Ma nem fordulhat elő, de a szabály
    // legyen kimondva, ne a tábla véletlen sorrendje tartsa.)
    const producerAt = index.get(producer)!;
    if (blocked.some((fk) => index.get(fk)! < producerAt))
      problems.push({ fact, blockedFks: blocked, reason: "outOfOrder" });
  }

  return {
    rounds: CHAIN.filter((r) => selectedSet.has(r.fk)).map((r) => r.fk),
    skipped: full
      ? []
      : CHAIN.filter((r) => !selectedSet.has(r.fk)).map((r) => ({
          fk: r.fk,
          produces:
            (Object.entries(FACTS).find(([, s]) => s.producer === r.fk)?.[1] as FactSpec | undefined)?.produces ?? null,
        })),
    unknown,
    problems,
  };
}

/** Az a parancs, ami a hiányt orvosolja — a termelő körökkel kiegészített kérés. */
export function fixCommand(requested: readonly string[], problems: readonly Problem[]): string {
  const index = new Map(CHAIN.map((r, i) => [r.fk, i]));
  const add = problems.map((p) => FACTS[p.fact].producer);
  const all = [...new Set([...requested, ...add])]
    .filter((fk) => index.has(fk))
    .sort((a, b) => index.get(a)! - index.get(b)!);
  return `npx tsx elek/bin/run-all.mts ${all.join(" ")}`;
}

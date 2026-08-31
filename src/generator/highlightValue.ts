// GUEST-VALUE filter for AI highlights (owner ruling 2026-08-24).
//
// WHY: the vision brief describes what it SEES, and a photo mostly shows surfaces —
// so the mock shipped highlights like "Napsütötte sárga homlokzat", "Bézs csempés
// fürdőszoba üvegkabinos zuhannyal", "Világos szobák kék-zöld ágyneművel és laminált
// padlóval". The owner's verdict: "Mi a fasz? Ez kit érdekel? Hát ez hülyeség!" — and
// he is right: nobody picks a guesthouse for its floor laminate. A highlight has to
// name something the GUEST gets or uses; anything else is filler that cheapens the
// whole page.
//
// The prompt now says this too, but a prompt is statistical and a filter is not, so
// the rule is enforced here as well (the "guard must measure what matters" doctrine).
//
// CONSERVATIVE BY DESIGN: an item is dropped ONLY when it names no guest value AND
// does read like a surface/decor description. A highlight we cannot classify is kept —
// dropping a real amenity would cost more than keeping a mediocre line.

/** Things a guest actually chooses for. Substring match, lowercase, accent-exact. */
const VALUE = [
  "medence", "medencé", "jacuzzi", "szauna", "wellness", "pezsgőfürdő",
  "parkol", "garázs", "strand", "vízpart", "tópart", "móló", "csónak", "hajó", "horgász",
  "wifi", "internet", "klíma", "légkondicion", "fűt",
  "reggeli", "étterem", "étterm", "büfé", "konyha", "grill", "bogrács", "kemence", "tűzrakó",
  "kert", "terasz", "terassz", "erkély", "erkélly", "udvar", "panoráma", "kilátás", "kilátó",
  "játszótér", "játszó", "gyerek", "családbarát", "kisállat", "kutyabarát",
  "kerékpár", "bicikli", "túra", "síterep", "sípálya",
  "pince", "borkóstol", "élő zene", "rendezvény", "konferencia",
  "recepció", "lift", "akadálymentes", "mosógép", "mosoda",
  "szabad strand", "közel", "percre", "méterre", "km-re",
];

/** Surface / decor / material vocabulary — the tell of a photo DESCRIPTION. */
const SURFACE = [
  "csempé", "csempe", "burkolat", "padló", "parketta", "laminált", "szőnyeg",
  "homlokzat", "fal ", "falak", "falú", "falfest", "festett", "tapéta", "vakolat",
  "ágynemű", "ágytakaró", "függöny", "párna", "lepedő",
  "színű", "színek", "sárga", "kék-", "zöld-", "fehér csempés", "bézs", "barna csempés",
  "díszít", "dekor", "keretezett", "mintás", "csíkos", "virágmintás",
  "bejárat", "ablakkeret", "ajtó", "korlát", "lépcsőház",
];

/**
 * BUILDING MATERIALS AND CONSTRUCTION DETAIL — what the property is MADE OF.
 *
 * Nobody searching for a place to stay types "pine-beamed". The owner's ruling
 * (2026-08-31), after "Kert, grill és bérelhető kerékpárok a FENYŐGERENDÁS TETŐTÉR
 * ALATT" shipped: "Miért nem írjuk bele, hogy XC30/37 betonból, harminchatos
 * betonszivattyúval pumpálva?" — the construction of the building is exactly as
 * irrelevant to a guest as the concrete grade.
 *
 * Separate from SURFACE (decor/finish) because the rule differs: a highlight is only
 * dropped when it names no guest value AT ALL, but the HERO HEADLINE may not carry a
 * material even alongside real selling points — the headline has one line to work with,
 * and a construction detail spends it on nothing.
 */
export const MATERIAL_WORDS: readonly string[] = [
  "gerendá", "gerenda", "fagerend", "fenyőgerend", "lambéri", "faburkolat", "faborítás",
  "fából", "fából ácsolt", "ácsolt", "deszká", "zsindely", "nádfedel", "nádtető",
  "tetőtér", "tetőteres", "padlástér", "vályog", "tégla", "beton", "vasbeton",
  "kőfal", "terméskő", "cserép", "válaszfal", "födém", "szigetel",
];

function has(hay: string, needles: readonly string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

/**
 * True when the line reads as a surface/decor description with no guest value in it.
 * Exported for the gate, which drives it with the REAL lines that shipped.
 */
export function isDecorFiller(line: string): boolean {
  const s = line.toLowerCase();
  if (has(s, VALUE)) return false; // names something the guest gets → keep
  return has(s, SURFACE);
}


/**
 * Visual adjectives that may LEAD a highlight ("Kék csempés kültéri medence…").
 * The value is the noun behind them; the colour of the tiles is not why anyone books.
 */
const LEADING_ADJ = [
  "kék", "zöld", "sárga", "fehér", "fekete", "barna", "bézs", "szürke", "piros",
  "rózsaszín", "narancssárga", "vajszínű", "krémszínű", "pasztell",
  "világos", "sötét", "napsütötte", "napfényes", "napsütött",
  "csempés", "csempézett", "burkolt", "festett", "faburkolatú", "kőburkolatú",
  "cserepes", "cseréptetős", "fás", "lombos", "virágos", "muskátlis", "díszes",
  "árkádos", "boltíves", "íves",
];

/**
 * Trim the decorative lead-in so the VALUE starts the line (owner 2026-08-24: the
 * filter kept "Kék csempés kültéri medence…" because a pool IS value — but the guest
 * still does not care what colour the tiles are). Only a LEADING adjective is cut,
 * never a word in the middle, so the sentence cannot lose its meaning. At most three,
 * and never the whole line.
 */
export function trimDecorLead(line: string): string {
  let s = line.trim();
  for (let i = 0; i < 3; i++) {
    const m = /^([\p{L}]+)(,)?\s+(.+)$/u.exec(s);
    if (!m) break;
    const first = m[1]!.toLowerCase();
    const rest = m[3]!.trim();
    // Keep at least two words of substance, and only cut a known decor adjective.
    if (!LEADING_ADJ.includes(first) || rest.split(/\s+/).length < 2) break;
    s = rest;
  }
  return s === line.trim() ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Trim a decorative TAIL: "Emeleti terasz színes napernyőkkel és kültéri székekkel"
 * → "Emeleti terasz". Cut only where the remainder starts with a decor word AND
 * carries no guest value at all — so "Kültéri medence burkolt terasszal és
 * strandkosárral" keeps its tail (terrace and beach basket ARE value), while the
 * parasol-and-chairs inventory goes. At least two words must survive.
 */
export function trimDecorTail(line: string): string {
  const words = line.trim().split(/\s+/);
  const decor = [...LEADING_ADJ, "színes", "napernyő", "dekor", "díszít"];
  for (let i = 2; i < words.length; i++) {
    const w = words[i]!.toLowerCase().replace(/[.,;:]$/, "");
    if (!decor.some((d) => w.startsWith(d))) continue;
    const tail = words.slice(i).join(" ").toLowerCase();
    if (has(tail, VALUE)) continue; // the tail still sells something → keep it
    // The cut must leave a WHOLE phrase. Two ways it did not (both measured on real
    // output): a dangling conjunction ("Medence fás kerttel és") and a trailing
    // adjective with its noun cut off ("Nagy, füves park árnyas"). Peel those back.
    const head = words.slice(0, i);
    const isDangling = (w: string): boolean => {
      const t = w.toLowerCase().replace(/[.,;:]$/, "");
      if (/^(és|vagy|s|valamint|meg)$/.test(t)) return true;
      if (decor.some((d) => t.startsWith(d))) return true;
      // Hungarian adjectives typically end -s / -ú / -ű; a noun rarely ends the
      // phrase that way here, and leaving one dangling reads as a broken sentence.
      return /(?:[aáeéioóöuú]s|ú|ű)$/.test(t) && t.length > 3;
    };
    while (head.length > 2 && isDangling(head[head.length - 1]!)) head.pop();
    if (head.length < 2) return line.trim();
    return head.join(" ").replace(/[,;:]$/, "");
  }
  return line.trim();
}

/** Keep only the highlights that offer the guest something. Order preserved. */
export function guestValueHighlights(lines: readonly string[]): string[] {
  return lines
    .filter((l) => l.trim().length > 0 && !isDecorFiller(l))
    .map((l) => trimDecorTail(trimDecorLead(l)));
}

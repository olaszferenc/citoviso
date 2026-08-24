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
  "medence", "jacuzzi", "szauna", "wellness", "pezsgőfürdő",
  "parkol", "garázs", "strand", "vízpart", "tópart", "móló", "csónak", "hajó", "horgász",
  "wifi", "internet", "klíma", "légkondicion", "fűt",
  "reggeli", "étterem", "büfé", "bár", "konyha", "grill", "bogrács", "kemence", "tűzrakó",
  "kert", "terasz", "erkély", "udvar", "panoráma", "kilátás", "kilátó",
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

/** Keep only the highlights that offer the guest something. Order preserved. */
export function guestValueHighlights(lines: readonly string[]): string[] {
  return lines.filter((l) => l.trim().length > 0 && !isDecorFiller(l));
}

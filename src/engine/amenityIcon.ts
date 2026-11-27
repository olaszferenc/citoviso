// Guest-page amenity icons (plan F follow-up, owner order 2026-08-27: "legyen a
// vendég oldal ikonos megjelenítés is").
//
// Resolution order, per item:
//   1. amenityIconMap — the translation bridge. On a non-Hungarian page the
//      rendered label is the TRANSLATED string, so the exact-label match below
//      would miss; applyTranslationMap records translated-label → catalogue id
//      at the one point where source and translation are both in hand.
//   2. Exact catalogue label ("Medence", "Saját stég") → that item's own SVG —
//      the same 70-icon set the owner approved for the admin picker, so the
//      guest page and the picker speak one visual language.
//   3. The Hungarian keyword matcher (engine icons.ts) — free-text labels the
//      owner typed into "Egyéb" still get a fitting decorative icon.
//   4. Neutral check mark (matchIcon's own fallback) — never an emoji (§B.4).
//
// The icon is DECORATIVE: it dresses the real text, never adds a claim (§B.17).
// Deterministic — mock=live holds.

import { AMENITY_CATALOG, type AmenityItem } from "../tenant/amenityCatalog.js";

const byLabel = new Map<string, AmenityItem>(AMENITY_CATALOG.map((a) => [a.label, a]));
const byId = new Map<string, AmenityItem>(AMENITY_CATALOG.map((a) => [a.id, a]));

function catalogueSvg(item: AmenityItem): string {
  return (
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${item.icon}</svg>`
  );
}

/** Inline SVG for one amenity label (see resolution order above). */
export function amenityIconSvg(
  label: string,
  iconMap?: Readonly<Record<string, string>>,
): string {
  const mapped = iconMap?.[label.trim()];
  if (mapped) {
    const item = byId.get(mapped);
    if (item) return catalogueSvg(item);
  }
  const id = catalogueIdFor(label);
  if (id) return catalogueSvg(byId.get(id)!);
  // Not a catalogue item → no icon (owner 2026-11-26: the lists carry STANDARD items only — a free-text line is
  // left out of an icon list by its caller, see catalogueIdFor; it never gets a stand-in icon).
  return "";
}

/**
 * THE STANDARD ITEM a free-text facility line names (owner 2026-11-26, after a day of icon-less tiles:
 * „mi a fasz fog történni standardizálatlan tételek nélkül?”). Every icon list on a page — the facility grid,
 * the highlight list, „Amit kínálunk” — shows only lines that map to one of the 70 catalogue items (the same
 * catalogue the tenant admin's picker uses), with that item's icon; a line that maps to none („Kúria több
 * épülettel”, „Hotel és apartmanház egyben”) stays out of the list. Accent- and case-insensitive keywords,
 * the specific item before the general one (heated pool before pool, kitchenette before kitchen).
 */
const CATALOGUE_KEYS: readonly (readonly [string, RegExp])[] = [
  ["wifi", /wi-?fi|wlan|internet/],
  ["streaming", /netflix|streaming/],
  ["flat_tv", /(^|[^a-z])tv([^a-z]|$)|televizio|teve([^a-z]|$)|television|fernseh/],
  ["game_console", /jatekkonzol|playstation|xbox|konzol/],
  ["speaker", /hangfal|zenelejatszo|hangszoro/],
  ["board_games", /tarsasjatek|biliard|billiard|darts|csocso|pingpong|asztalitenisz|kugli|teke/],
  ["books", /konyv|olvasosarok/],
  ["kitchenette", /konyhasarok|teakonyha|kitchenette/],
  ["full_kitchen", /konyha|kitchen|kuche/],
  ["fridge", /hutoszekreny|huto([^a-z]|$)|fridge/],
  ["microwave", /mikrohullam|microwave/],
  ["dishwasher", /mosogatogep|dishwasher/],
  ["coffee_maker", /kavefozo|kavegep|espresso|coffee/],
  ["kettle", /vizforralo|kettle/],
  ["breakfast", /reggeli|breakfast|fruhstuck/],
  ["restaurant", /etterem|restaurant|vendeglo/],
  ["wine_cellar", /borkostol|borpince|pince|wine|bor([^a-z]|$)/],
  ["bar", /(^|[^a-z])bar([^a-z]|$)|drinkpult|koktel/],
  ["grill", /grill|bbq|barbecue|sutes|tarcsa/],
  ["firepit", /tuzrako|bogracs|tabortuz|fire ?pit/],
  ["private_bathroom", /sajat furdo|furdoszoba/],
  ["shower", /zuhany|shower/],
  ["bathtub", /(^|[^a-z])kad([^a-z]|$)|kadas|bathtub/],
  ["hairdryer", /hajszarito|hairdryer/],
  ["linen", /torolkozo|agynemu|linen/],
  ["air_conditioning", /klima|legkondi|air ?condition/],
  ["fireplace", /kandallo|kalyha|fireplace/],
  ["heating", /futes|heating/],
  ["heated_pool", /futott medence|heated pool/],
  ["jacuzzi", /jacuzzi|jakuzzi|pezsgofurdo|dezsa|hot ?tub|whirlpool/],
  ["pool", /medence|pool|uszoda/],
  ["sauna", /szauna|sauna|gozkabin/],
  ["massage", /masszazs|massage/],
  ["gym", /fitnesz|konditerem|edzoterem|gym/],
  ["sun_lounger", /napozoagy|napagy|kerti butor|nyugagy|lounger/],
  ["playground", /jatszoter|maszoka|csuszda|hinta|trambulin|homokozo|playground/],
  ["terrace", /terasz|terrace|veranda|tornac/],
  ["balcony", /erkely|balcony|balkon/],
  ["garden", /kert([^a-z]|$|es|je|tel)|garden|udvar/],
  ["private_pier", /steg|pier/],
  ["boat", /csonak|kajak|kenu|vizibicikli|(^|[^a-z])sup([^a-z]|$)|boat/],
  ["fishing", /horgasz|fishing/],
  ["beach", /tengerpart|strand|beach/],
  ["waterfront", /vizpart|topart|folyopart|holtag|lakeside|waterfront/],
  ["panorama", /panorama|kilatas|(^|[^a-z])view/],
  ["hiking", /tura|hiking/],
  ["mountains", /hegyvidek|hegyek|mountain/],
  ["ev_charger", /elektromos (auto)?tolto|toltoallomas|ev charg/],
  ["garage", /garazs|garage/],
  ["free_parking", /parkol|parking/],
  ["bike_storage", /kerekpartarol|bicikli ?tarol/],
  ["bike_rental", /kerekpar|bicikli|bike/],
  ["transfer", /transzfer|transfer/],
  ["pet_friendly", /kisallat|kutya|haziallat|(^|[^a-z])pet/],
  ["crib", /kisagy|babaagy|crib/],
  ["high_chair", /etetoszek|high ?chair/],
  ["family_friendly", /csalad|gyerek|family/],
  ["reception", /recepcio|reception/],
  ["self_checkin", /kulcsszef|onallo bejelentkez|self.?check/],
  ["cleaning", /takaritas|cleaning/],
  ["dryer", /szaritogep|dryer/],
  ["washer", /mosogep|washing machine/],
  ["iron", /vasalo|(^|[^a-z])iron/],
  ["luggage_storage", /csomagmegorzes|luggage/],
  ["elevator", /(^|[^a-z])lift([^a-z]|$)|elevator/],
  ["accessible", /akadalymentes|accessible/],
  ["safe", /(^|[^a-z])szef([^a-z]|$)|(^|[^a-z])safe([^a-z]|$)/],
  ["non_smoking", /nemdohanyzo|non.?smoking/],
  ["workspace", /iroasztal|munkasarok|home ?office|workspace/],
  ["conference", /rendezveny|konferencia|csoport|tabor|csapatepito|conference/],
];
const normLabel = (t: string): string => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function catalogueIdFor(label: string, iconMap?: Readonly<Record<string, string>>): string | null {
  const mapped = iconMap?.[label.trim()];
  if (mapped && byId.has(mapped)) return mapped;
  const exact = byLabel.get(label.trim());
  if (exact) return exact.id;
  const n = normLabel(label);
  for (const [id, re] of CATALOGUE_KEYS) if (byId.has(id) && re.test(n)) return id;
  return null;
}

/** Catalogue id for a SOURCE (Hungarian) label — the bridge-builder's half:
 *  applyTranslationMap keys this by the translated label. */
export function amenityIconIdFor(sourceLabel: string): string | null {
  return byLabel.get(sourceLabel.trim())?.id ?? null;
}

/** The catalogue item's Hungarian source label (the i18n key), or null for an unknown id. */
/**
 * THE STANDARD FILL of a facility list (owner 11-27: „a mock terv, szakasz nem maradhat üres” — a sample section is
 * topped up, never dropped or left as an empty frame). Common, low-risk catalogue items, in order; the caller skips what
 * the page already shows and marks the section as a sample („Minta”). Shared by the Parallax grid and the module.
 */
export const STANDARD_FACILITY_FILL = ["wifi", "full_kitchen", "free_parking", "terrace", "garden", "air_conditioning", "flat_tv", "fridge", "coffee_maker", "grill"] as const;

export function catalogueLabel(id: string): string | null {
  return byId.get(id)?.label ?? null;
}

// „Országok / Árazás” 2. fázis (terv: assets/design-refs/console/orszagok-arazas/ README ⑤–⑦): the WORLD'S
// countries a new country is picked from — public facts only: ISO 3166-1 alpha-2, the official currency
// (ISO 4217), the main language (ISO 639-1, the code the language packs use), the main IANA time zone,
// the calling code and the national trunk prefix. The name comes from Intl.DisplayNames in the console's
// language (never stored here). It replaces the EU-only starter of ADR-0460 ⑨ (countryRules.blankDraft
// reads this table). Not a fallback: the saved country row is what counts, and the editor validates it.
// Holidays are NOT here (no computed holiday enters a row — the readiness asks for them).
//
// Format per line: ISO | currency | language | time zone | calling code | trunk prefix ("" = none).
const RAW = `
AD|EUR|ca|Europe/Andorra|376|
AE|AED|ar|Asia/Dubai|971|0
AF|AFN|fa|Asia/Kabul|93|0
AG|XCD|en|America/Antigua|1|1
AL|ALL|sq|Europe/Tirane|355|0
AM|AMD|hy|Asia/Yerevan|374|0
AO|AOA|pt|Africa/Luanda|244|
AR|ARS|es|America/Argentina/Buenos_Aires|54|0
AT|EUR|de|Europe/Vienna|43|0
AU|AUD|en|Australia/Sydney|61|0
AZ|AZN|az|Asia/Baku|994|0
BA|BAM|bs|Europe/Sarajevo|387|0
BB|BBD|en|America/Barbados|1|1
BD|BDT|bn|Asia/Dhaka|880|0
BE|EUR|nl|Europe/Brussels|32|0
BF|XOF|fr|Africa/Ouagadougou|226|
BG|EUR|bg|Europe/Sofia|359|0
BH|BHD|ar|Asia/Bahrain|973|
BI|BIF|fr|Africa/Bujumbura|257|
BJ|XOF|fr|Africa/Porto-Novo|229|
BN|BND|ms|Asia/Brunei|673|
BO|BOB|es|America/La_Paz|591|0
BR|BRL|pt|America/Sao_Paulo|55|0
BS|BSD|en|America/Nassau|1|1
BT|BTN|dz|Asia/Thimphu|975|
BW|BWP|en|Africa/Gaborone|267|
BY|BYN|be|Europe/Minsk|375|8
BZ|BZD|en|America/Belize|501|
CA|CAD|en|America/Toronto|1|1
CD|CDF|fr|Africa/Kinshasa|243|0
CF|XAF|fr|Africa/Bangui|236|
CG|XAF|fr|Africa/Brazzaville|242|
CH|CHF|de|Europe/Zurich|41|0
CI|XOF|fr|Africa/Abidjan|225|
CL|CLP|es|America/Santiago|56|
CM|XAF|fr|Africa/Douala|237|
CN|CNY|zh|Asia/Shanghai|86|0
CO|COP|es|America/Bogota|57|
CR|CRC|es|America/Costa_Rica|506|
CU|CUP|es|America/Havana|53|0
CV|CVE|pt|Atlantic/Cape_Verde|238|
CY|EUR|el|Asia/Nicosia|357|
CZ|CZK|cs|Europe/Prague|420|
DE|EUR|de|Europe/Berlin|49|0
DJ|DJF|fr|Africa/Djibouti|253|
DK|DKK|da|Europe/Copenhagen|45|
DM|XCD|en|America/Dominica|1|1
DO|DOP|es|America/Santo_Domingo|1|1
DZ|DZD|ar|Africa/Algiers|213|0
EC|USD|es|America/Guayaquil|593|0
EE|EUR|et|Europe/Tallinn|372|
EG|EGP|ar|Africa/Cairo|20|0
ER|ERN|ti|Africa/Asmara|291|0
ES|EUR|es|Europe/Madrid|34|
ET|ETB|am|Africa/Addis_Ababa|251|0
FI|EUR|fi|Europe/Helsinki|358|0
FJ|FJD|en|Pacific/Fiji|679|
FM|USD|en|Pacific/Pohnpei|691|
FR|EUR|fr|Europe/Paris|33|0
GA|XAF|fr|Africa/Libreville|241|
GB|GBP|en|Europe/London|44|0
GD|XCD|en|America/Grenada|1|1
GE|GEL|ka|Asia/Tbilisi|995|0
GH|GHS|en|Africa/Accra|233|0
GM|GMD|en|Africa/Banjul|220|
GN|GNF|fr|Africa/Conakry|224|
GQ|XAF|es|Africa/Malabo|240|
GR|EUR|el|Europe/Athens|30|
GT|GTQ|es|America/Guatemala|502|
GW|XOF|pt|Africa/Bissau|245|
GY|GYD|en|America/Guyana|592|
HN|HNL|es|America/Tegucigalpa|504|
HR|EUR|hr|Europe/Zagreb|385|0
HT|HTG|fr|America/Port-au-Prince|509|
HU|HUF|hu|Europe/Budapest|36|06
ID|IDR|id|Asia/Jakarta|62|0
IE|EUR|en|Europe/Dublin|353|0
IL|ILS|he|Asia/Jerusalem|972|0
IN|INR|hi|Asia/Kolkata|91|0
IQ|IQD|ar|Asia/Baghdad|964|0
IR|IRR|fa|Asia/Tehran|98|0
IS|ISK|is|Atlantic/Reykjavik|354|
IT|EUR|it|Europe/Rome|39|
JM|JMD|en|America/Jamaica|1|1
JO|JOD|ar|Asia/Amman|962|0
JP|JPY|ja|Asia/Tokyo|81|0
KE|KES|sw|Africa/Nairobi|254|0
KG|KGS|ky|Asia/Bishkek|996|0
KH|KHR|km|Asia/Phnom_Penh|855|0
KI|AUD|en|Pacific/Tarawa|686|
KM|KMF|ar|Indian/Comoro|269|
KN|XCD|en|America/St_Kitts|1|1
KP|KPW|ko|Asia/Pyongyang|850|
KR|KRW|ko|Asia/Seoul|82|0
KW|KWD|ar|Asia/Kuwait|965|
KZ|KZT|kk|Asia/Almaty|7|8
LA|LAK|lo|Asia/Vientiane|856|0
LB|LBP|ar|Asia/Beirut|961|0
LC|XCD|en|America/St_Lucia|1|1
LI|CHF|de|Europe/Vaduz|423|
LK|LKR|si|Asia/Colombo|94|0
LR|LRD|en|Africa/Monrovia|231|0
LS|LSL|en|Africa/Maseru|266|
LT|EUR|lt|Europe/Vilnius|370|8
LU|EUR|fr|Europe/Luxembourg|352|
LV|EUR|lv|Europe/Riga|371|
LY|LYD|ar|Africa/Tripoli|218|0
MA|MAD|ar|Africa/Casablanca|212|0
MC|EUR|fr|Europe/Monaco|377|
MD|MDL|ro|Europe/Chisinau|373|0
ME|EUR|sr|Europe/Podgorica|382|0
MG|MGA|mg|Indian/Antananarivo|261|0
MH|USD|en|Pacific/Majuro|692|
MK|MKD|mk|Europe/Skopje|389|0
ML|XOF|fr|Africa/Bamako|223|
MM|MMK|my|Asia/Yangon|95|0
MN|MNT|mn|Asia/Ulaanbaatar|976|0
MR|MRU|ar|Africa/Nouakchott|222|
MT|EUR|mt|Europe/Malta|356|
MU|MUR|en|Indian/Mauritius|230|
MV|MVR|dv|Indian/Maldives|960|
MW|MWK|en|Africa/Blantyre|265|0
MX|MXN|es|America/Mexico_City|52|
MY|MYR|ms|Asia/Kuala_Lumpur|60|0
MZ|MZN|pt|Africa/Maputo|258|
NA|NAD|en|Africa/Windhoek|264|0
NE|XOF|fr|Africa/Niamey|227|
NG|NGN|en|Africa/Lagos|234|0
NI|NIO|es|America/Managua|505|
NL|EUR|nl|Europe/Amsterdam|31|0
NO|NOK|nb|Europe/Oslo|47|
NP|NPR|ne|Asia/Kathmandu|977|0
NR|AUD|en|Pacific/Nauru|674|
NZ|NZD|en|Pacific/Auckland|64|0
OM|OMR|ar|Asia/Muscat|968|
PA|PAB|es|America/Panama|507|
PE|PEN|es|America/Lima|51|0
PG|PGK|en|Pacific/Port_Moresby|675|
PH|PHP|en|Asia/Manila|63|0
PK|PKR|ur|Asia/Karachi|92|0
PL|PLN|pl|Europe/Warsaw|48|
PS|ILS|ar|Asia/Hebron|970|0
PT|EUR|pt|Europe/Lisbon|351|
PW|USD|en|Pacific/Palau|680|
PY|PYG|es|America/Asuncion|595|0
QA|QAR|ar|Asia/Qatar|974|
RO|RON|ro|Europe/Bucharest|40|0
RS|RSD|sr|Europe/Belgrade|381|0
RU|RUB|ru|Europe/Moscow|7|8
RW|RWF|rw|Africa/Kigali|250|
SA|SAR|ar|Asia/Riyadh|966|0
SB|SBD|en|Pacific/Guadalcanal|677|
SC|SCR|en|Indian/Mahe|248|
SD|SDG|ar|Africa/Khartoum|249|0
SE|SEK|sv|Europe/Stockholm|46|0
SG|SGD|en|Asia/Singapore|65|
SI|EUR|sl|Europe/Ljubljana|386|0
SK|EUR|sk|Europe/Bratislava|421|0
SL|SLE|en|Africa/Freetown|232|0
SM|EUR|it|Europe/San_Marino|378|
SN|XOF|fr|Africa/Dakar|221|
SO|SOS|so|Africa/Mogadishu|252|0
SR|SRD|nl|America/Paramaribo|597|0
SS|SSP|en|Africa/Juba|211|0
ST|STN|pt|Africa/Sao_Tome|239|
SV|USD|es|America/El_Salvador|503|
SY|SYP|ar|Asia/Damascus|963|0
SZ|SZL|en|Africa/Mbabane|268|
TD|XAF|fr|Africa/Ndjamena|235|
TG|XOF|fr|Africa/Lome|228|
TH|THB|th|Asia/Bangkok|66|0
TJ|TJS|tg|Asia/Dushanbe|992|8
TL|USD|pt|Asia/Dili|670|
TM|TMT|tk|Asia/Ashgabat|993|8
TN|TND|ar|Africa/Tunis|216|
TO|TOP|to|Pacific/Tongatapu|676|
TR|TRY|tr|Europe/Istanbul|90|0
TT|TTD|en|America/Port_of_Spain|1|1
TV|AUD|en|Pacific/Funafuti|688|
TW|TWD|zh|Asia/Taipei|886|0
TZ|TZS|sw|Africa/Dar_es_Salaam|255|0
UA|UAH|uk|Europe/Kyiv|380|0
UG|UGX|en|Africa/Kampala|256|0
US|USD|en|America/New_York|1|1
UY|UYU|es|America/Montevideo|598|0
UZ|UZS|uz|Asia/Tashkent|998|
VA|EUR|it|Europe/Vatican|39|
VC|XCD|en|America/St_Vincent|1|1
VE|VES|es|America/Caracas|58|0
VN|VND|vi|Asia/Ho_Chi_Minh|84|0
VU|VUV|bi|Pacific/Efate|678|
WS|WST|sm|Pacific/Apia|685|
XK|EUR|sq|Europe/Belgrade|383|0
YE|YER|ar|Asia/Aden|967|0
ZA|ZAR|en|Africa/Johannesburg|27|0
ZM|ZMW|en|Africa/Lusaka|260|0
ZW|USD|en|Africa/Harare|263|0
`;

export interface CatalogCountry {
  readonly iso: string;
  readonly currency: string;
  readonly lang: string;
  readonly tz: string;
  readonly dial: string;
  readonly trunk: string;
}

const CATALOG: ReadonlyMap<string, CatalogCountry> = new Map(
  RAW.trim()
    .split("\n")
    .map((l) => l.split("|"))
    .map(([iso, currency, lang, tz, dial, trunk]) => [iso!, { iso: iso!, currency: currency!, lang: lang!, tz: tz!, dial: dial!, trunk: trunk ?? "" }]),
);

/** Every catalog country (ISO order). */
export function catalogCountries(): readonly CatalogCountry[] {
  return [...CATALOG.values()];
}

/** One country's public facts, or null for a code the catalog does not know. */
export function catalogCountry(iso: string | null | undefined): CatalogCountry | null {
  return CATALOG.get(String(iso ?? "").trim().toUpperCase()) ?? null;
}

/** The country's name in a language (Intl.DisplayNames), the code itself when the runtime cannot name it. */
export function countryNameIn(iso: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang || "hu"], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

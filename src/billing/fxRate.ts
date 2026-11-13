// MNB OFFICIAL EXCHANGE RATES — for TAX COUNTING and FOREIGN-CURRENCY INVOICES only
// (ADR-0443). ⛔ Never to convert a PRICE: every country prices in its own currency at an
// absolute amount the owner sets (owner, 2026-11-12). A rate is needed where Hungarian tax
// law counts in forint (the AAM cap, the A60 summary in thousand HUF) or in euro (the OSS
// 10 000 € threshold), and on a non-HUF invoice (Számlázz.hu `arfolyamBank=MNB`).
//
// Which rate: the MNB rate valid on the fulfilment date — the last one PUBLISHED on or before
// it (MNB publishes on business days only; a weekend sale uses Friday's). Cached per day in
// `fx_rate` (0135), so a counter and the invoice it counts use the SAME number.
//
// Source: MNB's public SOAP service (www.mnb.hu/arfolyamok.asmx, GetExchangeRates) — no key,
// no personal data in the request. A failed fetch returns null and the caller fails CLOSED
// (a tax counter that cannot convert an invoice is "unknown", never "0").
import { sql } from "kysely";
import { db } from "../db/client.js";

const MNB_URL = "http://www.mnb.hu/arfolyamok.asmx";
/** How far back a published rate may be (a long holiday is ~4 days; 10 is generous). */
const LOOKBACK_DAYS = 10;

function isoMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** The cached rate valid on `isoDate` (last published on/before it), or null. */
async function cachedRate(currency: string, isoDate: string): Promise<{ rate: number; date: string } | null> {
  const row = await db
    .selectFrom("fx_rate")
    .select(["huf_per_unit", "rate_date"])
    .where("currency", "=", currency)
    .where(sql<boolean>`rate_date <= ${isoDate}::date`)
    .where(sql<boolean>`rate_date >= ${isoMinusDays(isoDate, LOOKBACK_DAYS)}::date`)
    .orderBy("rate_date", "desc")
    .executeTakeFirst();
  if (!row) return null;
  const date = typeof row.rate_date === "string" ? row.rate_date : new Date(row.rate_date as unknown as string).toISOString().slice(0, 10);
  return { rate: Number(row.huf_per_unit), date };
}

/** Parse MNB's GetExchangeRates result (an XML document escaped inside the SOAP body). */
export function parseMnbRates(soapBody: string): { date: string; currency: string; hufPerUnit: number }[] {
  const inner = soapBody
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  const out: { date: string; currency: string; hufPerUnit: number }[] = [];
  for (const day of inner.matchAll(/<Day date="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/Day>/g)) {
    for (const r of day[2]!.matchAll(/<Rate unit="(\d+)" curr="([A-Z]{3})">([\d.,]+)<\/Rate>/g)) {
      const unit = Number(r[1]);
      const v = Number(r[3]!.replace(",", "."));
      if (unit > 0 && v > 0) out.push({ date: day[1]!, currency: r[2]!, hufPerUnit: v / unit });
    }
  }
  return out;
}

async function fetchMnb(currency: string, fromIso: string, toIso: string): Promise<number> {
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://www.mnb.hu/webservices/">' +
    "<soap:Body><web:GetExchangeRates>" +
    `<web:startDate>${fromIso}</web:startDate><web:endDate>${toIso}</web:endDate>` +
    `<web:currencyNames>${currency}</web:currencyNames>` +
    "</web:GetExchangeRates></soap:Body></soap:Envelope>";
  const resp = await fetch(MNB_URL, {
    method: "POST",
    headers: {
      "content-type": "text/xml; charset=utf-8",
      SOAPAction: '"http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates"',
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`MNB HTTP ${resp.status}`);
  const rates = parseMnbRates(await resp.text()).filter((r) => r.currency === currency);
  for (const r of rates) {
    await db
      .insertInto("fx_rate")
      .values({ rate_date: r.date, currency: r.currency, huf_per_unit: String(r.hufPerUnit) })
      .onConflict((oc) => oc.columns(["rate_date", "currency"]).doNothing())
      .execute();
  }
  return rates.length;
}

/**
 * HUF per 1 unit of `currency`, valid on `isoDate` (YYYY-MM-DD). HUF → 1. Cache first,
 * then MNB; null when neither has it (the caller fails closed).
 */
export async function mnbRate(currency: string, isoDate: string): Promise<{ rate: number; date: string } | null> {
  const c = currency.toUpperCase();
  if (c === "HUF") return { rate: 1, date: isoDate };
  const hit = await cachedRate(c, isoDate);
  if (hit) return hit;
  try {
    await fetchMnb(c, isoMinusDays(isoDate, LOOKBACK_DAYS), isoDate);
  } catch (e) {
    console.warn(`[fx] MNB-árfolyam nem érhető el (${c} ${isoDate}): ${(e as Error).message}`); // i18n-exempt: operátori napló
    return null;
  }
  return cachedRate(c, isoDate);
}

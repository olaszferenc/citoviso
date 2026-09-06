// Websupport registrar adapter (ADR-0103). Websupport replaced INWX as the registrar:
// .hu costs 2 599 Ft/év here instead of ~10 500 Ft/év, it is a Hungarian registrar with
// real-time .hu registration. Env REGISTRAR_PROVIDER=websupport selects it.
//
// WHAT IS MEASURED AND WHAT IS NOT (§B.17 — a fabricated response shape must never ship
// as if it worked):
//   MEASURED 2026-09-06 against the live account (olaszferenc / 3213041):
//     - HMAC-SHA1 auth over "{METHOD} {path} {unix_ts}", Basic apiKey:hexsig + Date header;
//       the signed path must NOT include the query string (401 otherwise).
//     - GET /v1/user/{id}                  -> account + billing profiles (registrant source)
//     - POST /v1/order/hu/validate/domain  -> {status, item:{price, priceWithVat, currency,
//                                              period, periodLength}, errors:{domain:[…]}}
//   NOT MEASURED YET (the account has 0 credit and unconfirmed ToS, so no purchase can run):
//     - the POST /v1/user/{id}/order request body, and the PUT …/pay/byCredit follow-up.
//   => register() therefore REFUSES to buy rather than guessing the order payload. The
//      purchase path unblocks when the owner tops up credit + confirms ToS, and the order
//      call is measured with ?dryRun=1 first.
//
// REGISTRANT GUARD (⛔ the 2026-09-06 lesson, feedback_approved_params_are_the_approval):
// a domain profile CANNOT be passed to the API (validate/order reject domainProfileId, and
// no domain-profile route exists), so the registrant is whatever the ACCOUNT's default
// billing contact is. On 2026-09-06 that fact — unverified — put citoviso.hu under the
// wrong legal entity. Every purchase now verifies the account's default contact against
// WEBSUPPORT_EXPECTED_REGISTRANT first, and refuses on any mismatch.

import { createHmac } from "node:crypto";
import type { DomainRegistration, RegistrarAdapter } from "./registrar.js";
import { DomainTakenError } from "./registrar.js";

const BASE = "https://rest.websupport.hu";

/** The availability+price answer, exactly as the live endpoint returns it. */
interface ValidateResponse {
  readonly status?: string;
  readonly item?: {
    readonly domain?: string;
    readonly price?: number | null;
    readonly priceWithVat?: number | null;
    readonly currency?: string | null;
    readonly period?: number | null;
    readonly periodLength?: string | null;
  };
  readonly errors?: { readonly domain?: readonly string[] } | readonly unknown[];
}

export interface WebsupportRegistrarOptions {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly userId: string;
  /**
   * The legal name that MUST be the account's default billing contact for a purchase to
   * run. Empty => no purchase (fail-closed): an unverifiable registrant is a blocked buy.
   */
  readonly expectedRegistrant: string;
  /**
   * HUF per 1 EUR, used ONLY to compare the HUF registrar price against the EUR price cap
   * (ADR-0093/0103 ④). Deliberately set LOW so the converted EUR figure overstates rather
   * than understates the cost — a guard input, not an accounting rate. 0 => no price.
   */
  readonly hufPerEur: number;
}

export class WebsupportRegistrar implements RegistrarAdapter {
  readonly name = "websupport";
  #apiKey: string;
  #apiSecret: string;
  #userId: string;
  #expectedRegistrant: string;
  #hufPerEur: number;

  constructor(opts: WebsupportRegistrarOptions) {
    if (!opts.apiKey || !opts.apiSecret || !opts.userId) {
      throw new Error(
        "REGISTRAR_PROVIDER=websupport, de a WEBSUPPORT_API_KEY / WEBSUPPORT_API_SECRET / " +
          "WEBSUPPORT_USER_ID valamelyike hiányzik — állítsd be a kulcsokat, vagy maradj " +
          "REGISTRAR_PROVIDER=mock lokálban.",
      );
    }
    this.#apiKey = opts.apiKey;
    this.#apiSecret = opts.apiSecret;
    this.#userId = opts.userId;
    this.#expectedRegistrant = opts.expectedRegistrant;
    this.#hufPerEur = opts.hufPerEur;
  }

  /**
   * MEASURED: HMAC-SHA1 over "{METHOD} {path} {unix_ts}" -> hex; the path is signed WITHOUT
   * the query string (signing it with "?perPage=100" answers 401 "Incorrect api key or
   * signature", signing the bare path and sending the query on the URL answers 200).
   */
  #headers(method: string, pathWithQuery: string): Record<string, string> {
    const path = pathWithQuery.split("?")[0];
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha1", this.#apiSecret).update(`${method} ${path} ${ts}`).digest("hex");
    return {
      Authorization: `Basic ${Buffer.from(`${this.#apiKey}:${sig}`).toString("base64")}`,
      Date: new Date(ts * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  async #request<T>(method: string, pathWithQuery: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${pathWithQuery}`, {
      method,
      headers: this.#headers(method, pathWithQuery),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Websupport ${method} ${pathWithQuery}: nem JSON válasz (${res.status})`);
    }
    if (!res.ok) {
      const msg = (parsed as { message?: string })?.message ?? text.slice(0, 200);
      throw new Error(`Websupport ${method} ${pathWithQuery}: HTTP ${res.status} — ${msg}`);
    }
    return parsed as T;
  }

  /** Availability + price in one call (the endpoint answers both). */
  async #validate(domain: string, years: number): Promise<ValidateResponse> {
    return this.#request<ValidateResponse>("POST", "/v1/order/hu/validate/domain", {
      domain,
      period: years,
    });
  }

  /** True when the registrar considers the domain registrable right now. */
  async isAvailable(domain: string): Promise<boolean> {
    const r = await this.#validate(domain, 1);
    return r.status === "success";
  }

  /**
   * Yearly price converted to EUR for the ADR-0093 cap. Uses the GROSS (VAT-inclusive)
   * figure when available: the cap is a spend guard, and the higher number makes it bite
   * earlier. Throws whenever the price cannot be established — an unknown price is a
   * blocked purchase, never a free pass (§B.17 missing-data branch fails loud).
   */
  async getYearlyPriceEur(domain: string): Promise<number> {
    if (!(this.#hufPerEur > 0)) {
      throw new Error(
        "DOMAIN_HUF_PER_EUR nincs beállítva — a HUF-ár nem váltható át az EUR ár-plafonra, " +
          "ezért a vásárlás blokkolva (ADR-0103 ④).",
      );
    }
    const r = await this.#validate(domain, 1);
    if (r.status !== "success") {
      const why = Array.isArray((r.errors as { domain?: string[] })?.domain)
        ? (r.errors as { domain: string[] }).domain.join(", ")
        : "ismeretlen ok";
      throw new Error(`a(z) ${domain} nem regisztrálható (${why}) — nincs ár, nincs vétel`);
    }
    const currency = (r.item?.currency ?? "").toLowerCase();
    if (currency !== "huf") {
      throw new Error(
        `váratlan pénznem a(z) ${domain} árában: ${currency || "hiányzik"} — az átváltás csak ` +
          "HUF-ra mért, ezért a vásárlás blokkolva",
      );
    }
    if (r.item?.periodLength !== "year" || r.item?.period !== 1) {
      throw new Error(
        `a(z) ${domain} ára nem 1 ÉVES tételként jött vissza ` +
          `(period=${r.item?.period}, periodLength=${r.item?.periodLength}) — vásárlás blokkolva`,
      );
    }
    const huf = r.item?.priceWithVat ?? r.item?.price;
    if (typeof huf !== "number" || !(huf > 0)) {
      throw new Error(`a(z) ${domain} ára nem olvasható ki a válaszból — vásárlás blokkolva`);
    }
    return huf / this.#hufPerEur;
  }

  /**
   * The registrant guard (ADR-0103 ⑤). Reads the account and requires its DEFAULT billing
   * profile to carry the expected legal name. This is the only lever we have on who the
   * domain ends up belonging to, because the API accepts no per-order contact.
   */
  async #assertRegistrant(domain: string): Promise<void> {
    if (!this.#expectedRegistrant) {
      throw new Error(
        "WEBSUPPORT_EXPECTED_REGISTRANT nincs beállítva — a domain tulajdonosa nem igazolható, " +
          `ezért a(z) ${domain} vásárlása blokkolva (ADR-0103 ⑤).`,
      );
    }
    const user = await this.#request<{
      login?: string;
      billing?: { profile?: string; isDefault?: boolean; name?: string }[];
    }>("GET", `/v1/user/${this.#userId}`);
    const def = (user.billing ?? []).find((b) => b.isDefault) ?? (user.billing ?? [])[0];
    const actual = (def?.name ?? "").trim();
    if (actual.toLowerCase() !== this.#expectedRegistrant.trim().toLowerCase()) {
      throw new Error(
        `a registrar-fiók (${user.login ?? this.#userId}) alapértelmezett kontaktja ` +
          `„${actual || "hiányzik"}", a várt tulajdonos „${this.#expectedRegistrant}" — ` +
          `a(z) ${domain} vásárlása NEM indult el (ADR-0103 ⑤).`,
      );
    }
  }

  /**
   * DELIBERATELY REFUSES until the order payload is measured. The availability check runs
   * first so a genuinely taken domain still surfaces as DomainTakenError (the caller's
   * normal failure), and the registrant guard runs before anything else could spend money.
   *
   * To unblock (next session): the owner tops up the account's credit and confirms the ToS,
   * then POST /v1/user/{id}/order?dryRun=1 is measured — dryRun spends nothing — and the
   * real order + PUT …/pay/byCredit retry loop (404 "Relation not found" for ~5 s, then 200)
   * replaces this throw.
   */
  async register(domain: string, opts: { readonly years: number }): Promise<DomainRegistration> {
    await this.#assertRegistrant(domain);
    if (!(await this.isAvailable(domain))) throw new DomainTakenError(domain);
    void opts;
    throw new Error(
      `Websupport-vásárlás még nincs élesítve: a rendelés-kérés pontos alakja NINCS MÉRVE ` +
        `(a fiók kreditje 0 és a ToS nincs megerősítve, így vétel nem futtatható) — ` +
        `a(z) ${domain} beszerzése nem indult el. Feloldás: kredit + ToS, majd dryRun-mérés (ADR-0103).`,
    );
  }

  /**
   * Terv-B (ADR-0103 ③): the API has NO nameserver-setting call, and it does not need one —
   * the domain stays on the registrar's own nameservers and we drive its zone through the
   * zone API. So this accepts the delegation the DNS adapter reports back, and refuses
   * anything else rather than silently pretending a delegation happened.
   */
  async setNameservers(domain: string, nameservers: readonly string[]): Promise<void> {
    const foreign = nameservers.filter((ns) => !/\bwebsupport\b|\bwy\.hu$|\bwebsupport\.hu$/i.test(ns));
    if (foreign.length > 0) {
      throw new Error(
        `NS-váltás nem támogatott: a(z) ${domain} a registrar saját névszerverein marad ` +
          `(terv-B, ADR-0103 ③), de idegen NS-t kaptam: ${foreign.join(", ")}`,
      );
    }
    // Already delegated there by virtue of being registered here — nothing to do.
  }
}

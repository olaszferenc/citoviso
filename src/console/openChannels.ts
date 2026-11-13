// „Megnyitás csatornánként” — the dashboard card's numbers (frozen plan:
// assets/design-refs/console/csatorna-megnyitas/, „B”, owner 2026-11-13).
//
// Per channel and period:
//   got    = leads whose FIRST send of the link on this channel fell in the period
//            (touchesOf: the channel's first send, before the second-touch cut);
//   opened = of those, the leads that clicked the link FROM this channel, any time after
//            (attributeOpen: the link's channel letter, else inferred; bots excluded).
// A mail being merely opened is not measured — an "open" is the link click.
// SMS and MMS are one channel: the link rides the SMS (or the MMS's companion SMS).
//
// The data is the report's own (loadProspectFacts), so a number here and the Riport
// „Honnan nyitották” panel are attributed by the same rules.

import { loadProspectFacts, reportPeriod, type ProspectFacts, type ReportPeriod } from "./reportData.js";

export const OPEN_CHANNELS = ["email", "sms", "viber", "whatsapp"] as const;
export type OpenChannel = (typeof OPEN_CHANNELS)[number];
/** The card's three fixed periods — `reportPeriod` presets (the dashboard chip does not touch them). */
export const OPEN_PERIODS = ["today", "7", "0"] as const;
export type OpenPeriod = (typeof OPEN_PERIODS)[number];

export interface OpenCell {
  readonly got: number;
  readonly opened: number;
}

export interface OpenChannelsPeriod {
  readonly cells: Readonly<Record<OpenChannel, OpenCell>>;
  /** Leads that got the link in the period and have an open no channel could be named for. */
  readonly unknown: number;
}

export type OpenChannelsData = Readonly<Record<OpenPeriod, OpenChannelsPeriod>>;

const inPeriod = (at: Date | undefined, p: ReportPeriod): boolean => !!at && at.getTime() >= p.fromMs && at.getTime() <= p.toMs;

/** Pure fold — the guard's self-test and the card call the same function. */
export function foldOpenChannels(facts: readonly ProspectFacts[], period: ReportPeriod): OpenChannelsPeriod {
  const cells = {} as Record<OpenChannel, OpenCell>;
  for (const ch of OPEN_CHANNELS) {
    let got = 0;
    let opened = 0;
    for (const p of facts) {
      if (!inPeriod(p.touches?.[ch], period)) continue;
      got++;
      if (p.visits.some((v) => v.openSource === ch)) opened++;
    }
    cells[ch] = { got, opened };
  }
  let unknown = 0;
  for (const p of facts) {
    const touched = OPEN_CHANNELS.some((ch) => inPeriod(p.touches?.[ch], period));
    if (touched && p.visits.some((v) => (v.openSource ?? "unknown") === "unknown")) unknown++;
  }
  return { cells, unknown };
}

export async function getOpenChannels(now = new Date()): Promise<OpenChannelsData> {
  const facts = await loadProspectFacts();
  const out = {} as Record<OpenPeriod, OpenChannelsPeriod>;
  for (const k of OPEN_PERIODS) out[k] = foldOpenChannels(facts, reportPeriod(k, null, null, now));
  return out;
}

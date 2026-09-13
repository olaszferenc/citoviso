// WHAT a tenant message is ABOUT — the topic registry behind the „Üzenetek" tab's
// „Miről szól" filter row.
//
// WHY THIS FILE EXISTS (Elek FK-001 E2, measured 2026-09-12/13):
// The reported defect was „114 olvasatlan, ismétlődő foglalás-sorok zaja", and the
// proposed fix was to collapse the booking rows into threads. Measured, that fix
// does nothing: the 35 booking messages belong to 34 DIFFERENT booking requests
// (33 single-member threads, 1 with two), so collapsing yields 35 → 34 rows. The
// repetition is not INSIDE a thread but ACROSS threads — ten Elek laps resubmitting
// the same two guests. That volume is park artifact (112 of 114 messages were
// written in three days) and is closed as such in ADR-0127.
//
// What the same measurement DID find is this: the filter bar knew only about
// TRANSPORT (E-mail/SMS) and READ STATE — never about what the message is ABOUT.
// In a realistic live account ~61% of the mailbox is booking traffic, so „show me
// the billing" was reachable only by typing a search term.
//
// ── THE RULE ────────────────────────────────────────────────────────────────
// The chip's LABEL and the chip's PREDICATE come from the same table below, so a
// chip cannot structurally name a topic it does not read
// (feedback_label_must_derive_from_predicate — the leadFilters.ts / invoiceItem.ts
// pattern, where a filter naming a column it did not filter on shipped a false
// sentence past every green gate).
//
// The mapping is TOTAL: `Record<MessageKind, MessageTopic>` makes the compiler,
// not anyone's attention, reject a new `kind` that has no topic.

import { T } from "../i18n/mail.js";
import type { MessageKind } from "./messages.js";

/** The four topics the owner approved (2026-09-13, §2b plan gate, variant „A"). */
export type MessageTopic = "foglalas" | "szamlazas" | "honlap" | "fiok";

/**
 * Every message kind's topic. ⛔ TOTAL BY TYPE — adding a `kind` to the schema
 * without a topic here is a compile error, which is the point.
 */
const TOPIC_OF: Record<MessageKind, MessageTopic> = {
  // What the guests did on the owner's site.
  booking: "foglalas",
  // Money: the document and the ladder that chases it. One question for the owner
  // („mit fizettem / mit kérnek?"), so one topic.
  invoice: "szamlazas",
  dunning: "szamlazas",
  // The site itself — is it live, on what address, in what languages, what did the
  // guests say about it, how many came.
  site_live: "honlap",
  domain: "honlap",
  multilang: "honlap",
  review: "honlap",
  traffic: "honlap",
  // Access to the admin. Rare, but a DIFFERENT question from how the site behaves —
  // and precisely because it is rare, being one click away is what makes it findable.
  credentials: "fiok",
  other: "fiok",
};

/** Display order of the chips — the filter row renders exactly this sequence. */
export const MESSAGE_TOPICS: readonly MessageTopic[] = ["foglalas", "szamlazas", "honlap", "fiok"];

/** The topic of one message kind. */
export function topicOfKind(kind: MessageKind): MessageTopic {
  return TOPIC_OF[kind];
}

/** True when `value` names a topic — so a query parameter can be trusted. */
export function isMessageTopic(value: string): value is MessageTopic {
  return (MESSAGE_TOPICS as readonly string[]).includes(value);
}

/**
 * The chip's label. Lives HERE, next to the predicate it describes: a label kept in
 * the view and a mapping kept in the data layer are two copies that drift, and the
 * drift is invisible (the filter keeps working, only the sentence turns false).
 */
export function messageTopicLabel(topic: MessageTopic, lang = "hu"): string {
  switch (topic) {
    case "foglalas":
      return T(lang, "Foglalások");
    case "szamlazas":
      return T(lang, "Számlázás");
    case "honlap":
      return T(lang, "A honlapom");
    case "fiok":
      return T(lang, "Fiók");
  }
}

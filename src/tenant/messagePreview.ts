// WHAT the message list shows UNDER the subject — the one line that helps the owner
// decide whether to open it.
//
// WHY THIS FILE EXISTS (Elek FK-001 E3, mérve 2026-09-13): the preview was „the body's
// first non-empty line", and every invoice notice starts with a greeting. Result: 19
// invoice rows whose preview was character-for-character identical — „Kedves Elek
// Teszt!" — on a screen whose whole job is to tell them apart. The data was there (the
// amount is three lines down); it just never reached the row.
//
// ⛔ THE RULE IS DERIVED FROM THE SENDER, NOT GUESSED FROM THE TEXT.
// A „looks like a greeting" heuristic (short line ending in „!") would be a Hungarian
// habit dressed up as a rule, and would silently rot the day a tenant reads in German.
// Instead the skip-list is BUILT FROM THE SAME `T()` SOURCES the senders use, so it is
// correct in every language by construction:
//   • `src/email/invoiceEmail.ts:56`      → T(lang, "Kedves {name}!")
//   • `src/tenant/multilangCore.ts:349`   → T(lang, "Kedves Partnerünk!")
//   • `src/email/invoiceEmail.ts:60-61`   → the two „Köszönjük …" courtesy sentences
// Add a sender with a new opening line and it belongs on these lists — that is a
// one-line change next to a named source, not an invisible regression.
//
// Contract: assets/design-refs/tenant-admin/uzenetek-ugyek/README.md ③.

import { T } from "../i18n/mail.js";
import type { MessageKind } from "./messages.js";

/** Egy `T()` sablonból illesztő minta: a `{placeholder}`-ek helyére bármi jöhet. */
function templateMatcher(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A fenti escape a `\{name\}`-et is bekapcsolta — ezt oldjuk fel joker-re.
  return new RegExp(`^${escaped.replace(/\\\{[a-z]+\\\}/gi, ".+")}$`, "i");
}

/**
 * Opening lines that carry no information about THIS message. Every entry is a real
 * sender's line, named above — not a guess about what a greeting looks like.
 */
function skipPatterns(lang: string): RegExp[] {
  return [
    T(lang, "Kedves {name}!", { name: "{name}" }),
    T(lang, "Kedves Partnerünk!"),
    T(lang, "Köszönjük az előfizetést. A fizetés megérkezett, a számlát mellékeljük."),
    T(lang, "Köszönjük a megrendelést. A fizetés megérkezett, a számlát mellékeljük."),
  ].map(templateMatcher);
}

/** A törzs nem-üres sorai, levágva. */
function lines(bodyText: string): string[] {
  return bodyText.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * The preview line for one message.
 *
 * `title` is what the row already shows as its headline — passed in so the preview can
 * avoid REPEATING it. ⚠️ Measured on the draft: for an SMS (which has no subject, so the
 * list titles it from the body's first line) the naive preview returned that very same
 * line, and the row said everything twice.
 *
 * ⛔ FOR AN INVOICE THE PREVIEW IS THE AMOUNT — deliberately NOT the item name. Measured
 * on the draft: an „amount + item" preview produced only FOUR distinct previews across 19
 * invoices, because the item is ALREADY IN THE SUBJECT („Számla OV-2026-43 – Honlap-
 * előfizetés (éves)"). Repeating it cannot distinguish anything. The preview carries what
 * the title LACKS; the title carries what makes the row unique (kontraktus ③).
 */
export function messagePreview(
  m: { readonly kind: MessageKind; readonly bodyText: string },
  title: string,
  lang = "hu",
): string {
  const all = lines(m.bodyText);

  if (m.kind === "invoice") {
    // Ugyanaz a felirat, amit az invoiceEmail.ts a törzsbe ír — egy forrás.
    const label = T(lang, "Összeg:");
    const amount = all.find((l) => l.startsWith(label));
    if (amount) return amount;
  }

  const skip = skipPatterns(lang);
  const meat = all.filter((l) => !skip.some((re) => re.test(l)));
  // ⛔ A CÍM MEGISMÉTLÉSE NEM ELŐNÉZET. Mérve az őrön: egy EGYSOROS SMS-nek nincs
  // tárgya, ezért a lista a törzs első sorából címezi — és a „következő érdemi sor"
  // ugyanaz a sor volt, tehát a kártya mindent kétszer mondott. Ha nincs MÁS
  // mondanivaló, az előnézet ÜRES: egy üres sor őszintébb, mint egy visszhang.
  // ⚠️ A cím 90 karakternél csonkolhat, ezért ELŐTAG-ra is illeszkedik, nem csak
  // egyezésre — különben egy hosszú első sor megint duplán állna ott.
  const echoes = (l: string): boolean => l === title || l.startsWith(title.replace(/…$/, ""));
  return meat.find((l) => !echoes(l)) ?? "";
}

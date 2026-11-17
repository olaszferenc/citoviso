// ADR-0430 — the CAPTION of the mock's image on Viber / WhatsApp (the S10 sends both as ONE
// message). Kept out of draft.ts on purpose: draft.ts holds the cold LETTER's wording, whose
// fingerprint the landlord-eyed letter critic pins (src/outreach/letterCritic.ts); this text
// is the messenger twin of the companion SMS, not part of the letter.
//
// Same invitation and link as the companion SMS, but it points at "the plan in the picture",
// not at "the MMS we just sent". A messenger has no segment price, so the text keeps its
// accents and the name is never shortened. The legal mandatories ride one click away on the
// linked page, exactly as for the companion SMS (ADR-0112).

import { T } from "../i18n/mail.js";
import { collectFallbacks } from "../i18n/packs.js";
import { DEFAULT_LANG } from "../i18n/lang.js";
import { planCountOf, smsDraftParts, smsInvite, type DraftInput, type SmsDraft } from "./draft.js";

export function renderMessengerCaption(d: DraftInput): SmsDraft {
  // ORSZÁG-RÉTEG 3/5: the caption carries its Hungarian fallbacks — the §C gate refuses a
  // foreign caption with any (only the country's language goes out).
  const { value, fallbacks } = collectFallbacks(() => captionText(d));
  return d.lang !== DEFAULT_LANG ? { ...value, untranslated: fallbacks } : value;
}

function captionText(d: DraftInput): SmsDraft {
  const { link, unsubscribeLink } = smsDraftParts(d);
  const plans = planCountOf(d);
  const invite = smsInvite(d, "formal");
  const name = d.leadName;
  const text =
    plans === 3
      ? T(d.lang, "{name} – a képen látható terv mellé még kettőt készítettünk: mindhármat {invite} A Citoviso csapata\n{link}", { name, link, invite })
      : plans === 2
        ? T(d.lang, "{name} – a képen látható terv mellé még egyet készítettünk: mindkettőt {invite} A Citoviso csapata\n{link}", { name, link, invite })
        : T(d.lang, "{name} – a képen látható honlap-látványtervet {invite} A Citoviso csapata\n{link}", { name, link, invite });
  return { text, link, unsubscribeLink };
}

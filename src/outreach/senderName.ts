// The brand-vs-person reading of OUTREACH_SENDER_NAME, shared by the letter critic and the
// e-mail signature (src/email/signature.ts). Kept in its own text-free module so the mail
// adapter does not pull the critic (and its Hungarian prompt text) into the i18n scope.

/**
 * The PERSONAL part of the configured sender name — the brand is not a person. Owner's
 * ruling (K3, 2026-10-03): the letter signs „Citoviso”, so OUTREACH_SENDER_NAME may hold the
 * brand. Read as a personal name it turned every brand signature into a „named” one (the
 * SMS „A Citoviso csapata” among them) and the name filter dropped the critic's
 * „sign with the brand” fix — the exact rule it exists to protect. „Olasz Ferenc, Citoviso”
 * → „Olasz Ferenc”; „Citoviso” / „citoviso.com” / „A Citoviso csapata” → "".
 */
export function personalSenderName(senderName: string | null | undefined): string {
  return (senderName ?? "")
    .replace(/(?<![\p{L}])(?:a\s+)?citoviso(?:\.com)?(?:\s+csapat(?:a)?)?(?![\p{L}])/giu, " ")
    .replace(/[\s,;·—–-]+/gu, " ")
    .trim();
}

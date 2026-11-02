// A listed amenity whose WORD reads as something else to a language model.
//
// „Fürdetőkád” (hovamenjek.hu) is a baby's bath tub — a child-care item next to the cot and the
// high chair. The writer turned it into „Fürdőkád” and „A fürdőszobában kád …” (Bagoly
// 40612ae4, 2026-11-02, coordinator): true there only because a tub shows on a photo; elsewhere
// it is a bathroom claim with no source. The label itself stays (it IS the listing's fact); every
// prompt that shows it to a model shows it with what it is.

const GLOSSES: readonly { re: RegExp; gloss: string }[] = [
  {
    re: /fürdető\s*-?\s*kád|furdeto\s*-?\s*kad|baba\s*-?\s*kád|baba\s*-?\s*kad|babafürdető|babafurdeto/iu,
    gloss: "babafürdető kád: gyerek-kellék, NEM a fürdőszoba kádja — fürdőkádat nem igazol",
  },
];

/** What a misleading label really is — null when the word says what it means. */
export function amenityGloss(label: string): string | null {
  return GLOSSES.find((x) => x.re.test(label))?.gloss ?? null;
}

/** The label as a prompt line shows it: with its gloss when the word misleads. */
export function promptAmenityLabel(label: string): string {
  const g = amenityGloss(label);
  return g ? `${label} (${g})` : label;
}

/** Is this listed label a baby's bath tub, not a bathroom's? */
export function isChildBathTub(label: string): boolean {
  return GLOSSES[0]!.re.test(label);
}

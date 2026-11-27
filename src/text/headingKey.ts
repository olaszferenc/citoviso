// One normalisation for „is this the same title?” — the generator's unique-heading pass (render.ts), the Parallax band
// caption rule and the render gate's same-heading finding (ADR-XXXX ⑨⑪).

/** A heading's text for comparison: tags out, entities and case folded, punctuation and spaces squeezed. */
export function headingKey(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}


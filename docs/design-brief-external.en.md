# Citoviso — DESIGN BRIEF for external designers / external AI

> **How to use:** paste this whole file into an AI (Claude / ChatGPT / Gemini / v0 / Lovable),
> or send it to a human designer. Attach `docs/design-brief-sample-data.json` alongside it.
> This document is self-contained — you do not need our codebase.
>
> Hungarian original: `docs/design-brief-external.md`

---

## 0. THE TASK IN ONE SENTENCE

Design **one new, complete guest-facing page IDENTITY (a template)** — as a single,
self-contained `.html` file, populated with the sample data provided — that is **visually
and distinctly different** from our 16 existing directions, while honouring the technical
contract below, so that our engine can mass-produce thousands of accommodation pages from it.

We are not asking for a picture. We are asking for **working, openable HTML**.

**Your visual freedom is total** — palette, typefaces, texture, gradients, motion, form
language are all yours. The §4 contract does not constrain the *design*; it only ensures your
design can be **re-coloured and data-filled**. If it feels restrictive, re-read §4.1 — and if
it genuinely restricts you, tell us (§3, item 3).

---

## 1. WHAT THIS COMPANY DOES

Citoviso is a **website-generation and distribution machine**. It is industry-agnostic, but
its first pilot vertical is **accommodation / hospitality**.

What it does:

1. **Data collection.** From public sources (Google Maps, booking portals) we gather the data
   of a digitally weak business: name, address, photos, amenities, description, reviews.
2. **Generation.** The engine **automatically** produces a modern, responsive,
   conversion-focused website from that. One data object + one template = a finished page.
   There is no per-property manual design work.
3. **Cold outreach.** We send the finished page to the owner (by e-mail, or by MMS with a
   screenshot of it). **They did not ask for it. They have never heard of us.**
4. **Conversion.** If they like it, they pay, the page goes live on their own domain, and
   they can then buy modular add-ons (booking calendar, multi-language, custom domain, etc.).

### Why this matters for design — this is the heart of the brief

**The generated page *is* the sales pitch.** There is no salesperson, no presentation, no
second chance. The owner opens the link on their phone and decides **within 3 seconds**
whether this looks better than what they have now (usually nothing, or a 2009 Joomla site).

Three non-negotiable consequences follow:

- **The hero (first screen) is the entire business.** No "wow" there, no second scroll.
- **Mobile-first, but not mobile-only.** The owner looks on a phone. Their *guest* often books
  on a desktop. **The two sizes are two separate design decisions** — not the same layout squashed.
- **They must recognise their own name and their own house.** A "beautiful, but it could be
  any property" template fails. The page must be **this house**, not "a house".

---

## 2. WHO LOOKS AT THE PAGE

| Audience | When | What they want |
|---|---|---|
| **The property owner** (cold lead) | first, on a phone, suspicious | "Is this really my house? Is this better than what I have? Is this professional?" |
| **The prospective guest** | after go-live, on desktop and mobile | "What's it like, what does it cost, is it free, how do I enquire?" |

You **sell to the owner and serve the guest.** These are not in conflict: what convinces the
owner is seeing that this page would convince *their* guest.

---

## 3. WHAT WE ARE CONCRETELY ASKING FOR

**One self-contained HTML file** that:

- is a single `.html`, opens with no build step (`<style>` in `<head>`, any JS inline in `<script>`),
- is populated with the **rich** data packet from `design-brief-sample-data.json`,
- **plus the same identity saved again with the data-starved (`_starvedVariant`) packet** —
  see §7.4. Two files: `<name>-rich.html`, `<name>-starved.html`.
- Google Fonts via `<link>` is allowed; no other external dependency.
- Images: use the `url` fields from the JSON (placeholder service) — don't add your own.

Plus **half a page of text** (`README.md` or a comment at the top of the HTML), with three points:

1. what the form language is about, and the **one** thing that makes it unlike the others;
2. what kind of property character it suits (e.g. "urban boutique hotel", "waterfront
   apartment", "mountain guesthouse");
3. **what you could not express** under the 11 design roles (see the end of §4.1) — if anything.
   This is not a complaints box: it is how we extend the system.

> **Note on language:** the sample copy is in Hungarian on purpose — that is the real market,
> with real string lengths. You do not need to understand it. Rough glossary: `name` = property
> name, `tagline` = subtitle, `intro` = introduction, `highlights` = amenity/feature list,
> `rooms` = rooms/apartments (`capacity`, `price`), `reviews` = guest quotes,
> `stats` = headline numbers, `faqs` = Q&A, `contact` = phone/e-mail/address, `place` = city/country.

---

## 4. TECHNICAL CONTRACT (this is binding, not advisory)

The engine will turn your HTML into a **template**, so we require things that can be checked
mechanically. If these are missing, the design cannot be built in.

### 4.1 Design tokens — 11 ROLE NAMES, not 11 restrictions

> ⚠️ **Read this section carefully, because at a glance it looks like a restriction, and it isn't.**
> Your palette, your typefaces, your form language are **entirely your invention.** We ask for
> exactly one thing: **name** them in `:root` using the 11 role names below.

```css
:root {
  /* YOUR palette. These are ROLES, not prescribed values — put anything in. */
  --cit-accent:        /* action / highlight colour */
  --cit-on-accent:     /* legible text on the accent */
  --cit-ink:           /* primary text colour */
  --cit-muted:         /* secondary text, captions */
  --cit-bg:            /* page background */
  --cit-surface:       /* card / panel background */
  --cit-line:          /* rule, border, divider */
  --cit-radius:        /* corner-radius base unit */
  --cit-font-display:  /* display / heading typeface */
  --cit-font-body:     /* body typeface */
  --cit-shadow:        /* elevation / shadow */
}
```

**Why this exists — and why it is NOT what makes pages uniform:**

`--cit-accent` is **sampled at runtime from the property's own photos**, and 19 ready-made
palettes ("skins") can also be applied to the same template. That is the only reason the
waterfront villa's page isn't the same colour as the mountain guesthouse's. If you bake hex
values into the CSS, then **thousands of properties ship in your colours, identically** — that
is the guaranteed-mechanical outcome, not the token.

#### What this EXPLICITLY ALLOWS

The 11 tokens are the palette. **The character is your CSS.** All of the following are free,
and in fact wanted:

- **gradients, texture, noise, paper grain, `mix-blend-mode`, SVG background patterns, masks, `filter`**
- **animation, `@keyframes`, parallax, Ken Burns, hover micro-interactions**
- **your own CSS custom properties**, any number (e.g. `--paper`, `--glow`, `--stripe`)
- **custom shapes**: angled section cuts, arcs, blobs, frame ornaments, rotated elements
- **photo treatment**: duotone, sepia, grain, crops, masked shapes

Our only request: where *colour* is involved, derive it from the tokens so it stays re-colourable:

```css
:root {
  --paper: color-mix(in srgb, var(--cit-bg) 92%, var(--cit-ink));
  --glow:  color-mix(in srgb, var(--cit-accent) 40%, transparent);
}
.hero::after {
  background:
    radial-gradient(60% 50% at 50% 0%, var(--glow), transparent 70%),
    url("data:image/svg+xml,<svg …>noise pattern</svg>");
  mix-blend-mode: soft-light;
}
@keyframes drift { … }
```

This is not a theoretical concession — our own templates live this way: `artdeco` uses SVG
texture in 9 places, `aurora` has 3 animations, `scrapbook` has 4 gradients, and each derives
from the tokens via `color-mix` in 11–30 places.

**The single actual prohibition:** no **baked-in hex** in the CSS that isn't derived from a
token and isn't neutral (white / black / transparent). If a colour is "the soul of this
design", put it in `:root` as your own variable, derived from a token.

**Self-test, please run it:** swap the 11 token values for a dark set (e.g. `--cit-bg:#12100e`,
`--cit-ink:#f3ece2`, `--cit-accent:#c8a45c`). If the page re-dresses and stays intact, good.
If it falls apart, there's a baked colour somewhere.

#### And if 11 roles aren't enough?

**That can happen, and we want to know.** Today there is exactly one accent colour — a design
built on "two strong colours against each other" will feel that. If your form language needed
a role we don't have (a second accent, a gradient pair, a texture slot), **don't stay silent
and don't quietly work around it**: solve it with your own variable, and **write in your
hand-off notes what was missing.** That is concrete input for extending the vocabulary.

### 4.2 Sections — these 9 building blocks exist

These are the section types the engine can fill from data. There are no others.

| kind | contains | required? |
|---|---|---|
| `hero` | name, tagline, main photo, primary CTA | **YES, always first** |
| `features` | intro copy + amenities / highlights | if data exists |
| `stats` | 2–4 large numbers (rating, room count, year founded) | if data exists |
| `gallery` | photo grid / mosaic | if ≥1 photo |
| `rooms` | room / apartment cards (name, capacity, price, photo) | if data exists |
| `reviews` | guest quotes with author | if data exists |
| `faq` | questions and answers | if data exists |
| `location` | map + directions + contact | if address/coordinates exist |
| `enquiry` | **enquiry / booking form** — the conversion spine | **YES, always** |

**Key rule:** *data exists → the section appears; no data → the section is OMITTED.*
Never an empty section, an empty frame, a "Coming soon" label, or invented filler.

### 4.3 Module hooks — marking the behavioural parts

Put stable data attributes on the dynamic parts, because the engine swaps them for real
widgets at runtime:

```html
<section data-cit-module="booking"  data-cit-variant="bar">…</section>
<section data-cit-module="gallery">…</section>
<section data-cit-module="reviews">…</section>
<section data-cit-module="map">…</section>
```

### 4.4 Fully functional without JavaScript

The page must work end-to-end **with JS disabled**: all content visible, the enquiry form
submittable (`mailto:` or a plain `POST` fallback), no empty bands.

- Build scroll animation as **progressive enhancement only**: content is visible by default,
  JS *adds* the animation — not the other way round. (This was a measured, real failure for us:
  we shipped blank pages to JS-less clients.)
- Carousel / lightbox: fall back to a simple scrollable strip or a grid without JS.

### 4.5 Two sizes, two designs

- **Mobile: 390 px wide.** This is where the owner looks. This is where it's decided.
- **Desktop: 1440 px.** This is where the guest books. Don't make it a "wide mobile": the extra
  space should carry content (two-column body, sticky sidebar, larger gallery rhythm).
- Hero height: `100svh`, `min-height: 640px`.
- On mobile the primary CTA should be reachable without scrolling (e.g. a fixed bottom bar) —
  **but the full booking form must NOT be on the first screen** (see §5).

### 4.6 Copy and icons

- **No emoji.** Every icon is inline SVG with `stroke="currentColor"` so it inherits the token.
- Labels are Hungarian in the sample, but the system translates them — **do not design a layout
  that only holds together with short Hungarian words** (German/Polish can be 40% longer).
- **The property name dominates the first screen.** No separate corner logo in the hero: there
  is one emphasis, and it is the name.

---

## 5. DRAMATURGY — section order is not a matter of taste

The page is an arc of persuasion. **In this order:**

1. **Seduction** — hero, photos, atmosphere. We ask nothing of the visitor here.
2. **Offer** — what they get: rooms, services, prices.
3. **Trust** — reviews, real numbers, location and access.
4. **Conversion** — **here**, in the lower, decision zone of the page, stands the full
   enquiry / booking surface.

⛔ **A full booking form on the first screen is forbidden.** This produced a concrete
owner rejection for us: you cannot ask for a booking before you have built desire. A primary
CTA button may sit at the top (it jumps to the form) — the form itself may not.

---

## 6. PROHIBITIONS — summary

| ⛔ Forbidden | Why |
|---|---|
| Emoji as icons | Amateur impression; inline SVG is the standard |
| Baked hex in the CSS not derived from a token | Kills the 19 palettes; the photo-derived accent can't apply (§4.1 — gradients/texture/animation are still free!) |
| Invented facts (price, m², ★, award, distance, year) | §7.1 — legal and trust risk |
| Empty section / "Coming soon" / lorem ipsum | This is a live offer, not a portfolio piece |
| Fixed heights that hold empty space | Sections must hug their content, especially on mobile |
| Full booking form on the first screen | Destroys the conversion arc (§5) |
| JS-only content | We would ship a blank page |
| External CSS/JS frameworks (Tailwind CDN, Bootstrap, React) | The output is static HTML; the engine turns it into a template |
| A corner logo next to the name in the hero | Two emphases = no emphasis |

---

## 7. WHY MOST DESIGNS FAIL FOR US

Read these four points twice. Every external and internal failure we've had traces back here.

### 7.1 Fact fidelity — we never invent a fact

Price, square metres, room count, star rating, awards, "200 m from the beach", year founded:
**only from a real source.** If there is no data, the section is omitted — we do not guess and
we do not embellish. Principle: **"uncertainty → less, never false."**

For you this means: the design must have **no place that lies when it's empty**. A "★★★★★"
decoration that shows five stars even when the rating is 3.8 is a disqualifier.

### 7.2 The designer is free on STRUCTURE, bound on FACTS

Structure, rhythm, palette, typography, layout: entirely your territory, entirely free.
Numbers and claims: not.

### 7.3 Generic filler is fatal

"Pleasant surroundings", "family atmosphere", "spacious garden and private parking" — these
hurt because they are true of *any* property. The design needs **a place for the specific**:
the property's unique, differentiating fact (we call it the "core": e.g. *"deer-watching from
the hot tub"*, *"the same family since 1928"*, *"private beach"*). Give it prominent visual space.

### 7.4 ⚠️ THE DATA-STARVED CASE IS THE REAL TEST

**About 85% of our leads have barely any data.** No room list, no reviews, no prices,
two mediocre photos. **A page that sells still has to go out.**

This is our most expensive lesson: all design happens on the rich data, and the starved branch
becomes the blind spot — exactly where the output is worst.

Hence the **mandatory second file** (`-starved.html`) using the JSON's `_starvedVariant` packet:
2 photos, 3 highlights, no rooms, no reviews, no prices, no stats, no FAQ.

Acceptance condition: **this variant must also be a complete page, not a truncated one.** No
empty bands, no hollow feeling, no sense that "something is missing". If your form language
only works with 6 photos and 3 rooms, the design is unusable for us.

---

## 8. THE QUALITY BAR

### 8.0 The three biggest levers of "wow" — be bold here

The goal is not a "decent website" but making the owner gasp. In our experience it is decided
on these three points, and **none of them is constrained by the token contract**:

1. **Photo treatment.** Raw, mediocre photos are our biggest enemy. Duotone, grain, strong scrim
   dramaturgy, masked shapes, crops, `mix-blend-mode` — these turn a weak image into a mood.
   This is the biggest lever and the least exploited.
2. **Typographic ambition.** The hero numbers below are **floors, not ceilings.** If your form
   language supports it, go to `clamp(48px, 12vw, 160px)`, cut type into the image, use spaced
   caps section numbering, work with negative space.
3. **Motion and depth.** Parallax, Ken Burns, scroll-driven layer offset, hover elevation.
   (⚠️ The page must stand without JS — §4.4 — and must stop under `prefers-reduced-motion`.)

### 8.1 Baseline bar

What we consider a "finished, professional page" (distilled from our own reference set):

**Hero**
- `height: 100svh; min-height: 640px`, full-bleed photo
- gradient scrim over the photo so the text stays legible **on any light photo**
  (worst-case contrast ≥ 3.0 — we measure this mechanically)
- eyebrow: 12–13 px, `letter-spacing: 5px`, uppercase, in the accent colour
- display heading: **at least** `clamp(40px, 7vw, 78px)`, `line-height: ~1.05`, max ~14–16 characters per line
- CTA pair: filled + outlined, `padding: 15px 34px`, uppercase, `letter-spacing: 2.5px`

**Typography**
- Display + body pairing (typically serif display + sans body, but that is up to you)
- Every section head: eyebrow (accent, letter-spaced, uppercase) → large h2 `clamp(30px, 4.5vw, 50px)`

**Rhythm and detail**
- Section padding: 90–110 px top/bottom
- Hover micro-interactions: image zoom `scale(1.04)`, card lift
- Cards: `border-radius: 6–16px`, subtle `box-shadow`
- Sticky navigation + a rich footer (this creates the "frame", the "this is a real site" feeling)

**Richness**
The sense of completeness comes from the section set: nav → hero → intro + amenity grid with
icons → room cards with prices → gallery mosaic → review band → FAQ → map + contact →
**enquiry** → footer.

---

## 9. WHAT ALREADY EXISTS — don't bring these again

The goal is **variety**: two properties in the same region must not look alike. These 16
directions are therefore taken. If your idea is a variant of one of them, drop it.

| # | Direction | Form language |
|---|---|---|
| 1 | `fullbleed` | Full-screen hero, glass booking bar |
| 2 | `dark-luxury` | Dark luxury, cinematic, brass accent |
| 3 | `card-sidebar` | Photo-mosaic header, sticky booking card (listing style) |
| 4 | `editorial` | Newspaper masthead, drop cap, contact-sheet gallery |
| 5 | `parallax` | Immersive parallax panels, dot nav, stat band |
| 6 | `brutalism` | Thick borders, acid accent, marquee |
| 7 | `dopamine` | Vivid, playful, sticker style |
| 8 | `horizontal` | Horizontally scrolling chapters / room rail, dark literary |
| 9 | `cinematic` | Ken Burns crossfade hero, sticky booking dock |
| 10 | `transit` | Dark departure board / kiosk, units in a table |
| 11 | `organic` | Anti-grid scattered cards, blob shapes, loam-moss-linen |
| 12 | `artdeco` | Centred poster hero, midnight-blue and brass, deco ornament |
| 13 | `scrapbook` | Paper memory book, taped polaroids, handwriting |
| 14 | `watercolor` | Soft watercolour aqua-coral, wave dividers |
| 15 | `aurora` | Dark glass app, animated aurora background, hero dashboard |
| 16 | `claymorphism` | Neumorphic clay surface, soft wellness |

**Directions we'd happily go (suggestions only, not required):** Swiss/grid typographic rigour ·
retro print (risograph, offset misregistration) · terminal / monospace data aesthetic ·
botanical atlas / engraved illustration · Japanese ryokan minimalism (*ma*, negative space) ·
map / cartography-driven · wine-label heraldry · printed textile / indigo resist-dye motif.

---

## 10. HAND-OFF AND ACCEPTANCE

**What you deliver:**

1. `<name>-rich.html` — with the rich data packet
2. `<name>-starved.html` — with the data-starved packet
3. Half a page of notes: the essence of the form language, who it suits, the one
   differentiating idea, and what you couldn't express under the 11 roles

**Acceptance checklist** — this is what the review runs through:

- [ ] Opens with no build step and no console errors
- [ ] `:root` declares all 11 `--cit-*` roles (**with your values**), and there is no baked hex
      in the CSS that isn't derived from a token
- [ ] Swapping the 11 tokens for a dark set re-dresses the page and leaves it intact
- [ ] The notes answer: **what you couldn't express under the 11 roles** (or that nothing was missing)
- [ ] 390 px and 1440 px: each is an independent, considered layout
- [ ] JS disabled: all content visible, no empty bands, the form is submittable
- [ ] `hero` is first; `enquiry` is present; the full form is NOT on the first screen
- [ ] `data-cit-module` hooks on the dynamic sections
- [ ] No emoji; every icon is inline SVG using `currentColor`
- [ ] No invented number, price, star or award beyond the sample
- [ ] **The data-starved variant is also a complete page** (this is the most common failure)
- [ ] Visually not one of the sixteen directions in §9

**Review:** we screenshot both HTML files at 390 px and 1440 px, run them through a mechanical
design checker (token completeness, emoji, empty bands, hero contrast), and the owner decides
from the images. We may ask for a revision round.

---

## 11. LEGAL / DATA-PROTECTION NOTE

The photo URLs in the sample are placeholders. In live operation we track the legal status of
every image (owner / portal / Google Places / Street View), and the page sent in cold outreach
states in its footer that it is a **preview draft**, not the property's official site. All this
means for you: **leave room in the footer for such a marker band.**

---

*Questions welcome — the brief can be clarified. What is NOT negotiable: the token contract
(§4.1), fact fidelity (§7.1), functioning without JS (§4.4), and the data-starved variant (§7.4).*

// The "core" data object. One accommodation = one Property record.
// The template engine turns this into a full site; a new accommodation is a new
// record, not new code. Fields mirror what we can actually gather from Maps +
// booking portals (see src/scrape).

/** Where an image came from — decides whether it may go live. */
export type ImageSource = "owner" | "guest" | "portal" | "generated";

export interface PropertyImage {
  url: string;
  /** Legal provenance. Only `owner` (and explicit permission) may go live. */
  source: ImageSource;
  /** Optional role hint: exterior | living | bedroom | kitchen | bath | view | garden. */
  role?: string;
  alt?: string;
}

export interface Contact {
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}

/** An amenity line: an icon id from the SVG sprite + a label. NO emojis. */
export interface Amenity {
  icon: string;
  label: string;
}

/** Colour palette extracted from the property's own photos (see analyze step). */
export interface Palette {
  primary: string;
  primary2: string;
  accent: string;
  ink: string;
  cream: string;
  cream2: string;
  muted: string;
}

/** The distinctive, real, property-specific block — never generic filler. */
export interface UniqueSpotlight {
  /** Short nav/section label, e.g. "A névadó lugas". */
  label: string;
  title: string;
  body: string;
  imageUrl?: string;
  chips: Amenity[];
}

export interface Property {
  slug: string;
  name: string;
  location: string;
  headline: string;
  lead: string;
  capacity: number;
  contact: Contact;
  amenities: Amenity[];
  images: PropertyImage[];
  unique: UniqueSpotlight;
  /** Optional verbatim guest review + score, when a real one exists. */
  review?: { quote: string; score: string; source: string };
  palette: Palette;
  /** Style preset chosen from the photos, e.g. "rustic" | "modern" | "lakeside". */
  stylePreset: string;
}

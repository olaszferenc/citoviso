-- Unit CONTENT: what makes a room worth its own page (ADR-0044/d).
--
-- A unit was name + capacity + description + price. That is too thin for a guest to
-- choose between four apartments, and far too thin for a subpage: a near-empty page
-- is not an SEO win, it is thin content, and four similar ones read as duplicates.
-- So the content comes FIRST and the subpage is built on top of it.
--
-- `slug` is the subpage address. Generated from the name, but stored rather than
-- derived on the fly: a URL that silently changes when the owner renames a room
-- would break every link and every indexed result pointing at it.
--
-- Photos are NOT stored here. They live in the site's photo list (site.edited_site_data)
-- and carry an assignment instead — one shared library, so the owner uploads a photo
-- once and marks which unit it belongs to, rather than uploading it twice.

ALTER TABLE site_unit ADD COLUMN IF NOT EXISTS slug text;
-- Amenities of THIS unit (own bathroom, terrace, air conditioning…), as an ordered
-- list of the owner's own words. Site-wide amenities stay on the amenities module.
ALTER TABLE site_unit ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Unique per site, not globally: two different guesthouses may both have a "padlasszoba".
CREATE UNIQUE INDEX IF NOT EXISTS site_unit_slug_idx
  ON site_unit (site_id, slug) WHERE slug IS NOT NULL;

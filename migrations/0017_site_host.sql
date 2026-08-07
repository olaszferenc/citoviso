-- 0017 site hosting identity (ADR-0020 "site-domain mezők", the last go-live gap).
-- A paid, LIVE site was only reachable on its opaque token URL (/site/<token>) —
-- <slug>.citoviso.com fell through to the public homepage because nothing mapped a
-- Host header to a tenant site. These two columns are that mapping.
--
-- slug: the platform subdomain label (<slug>.citoviso.com). Assigned at provisioning
-- from the business name, unique platform-wide, STABLE afterwards (it is a public URL).
-- custom_domain: the tenant's own domain once registered through us (ADR-0020 upsell);
-- NULL until then. Both are nullable so legacy rows stay valid.
ALTER TABLE site
  ADD COLUMN slug          text,
  ADD COLUMN custom_domain text;

-- Case-insensitive uniqueness: hostnames are case-insensitive, so the index is the
-- real guarantee (a partial index lets many rows keep NULL).
CREATE UNIQUE INDEX site_slug_key ON site (lower(slug)) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX site_custom_domain_key ON site (lower(custom_domain)) WHERE custom_domain IS NOT NULL;

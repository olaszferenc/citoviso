// Deterministic legal texts (03-INVARIANTS §H.22: legal wording is NEVER
// AI-generated at runtime — it lives here, versioned, and the accepted version
// is stamped onto the record that carries the acceptance).

/**
 * §A photo-rights self-declaration, accepted at order submit. Covers the three
 * mandatory elements: possession of rights, warranty, indemnification.
 */
export const PHOTO_RIGHTS_DECLARATION_V1 =
  "Kijelentem, hogy a honlapomon megjelenítendő fényképek tekintetében " +
  "felhasználási joggal rendelkezem, vagy az élesítésig saját, jogtiszta " +
  "képeket töltök fel. Szavatolom, hogy az általam jóváhagyott képek " +
  "felhasználása harmadik személy jogát nem sérti, és vállalom, hogy az ebből " +
  "eredő igények alól a Citoviso-t mentesítem (kártalanítás).";

/**
 * Consumer waiver of the withdrawal right, accepted by 'individual' buyers at
 * order submit (0029).
 *
 * WHY IT IS MANDATORY: we go live immediately on payment, i.e. we begin (and
 * complete) performance inside the 14-day withdrawal window. Under 45/2014.
 * (II. 26.) Korm. r. 29. § (1) a) the consumer only loses the withdrawal right
 * if they gave EXPRESS PRIOR consent to start performance AND acknowledged the
 * forfeiture. Without this record a consumer could withdraw for 14 days after
 * their site was built and demand a full refund.
 *
 * Business ('business') buyers are not consumers — this is NULL for them.
 */
export const WITHDRAWAL_WAIVER_V1 =
  "Kifejezetten kérem és hozzájárulok, hogy a Citoviso a szolgáltatás " +
  "teljesítését — a honlapom elkészítését és élesítését — a 14 napos elállási " +
  "határidő lejárta előtt, a fizetést követően azonnal megkezdje. Tudomásul " +
  "veszem, hogy a szolgáltatás egészének teljesítését követően a 45/2014. " +
  "(II. 26.) Korm. rendelet 29. § (1) bekezdés a) pontja alapján az elállási, " +
  "illetve felmondási jogomat elveszítem.";

/**
 * ÁSZF + privacy-notice acceptance, accepted by BOTH buyer types (0029).
 *
 * ⚠️ PILOT BLOCKER: the ÁSZF document itself DOES NOT EXIST yet (only
 * /adatvedelem is published — see _planning/PILOT.md §7d item 4). This constant
 * is the wording we stamp onto the order; the configurator only renders the
 * acceptance row when a real terms URL is configured, because a tick-box
 * pointing at a missing document is worse than no tick-box at all. Publish the
 * ÁSZF before the first live sale.
 */
export const TERMS_ACCEPTANCE_V1 =
  "Elfogadom a Citoviso Általános Szerződési Feltételeit, és megismertem az " +
  "Adatkezelési tájékoztatót.";

// One entry per source host, ported from kosmographica-app/sources-registry.json
// (the shared registry). Every source URL the app shows must resolve here, so
// each claim can carry a credit and a licence. `verified` is false until a human
// reads the source's current terms; the text is a working draft, not legal advice.
import type { KosmoTrustTier } from "../../schema/kosmo.js";

export interface KosmoSourceRegistryEntry {
  /** Stable key; the hostname for URL-based sources. */
  key: string;
  name: string;
  publisher: string;
  credit: string;
  licence: string;
  licenceUrl: string | null;
  trustTier: KosmoTrustTier;
  /** ISO date the source was read, when known. */
  retrievedAt: string | null;
  verified: boolean;
}

export const SOURCE_REGISTRY: readonly KosmoSourceRegistryEntry[] = [
  {
    key: "exoplanetarchive.ipac.caltech.edu",
    name: "NASA Exoplanet Archive",
    publisher: "NASA / Caltech IPAC",
    credit:
      "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.",
    licence: "NASA data, acknowledgement requested",
    licenceUrl:
      "https://exoplanetarchive.ipac.caltech.edu/docs/acknowledgements.html",
    trustTier: "primary",
    retrievedAt: null,
    verified: false,
  },
  {
    key: "nssdc.gsfc.nasa.gov",
    name: "NASA NSSDCA Planetary Fact Sheet",
    publisher: "NASA Space Science Data Coordinated Archive",
    credit:
      "Data: NASA Space Science Data Coordinated Archive (NSSDCA), Planetary Fact Sheet.",
    licence: "NASA content, credit requested",
    licenceUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    trustTier: "primary",
    retrievedAt: null,
    verified: false,
  },
  {
    key: "data.desi.lbl.gov",
    name: "DESI Data Release 1 (Dark Energy Spectroscopic Instrument)",
    publisher: "DESI Collaboration / Lawrence Berkeley National Laboratory",
    credit:
      "Data: DESI DR1, DESI Collaboration et al. 2026, AJ 171, 285. The DESI collaboration acknowledges DOE contract DE-AC02-05CH11231, the NSF, NERSC and the Kitt Peak / Tohono O'odham sites; the full acknowledgement text is on the linked page.",
    licence: "CC BY 4.0",
    licenceUrl: "https://data.desi.lbl.gov/doc/acknowledgments/",
    trustTier: "primary",
    retrievedAt: null,
    verified: false,
  },
  {
    key: "www.wikidata.org",
    name: "Wikidata",
    publisher: "Wikimedia Foundation",
    credit: "Data from Wikidata.",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    trustTier: "structured",
    retrievedAt: null,
    verified: false,
  },
  {
    key: "en.wikipedia.org",
    name: "Wikipedia",
    publisher: "Wikimedia Foundation",
    credit: "Adapted from Wikipedia, the free encyclopedia, by its contributors.",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    trustTier: "tertiary",
    retrievedAt: null,
    verified: false,
  },
];

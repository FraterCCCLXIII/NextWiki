/**
 * Licence rules for the University: what we may adapt, and what a lesson that adapts several
 * sources must itself be published under.
 *
 * The portal is non-commercial and free: no ads, no paywall, no sponsorship. That is what
 * lets us adapt NonCommercial (NC) material. If the portal ever stops being non-commercial,
 * flip POLICY.nonCommercial and every NC-derived lesson is flagged by the gate.
 *
 * NoDerivatives (ND) and licences we cannot identify are never adaptable: link to them.
 *
 * Pure: no filesystem, no database. The ledger of ingested sources is sources.json, loaded by
 * sources.ts.
 */

export const POLICY = {
  /** The portal is free and non-commercial, so NC-licensed material may be adapted. */
  nonCommercial: true,
} as const;

export type LicenseInfo = {
  id: string;
  name: string;
  url: string;
  /** Attribution is required (every licence except CC0 and public domain). */
  by: boolean;
  /** Derivatives must carry the same licence. */
  shareAlike: boolean;
  /** Commercial use is forbidden. */
  nonCommercial: boolean;
  /** Adaptations are forbidden: link, never copy. */
  noDerivs: boolean;
  /** Can be adapted at all, ignoring the site policy. */
  adaptable: boolean;
};

const cc = (
  id: string,
  name: string,
  path: string,
  f: { sa?: boolean; nc?: boolean; nd?: boolean },
): LicenseInfo => ({
  id,
  name,
  url: `https://creativecommons.org/${path}`,
  by: true,
  shareAlike: !!f.sa,
  nonCommercial: !!f.nc,
  noDerivs: !!f.nd,
  adaptable: !f.nd,
});

export const LICENSES: Record<string, LicenseInfo> = Object.fromEntries(
  [
    {
      id: "CC0",
      name: "CC0 1.0 Public Domain Dedication",
      url: "https://creativecommons.org/publicdomain/zero/1.0/",
      by: false,
      shareAlike: false,
      nonCommercial: false,
      noDerivs: false,
      adaptable: true,
    },
    {
      id: "PD",
      name: "Public domain (no known copyright, or US government work)",
      url: "https://creativecommons.org/publicdomain/mark/1.0/",
      by: false,
      shareAlike: false,
      nonCommercial: false,
      noDerivs: false,
      adaptable: true,
    },
    {
      id: "OGL-3.0",
      name: "Open Government Licence v3.0 (UK)",
      url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      by: true,
      shareAlike: false,
      nonCommercial: false,
      noDerivs: false,
      adaptable: true,
    },
    cc("CC-BY-3.0", "CC BY 3.0", "licenses/by/3.0/", {}),
    cc("CC-BY-4.0", "CC BY 4.0", "licenses/by/4.0/", {}),
    cc("CC-BY-SA-3.0", "CC BY-SA 3.0", "licenses/by-sa/3.0/", { sa: true }),
    cc("CC-BY-SA-4.0", "CC BY-SA 4.0", "licenses/by-sa/4.0/", { sa: true }),
    cc("CC-BY-NC-3.0", "CC BY-NC 3.0", "licenses/by-nc/3.0/", { nc: true }),
    cc("CC-BY-NC-4.0", "CC BY-NC 4.0", "licenses/by-nc/4.0/", { nc: true }),
    cc("CC-BY-NC-SA-3.0", "CC BY-NC-SA 3.0", "licenses/by-nc-sa/3.0/", { nc: true, sa: true }),
    cc("CC-BY-NC-SA-4.0", "CC BY-NC-SA 4.0", "licenses/by-nc-sa/4.0/", { nc: true, sa: true }),
    cc("CC-BY-ND-4.0", "CC BY-ND 4.0", "licenses/by-nd/4.0/", { nd: true }),
    cc("CC-BY-NC-ND-4.0", "CC BY-NC-ND 4.0", "licenses/by-nc-nd/4.0/", { nc: true, nd: true }),
    {
      // Free to read on the source's own terms, but no open licence: link only.
      id: "TOS",
      name: "Free to use under the publisher's terms (no open licence)",
      url: "",
      by: true,
      shareAlike: false,
      nonCommercial: false,
      noDerivs: true,
      adaptable: false,
    },
  ].map((l) => [l.id, l] as const),
);

export const isKnownLicense = (id: string) => id in LICENSES;

/** May lessons adapt text or media under this licence, given the site policy? */
export function isAdaptable(id: string, policy = POLICY): boolean {
  const l = LICENSES[id];
  if (!l || !l.adaptable) return false;
  if (l.nonCommercial && !policy.nonCommercial) return false;
  return true;
}

/** Every licence we may adapt under the current policy. */
export const adaptableLicenses = (policy = POLICY): Set<string> =>
  new Set(Object.keys(LICENSES).filter((id) => isAdaptable(id, policy)));

export type Resolution = {
  /** The licence the derived work must be published under, or null if the mix is impossible. */
  license: string | null;
  /** Reasons the mix is impossible (blocks the lesson). */
  errors: string[];
  /** Things a reviewer should look at (mixed versions, etc.). */
  warnings: string[];
};

const DEFAULT = "CC-BY-4.0";

/**
 * The licence for a work that adapts the given licences. Only adapted sources count: a source
 * that is merely cited or linked imposes nothing.
 *
 * Rules (summary of the CC compatibility chart):
 *  - nothing adapted -> CC BY 4.0 (our default)
 *  - one ShareAlike licence -> that licence; BY-SA and BY-NC-SA cannot be mixed
 *  - NC anywhere -> the result is NC
 *  - two different ShareAlike licences are incompatible, except BY-SA 3.0 + 4.0 (-> 4.0)
 *  - NC without SA -> CC BY-NC 4.0
 */
export function resolveLicense(adapted: string[], policy = POLICY): Resolution {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unique = [...new Set(adapted)];

  for (const id of unique) {
    if (!isKnownLicense(id)) errors.push(`unknown licence "${id}"`);
    else if (!isAdaptable(id, policy)) {
      const l = LICENSES[id]!;
      errors.push(
        l.noDerivs
          ? `${l.name} forbids adaptation: link it instead of copying`
          : `${l.name} is NonCommercial and the portal is not configured as non-commercial`,
      );
    }
  }
  if (errors.length) return { license: null, errors, warnings };

  const infos = unique.map((id) => LICENSES[id]!);
  const sa = infos.filter((l) => l.shareAlike);
  const nc = infos.some((l) => l.nonCommercial);
  const ncSa = sa.filter((l) => l.nonCommercial);
  const plainSa = sa.filter((l) => !l.nonCommercial);

  if (ncSa.length && plainSa.length) {
    return {
      license: null,
      errors: [
        `${ncSa.map((l) => l.name).join(", ")} and ${plainSa.map((l) => l.name).join(", ")} cannot be combined: BY-SA and BY-NC-SA are incompatible`,
      ],
      warnings,
    };
  }
  if (sa.length) {
    const versions = new Set(sa.map((l) => l.id.slice(-3)));
    if (versions.size > 1) {
      warnings.push(`mixes ShareAlike versions (${sa.map((l) => l.name).join(", ")}); publishing as 4.0, verify the sources allow it`);
    }
    // One ShareAlike version: keep it. Mixed versions: 4.0.
    if (versions.size === 1) return { license: sa[0]!.id, errors, warnings };
    return { license: ncSa.length ? "CC-BY-NC-SA-4.0" : "CC-BY-SA-4.0", errors, warnings };
  }
  if (nc) return { license: "CC-BY-NC-4.0", errors, warnings };
  return { license: DEFAULT, errors, warnings };
}

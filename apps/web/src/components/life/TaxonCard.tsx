import Link from "next/link";
import { Pill } from "@repo/ui";

export type TaxonCardData = {
  href: string;
  name: string;
  commonName: string | null;
  rank: string;
  speciesCount: number | null;
  imageUrl: string | null;
  extinct?: boolean | null;
};

export function TaxonCard({ t }: { t: TaxonCardData }) {
  return (
    <Link
      href={t.href}
      className="group flex flex-col gap-2 rounded-md border border-kosmo-line bg-kosmo-panel p-4 hover:border-kosmo-mint"
    >
      {t.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.imageUrl} alt="" loading="lazy" className="h-32 w-full rounded object-cover" />
      ) : null}
      <span className="text-xl font-semibold text-kosmo-text group-hover:text-kosmo-mint">{t.commonName ?? t.name}</span>
      {t.commonName ? <span className="text-base italic text-kosmo-dim">{t.name}</span> : null}
      <span className="mt-auto flex flex-wrap items-center gap-2 text-sm text-kosmo-dim">
        <Pill>{t.rank}</Pill>
        {t.extinct ? <Pill tone="amber">extinct</Pill> : null}
        {t.speciesCount ? <span>{t.speciesCount.toLocaleString()} species</span> : null}
      </span>
    </Link>
  );
}

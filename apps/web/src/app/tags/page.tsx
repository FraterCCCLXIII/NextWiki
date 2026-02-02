import Link from "next/link";
import { MainLayout } from "~/components/layout/MainLayout";
import { dbService } from "~/lib/services";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function TagsPage() {
  const tags = await dbService.tags.getAll();

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Tags</h1>
          <p className="text-text-secondary mt-2 text-sm">
            Browse wiki pages by tags.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.name}`}
              className="hover:border-primary hover:bg-background-level1 block rounded-lg border border-border-light p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">{tag.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

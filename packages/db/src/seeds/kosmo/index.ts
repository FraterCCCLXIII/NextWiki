import type { Db } from "./util.js";
import { ensureImportUser } from "./util.js";
import { importObjects, type ObjectImportOptions } from "./objects.js";

export interface SeedKosmoOptions {
  /** Passed to the object import; `check` writes nothing. */
  objects?: ObjectImportOptions;
}

/**
 * Seeds the Kosmographica knowledge base. Order matters: the import user and
 * object catalogue come first, then the curated domains, university and history
 * modules that other seeds build on.
 */
export async function seedKosmo(
  db: Db,
  options: SeedKosmoOptions = {}
): Promise<void> {
  console.log("\nSeeding Kosmographica...");

  const userId = await ensureImportUser(db);
  console.log(`  -> Kosmo import user id ${userId}`);

  await importObjects(db, userId, options.objects);

  if (options.objects?.check) {
    console.log("  -> check only: stopping before the other seeds.");
    return;
  }

  const { importDomains } = await import("./domains.js");
  await importDomains(db, userId);

  const { importUniversity } = await import("./university.js");
  await importUniversity(db, userId);

  const { importHistory } = await import("./history.js");
  await importHistory(db, userId);

  const { importDatasets } = await import("./datasets.js");
  await importDatasets(db);

  console.log("  -> Kosmographica seeding finished.");
}

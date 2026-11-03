import type { Db } from "./util.js";
import { ensureImportUser } from "./util.js";
import { importObjects } from "./objects.js";

/**
 * Seeds the Kosmographica knowledge base. Order matters: the import user and
 * object catalogue come first, then the curated domains, university and history
 * modules that other seeds build on.
 */
export async function seedKosmo(db: Db): Promise<void> {
  console.log("\nSeeding Kosmographica...");

  const userId = await ensureImportUser(db);
  console.log(`  -> Kosmo import user id ${userId}`);

  await importObjects(db, userId);

  const { importDomains } = await import("./domains.js");
  await importDomains(db, userId);

  const { importUniversity } = await import("./university.js");
  await importUniversity(db, userId);

  const { importHistory } = await import("./history.js");
  await importHistory(db, userId);

  console.log("  -> Kosmographica seeding finished.");
}

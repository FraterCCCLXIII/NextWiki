import { db } from "../../index.js";
import { seedKosmo } from "./index.js";

/**
 * Runs only the Kosmographica seed:
 *   pnpm db:seed:kosmo            full import
 *   pnpm db:seed:kosmo --check    plan and report, write nothing
 *   pnpm db:seed:kosmo --limit 200
 */
const args = process.argv.slice(2);
const check = args.includes("--check");
const limitAt = args.indexOf("--limit");
const limit = limitAt === -1 ? undefined : Number(args[limitAt + 1]);

if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
  console.error("--limit needs a positive number of rows");
  process.exit(2);
}

seedKosmo(db, { objects: { check, limit } })
  .then(() => {
    console.log("Kosmographica seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Kosmographica seed failed:", error);
    process.exit(1);
  });

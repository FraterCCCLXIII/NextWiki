import { db } from "../../../index.js";
import { ensureImportUser } from "../util.js";
import { importUniversity } from "../university.js";

/** Re-imports only the University curriculum (ids, concepts, lessons): pnpm db:seed:university */
const userId = await ensureImportUser(db);
await importUniversity(db, userId);
console.log("University seed completed.");
process.exit(0);

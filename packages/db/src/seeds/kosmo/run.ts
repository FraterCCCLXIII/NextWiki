import { db } from "../../index.js";
import { seedKosmo } from "./index.js";

/** Runs only the Kosmographica seed: pnpm db:seed:kosmo */
seedKosmo(db)
  .then(() => {
    console.log("Kosmographica seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Kosmographica seed failed:", error);
    process.exit(1);
  });

import { db } from "../../index.js";
import { formatHealth, kosmoHealth } from "./coverage.js";

/** Prints the knowledge-base health and article queue: pnpm db:kosmo:report */
kosmoHealth(db)
  .then((health) => {
    console.log(formatHealth(health));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Kosmographica report failed:", error);
    process.exit(1);
  });

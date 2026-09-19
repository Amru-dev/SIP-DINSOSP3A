import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDB, initialize } from "./src/database/index.js";
import { createApp } from "./src/app.js";
export { createApp };

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const db = await openDB();
  await initialize(db);
  const server = await createApp({ db });
  server.listen(
    Number(process.env.PORT || 3000),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        "Dinsos P3A: " + (process.env.APP_ORIGIN || "http://localhost:3000"),
      ),
  );
  for (const sig of ["SIGTERM", "SIGINT"])
    process.on(sig, () =>
      server.close(async () => {
        await db.close();
        process.exit(0);
      }),
    );
}

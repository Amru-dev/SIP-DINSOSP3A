import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { openDB, initialize } from "../src/database/index.js";
import { createApp } from "../src/app.js";

test("browser entry point and all module/style dependencies are served; backend sources stay private", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "dinsos-assets-"));
  const db = await openDB({ driver: "sqlite", dir });
  await initialize(db);
  const server = await createApp({ db, dir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  const visited = new Set();
  try {
    const html = await (await fetch(base)).text();
    assert.match(html, /<script type="module" src="\/app.js"><\/script>/);
    const queue = ["/app.js", "/style.css"];
    while (queue.length) {
      const route = queue.shift();
      if (visited.has(route)) continue;
      visited.add(route);
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.match(
        response.headers.get("content-type"),
        route.endsWith(".js") ? /text\/javascript/ : /text\/css/,
      );
      const text = await response.text();
      const imports = route.endsWith(".js")
        ? [
            ...text.matchAll(
              /\bimport\s+(?:[\s\S]*?\sfrom\s+)?["'](\.[^"']+)["']/g,
            ),
          ].map((m) => m[1])
        : [...text.matchAll(/@import\s+url\(["']([^"']+)["']\)/g)].map(
            (m) => m[1],
          );
      for (const specifier of imports)
        queue.push(new URL(specifier, base + route).pathname);
    }
    assert.ok(visited.has("/js/features/applications/detail.js"));
    assert.ok(visited.has("/js/features/information-requests/detail.js"));
    assert.ok(visited.has("/js/features/accounts/views.js"));
    assert.ok(visited.has("/css/applications.css"));
    for (const route of [
      "/src/app.js",
      "/src/database/schema.sql",
      "/data/dinsos.sqlite",
      "/js/../../server.js",
      "/js/missing.js",
    ]) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

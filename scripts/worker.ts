/**
 * KLEACORE background job worker (pg-boss), the optional second service.
 *
 * Bundled by scripts/build-worker.mjs to /app/worker.mjs in the image and
 * started with `./docker-entrypoint.sh worker` — same image as the web app,
 * different command. See docs/ops-jobs.md.
 *
 * Serves GET /api/health on $PORT so the image's Docker HEALTHCHECK works for
 * this container too (200 while the worker loop is running).
 */
import { createServer } from "node:http";
import { db } from "@/lib/db";
import { configureJobsRole, startWorker, stopBoss } from "@/lib/jobs";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker");

async function main() {
  configureJobsRole("worker");
  const worker = await startWorker();
  let stopping = false;

  const server = createServer((req, res) => {
    if (req.url === "/api/health" || req.url === "/") {
      res.writeHead(stopping ? 503 : 200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ status: stopping ? "stopping" : "ok", role: "worker" }));
      return;
    }
    res.writeHead(404).end();
  });
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, process.env.HOSTNAME || "0.0.0.0", () => log.info("worker health endpoint listening", { port }));

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("worker stopping", { signal });
    server.close();
    try {
      await worker.stop();
      await stopBoss({ graceful: true, timeout: 30_000 });
      await db.$disconnect();
    } catch (error) {
      log.error("worker shutdown error", { error });
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  log.error("worker failed to start", { error });
  process.exit(1);
});

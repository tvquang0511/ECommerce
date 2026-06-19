import { startMailWorker } from "./worker.js";

// Start worker
const worker = startMailWorker();

// Graceful shutdown (important for deployments and for tsx watch restarts)
async function shutdown(signal: string) {
  console.log(`[mail-worker] received ${signal}, shutting down...`);
  try {
    await worker.close();
  } catch (err) {
    console.error("[mail-worker] failed to close worker", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[mail-worker] unhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[mail-worker] uncaughtException", err);
  void shutdown("uncaughtException");
});

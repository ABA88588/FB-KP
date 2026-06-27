import { loadWorkerConfig } from "./config.js";
import { serializeError } from "./logger.js";
import { runWorkerApp } from "./runtime.js";

void runWorkerApp(loadWorkerConfig(process.env)).catch((error: unknown) => {
  console.error(JSON.stringify({ level: "error", message: "worker startup failed", error: serializeError(error) }));
  process.exitCode = 1;
});

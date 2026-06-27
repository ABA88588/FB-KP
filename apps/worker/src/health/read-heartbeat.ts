import { loadWorkerConfig } from "../config.js";
import { readHeartbeatFile } from "./heartbeat.js";

const config = loadWorkerConfig(process.env);

try {
  const heartbeat = await readHeartbeatFile(config.health.heartbeatPath);
  console.log(JSON.stringify(heartbeat, null, 2));
  process.exitCode = heartbeat.status === "ready" ? 0 : 1;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        status: "missing",
        heartbeatPath: config.health.heartbeatPath,
        error: message
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}

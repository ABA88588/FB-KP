import http from "node:http";

import type { WorkerConfig } from "../config.js";
import type { Logger } from "../logger.js";
import type { WorkerRuntimeSnapshot } from "../runtime-state.js";

export interface HealthServer {
  readonly close: () => Promise<void>;
}

export async function startHealthServer(
  config: WorkerConfig,
  getSnapshot: () => WorkerRuntimeSnapshot,
  logger: Logger
): Promise<HealthServer> {
  const server = http.createServer((request, response) => {
    const snapshot = getSnapshot();
    const path = request.url?.split("?")[0] ?? "/";

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    if (path === "/health" || path === "/health/live") {
      sendJson(response, 200, {
        status: "alive",
        worker: snapshot
      });
      return;
    }

    if (path === "/health/ready") {
      const ready = snapshot.status === "ready";
      sendJson(response, ready ? 200 : 503, {
        status: ready ? "ready" : snapshot.status,
        worker: snapshot
      });
      return;
    }

    if (path === "/health/heartbeat") {
      sendJson(response, 200, snapshot);
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.health.port, config.health.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  logger.info("worker health server started", {
    host: config.health.host,
    port: config.health.port
  });

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }

          resolve();
        });
      })
  };
}

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

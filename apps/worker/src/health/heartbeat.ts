import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WorkerRuntimeSnapshot } from "../runtime-state.js";

export function resolveHeartbeatPath(heartbeatPath: string): string {
  if (path.isAbsolute(heartbeatPath)) {
    return heartbeatPath;
  }

  return path.resolve(process.cwd(), heartbeatPath);
}

export async function readHeartbeatFile(heartbeatPath: string): Promise<WorkerRuntimeSnapshot> {
  const raw = await readFile(resolveHeartbeatPath(heartbeatPath), "utf8");
  return JSON.parse(raw) as WorkerRuntimeSnapshot;
}

export class HeartbeatWriter {
  private timer: NodeJS.Timeout | null = null;

  public constructor(
    private readonly heartbeatPath: string,
    private readonly intervalMs: number,
    private readonly getSnapshot: () => WorkerRuntimeSnapshot
  ) {}

  public async writeNow(): Promise<void> {
    const resolvedPath = resolveHeartbeatPath(this.heartbeatPath);
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, `${JSON.stringify(this.getSnapshot(), null, 2)}\n`, "utf8");
  }

  public start(): void {
    if (this.timer !== null) {
      return;
    }

    void this.writeNow();
    this.timer = setInterval(() => {
      void this.writeNow();
    }, this.intervalMs);
    this.timer.unref();
  }

  public async stop(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.writeNow();
  }
}

import { existsSync, mkdirSync, readFileSync } from "fs";
import { writeFile, rename } from "fs/promises";
import path from "path";

const dataDir = process.env.AGENT_DATA_DIR || path.join(process.cwd(), ".data");

function ensureDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function loadJsonSync<T>(filename: string, fallback: T): T {
  try {
    ensureDir();
    const filePath = path.join(dataDir, filename);
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const writeLocks = new Map<string, Promise<void>>();

export function writeJson(filename: string, data: unknown): void {
  ensureDir();
  const filePath = path.join(dataDir, filename);
  const tmpPath = `${filePath}.tmp`;
  const payload = JSON.stringify(data);

  const prev = writeLocks.get(filePath) || Promise.resolve();
  const next = prev
    .then(() => writeFile(tmpPath, payload, "utf-8"))
    .then(() => rename(tmpPath, filePath))
    .catch(() => {});
  writeLocks.set(filePath, next);
}

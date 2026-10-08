import { createHash } from "crypto";
import process from "node:process";
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir, platform } from "os";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";
import pretty from "prettier";

type Snapshot = {
  hash: string;
  name: string;
  filename: string;
  size: number;
  mode: number;
};

export const snapshots = new Map<string, Snapshot>();

export async function writeSnapshot(name: string, content: Buffer | string): Promise<Snapshot> {
  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  const hash = createHash("sha256").update(buffer).digest("hex");
  const entry: Snapshot = {
    hash,
    name,
    filename: name,
    size: buffer.length,
    mode: 0o644,
  };
  if (!snapshots.has(hash)) {
    snapshots.set(hash, entry);
  }
  return entry;
}

export function readSnapshot(hash: string): Snapshot | undefined {
  return snapshots.get(hash);
}

export const snapshotFactory = {
  writeSnapshot,
  readSnapshot,
};

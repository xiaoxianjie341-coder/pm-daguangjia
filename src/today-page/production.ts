import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const defaultDatabasePath = path.join(process.cwd(), "data", "pm.sqlite");

export function withTodayPageDatabase<T>(read: (db: DatabaseSync) => T): T {
  const file = process.env.PM_SQLITE_PATH ?? defaultDatabasePath;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try {
    return read(db);
  } finally {
    db.close();
  }
}

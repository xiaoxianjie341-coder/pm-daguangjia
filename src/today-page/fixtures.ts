import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { ensureTodayPageSchema } from "./index.ts";

export function insertFixtureProject(
  db: DatabaseSync,
  project: { id: string; name: string },
): void {
  ensureTodayPageSchema(db);
  db.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run(
    project.id,
    project.name,
  );
}

export function insertFixtureRiskCard(
  db: DatabaseSync,
  card: {
    title: string;
    projectId?: string;
    hidden?: boolean;
    resolved?: boolean;
    createdOn?: string;
    consumed?: number;
    planned?: number;
  },
): { id: string } {
  ensureTodayPageSchema(db);
  const projectId = card.projectId ?? defaultProjectId(db);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO risk_cards (
       id, project_id, title, hidden, resolved, created_on, consumed, planned
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    card.title,
    card.hidden ? 1 : 0,
    card.resolved ? 1 : 0,
    card.createdOn ?? "2026-11-13",
    card.consumed ?? null,
    card.planned ?? null,
  );
  return { id };
}

function defaultProjectId(db: DatabaseSync): string {
  const row = db
    .prepare(`SELECT id FROM projects WHERE name = ?`)
    .get("安克 · A30 睡眠耳机") as { id: string } | undefined;
  if (!row) {
    throw new Error("夹具缺少默认项目安克");
  }
  return row.id;
}

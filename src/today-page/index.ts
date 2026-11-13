import { DatabaseSync } from "node:sqlite";

const ANKER_PROJECT_ID = "anker";
const ANKER_PROJECT_NAME = "安克 · A30 睡眠耳机";

export type Project = {
  id: string;
  name: string;
};

export type ConsumptionBar = {
  consumed: number;
  planned: number;
};

export type RiskCard = {
  id: string;
  title: string;
  consumptionBar: ConsumptionBar | null;
};

export type TodayPage = {
  project: Project;
  date: string;
  projects: Project[];
  riskCards: RiskCard[];
  selectedRiskCardId: string | null;
};

export type OpenTodayPageInput = {
  projectId?: string;
  date?: string;
};

export function openTodayPage(
  db: DatabaseSync,
  input: OpenTodayPageInput = {},
): TodayPage {
  ensureTodayPageSchema(db);
  const projects = db
    .prepare(`SELECT id, name FROM projects ORDER BY rowid ASC`)
    .all() as Project[];
  const project = resolveProject(projects, input.projectId);
  // 日期只显示在页面上，不参与筛选。今日列表是该项目当前未隐藏、未解决的风险卡。
  const riskCards = readRiskCards(db, project.id);
  return {
    project,
    date: displayDate(input.date),
    projects,
    riskCards,
    selectedRiskCardId: riskCards[0]?.id ?? null,
  };
}

type RiskCardRow = {
  id: string;
  title: string;
  consumed: number | null;
  planned: number | null;
};

function readRiskCards(db: DatabaseSync, projectId: string): RiskCard[] {
  const rows = db
    .prepare(
      `SELECT id, title, consumed, planned
       FROM risk_cards
       WHERE project_id = ? AND hidden = 0 AND resolved = 0
       ORDER BY rowid ASC`,
    )
    .all(projectId) as RiskCardRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    consumptionBar: consumptionBar(row.consumed, row.planned),
  }));
}

function consumptionBar(
  consumed: number | null,
  planned: number | null,
): ConsumptionBar | null {
  if (consumed == null || planned == null) return null;
  return { consumed, planned };
}

function resolveProject(
  projects: Project[],
  projectId: string | undefined,
): Project {
  if (!projectId) {
    const anker = projects.find((project) => project.id === ANKER_PROJECT_ID);
    if (!anker) {
      throw new Error("默认项目安克不存在");
    }
    return anker;
  }
  const found = projects.find((project) => project.id === projectId);
  if (!found) {
    throw new Error(`项目不存在: ${projectId}`);
  }
  return found;
}

function displayDate(date: string | undefined): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ensureTodayPageSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS risk_cards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_on TEXT NOT NULL,
      consumed REAL,
      planned REAL
    );
  `);
  ensureRiskCardConsumptionColumns(db);
  db.prepare(
    `INSERT INTO projects (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING`,
  ).run(ANKER_PROJECT_ID, ANKER_PROJECT_NAME);
}

function ensureRiskCardConsumptionColumns(db: DatabaseSync): void {
  const columns = new Set(
    (
      db.prepare(`PRAGMA table_info(risk_cards)`).all() as { name: string }[]
    ).map((column) => column.name),
  );
  if (!columns.has("consumed")) {
    db.exec(`ALTER TABLE risk_cards ADD COLUMN consumed REAL`);
  }
  if (!columns.has("planned")) {
    db.exec(`ALTER TABLE risk_cards ADD COLUMN planned REAL`);
  }
}

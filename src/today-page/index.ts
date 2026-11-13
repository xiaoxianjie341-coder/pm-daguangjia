import { DatabaseSync } from "node:sqlite";

const ANKER_PROJECT_ID = "anker";
const ANKER_PROJECT_NAME = "安克 · A30 睡眠耳机";

export type Project = {
  id: string;
  name: string;
};

export type RiskCard = {
  id: string;
  title: string;
};

export type KeyNode = {
  id: string;
  content: string;
  date: string;
  link: string | null;
  marked: boolean;
};

export type TodayPage = {
  project: Project;
  date: string;
  projects: Project[];
  riskCards: RiskCard[];
  selectedRiskCardId: string | null;
  keyNodes: KeyNode[];
};

export type OpenTodayPageInput = {
  projectId?: string;
  date?: string;
  riskCardId?: string;
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
  // 日期不筛选今日列表。列表仍是该项目当前未隐藏、未解决的风险卡；日期只标出当天的关键节点。
  const riskCards = db
    .prepare(
      `SELECT id, title
       FROM risk_cards
       WHERE project_id = ? AND hidden = 0 AND resolved = 0
       ORDER BY rowid ASC`,
    )
    .all(project.id) as RiskCard[];
  const selectedRiskCardId = resolveSelectedRiskCardId(
    riskCards,
    input.riskCardId,
  );
  const date = displayDate(input.date);
  return {
    project,
    date,
    projects,
    riskCards,
    selectedRiskCardId,
    keyNodes: readKeyNodes(db, selectedRiskCardId, date),
  };
}

type KeyNodeRow = {
  id: string;
  content: string;
  node_date: string;
  link: string | null;
};

function readKeyNodes(
  db: DatabaseSync,
  riskCardId: string | null,
  date: string,
): KeyNode[] {
  if (!riskCardId) return [];
  const rows = db
    .prepare(
      `SELECT id, content, node_date, link
       FROM key_nodes
       WHERE risk_card_id = ?
       ORDER BY rowid ASC`,
    )
    .all(riskCardId) as KeyNodeRow[];
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    date: row.node_date,
    link: row.link ? row.link : null,
    marked: row.node_date === date,
  }));
}

function resolveSelectedRiskCardId(
  riskCards: RiskCard[],
  riskCardId: string | undefined,
): string | null {
  if (riskCardId && riskCards.some((card) => card.id === riskCardId)) {
    return riskCardId;
  }
  return riskCards[0]?.id ?? null;
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
      created_on TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS key_nodes (
      id TEXT PRIMARY KEY,
      risk_card_id TEXT NOT NULL,
      content TEXT NOT NULL,
      node_date TEXT NOT NULL,
      link TEXT
    );
  `);
  db.prepare(
    `INSERT INTO projects (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING`,
  ).run(ANKER_PROJECT_ID, ANKER_PROJECT_NAME);
}
